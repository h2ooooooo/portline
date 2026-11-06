import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readFile, readdir, stat, mkdtemp, writeFile, unlink, rmdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import type {ProfileStorage} from '@jalsoedesign/portline-abstract';

export type NativeValue = string | number | string[] | number[];
export type NativeSettings = Readonly<Record<string, NativeValue>>;
export interface NativeSession {
    readonly name: string;
    readonly settings: NativeSettings;
}
export type RegistryStorage = Extract<ProfileStorage, {kind: 'registry'}>;
export interface RegistryReader {
    exists(storage: RegistryStorage): Promise<boolean>;
    read(storage: RegistryStorage): Promise<readonly NativeSession[]>;
}

/** Fixed helper code and JSON data use separate channels. Large helpers never enter the command line. */
export async function runPowerShell(
    program: string,
    input: unknown,
    options: {timeoutMs?: number} = {},
): Promise<string> {
    if (process.platform !== 'win32') {
        throw new Error('Live Windows inspection is unavailable on this platform');
    }

    const code = '[Console]::InputEncoding = [Text.Encoding]::UTF8\n' + program;
    let encoded = Buffer.from(code, 'utf16le').toString('base64');
    let directory: string | undefined;
    let filename: string | undefined;

    try {
        if (encoded.length > 20000) {
            directory = await mkdtemp(join(tmpdir(), 'portline-helper-'));
            filename = join(directory, 'program.ps1');
            await writeFile(filename, '\uFEFF' + code, {mode: 0o600, flag: 'wx'});

            const literal = "'" + filename.replace(/'/g, "''") + "'";

            encoded = Buffer.from(
                '. ([scriptblock]::Create([IO.File]::ReadAllText(' + literal + ', [Text.Encoding]::UTF8)))',
                'utf16le',
            ).toString('base64');
        }

        return await new Promise<string>((resolve, reject) => {
            const child = spawn('powershell.exe', [
                '-NoLogo',
                '-NoProfile',
                '-NonInteractive',
                '-EncodedCommand',
                encoded,
            ], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
            let output = '';
            let size = 0;
            const timeoutMs = options.timeoutMs ?? 15000;
            const timer = timeoutMs > 0 ? setTimeout(() => child.kill(), timeoutMs) : undefined;

            child.stdout.setEncoding('utf8');
            child.stdout.on('data', (chunk: string) => {
                size += Buffer.byteLength(chunk, 'utf8');

                if (size > 16 * 1024 * 1024) {
                    child.kill();

                    return;
                }

                output += chunk;
            });
            child.stderr.resume();
            child.on('error', reject);
            child.on('close', exitCode => {
                if (timer) {
                    clearTimeout(timer);
                }

                if (exitCode !== 0 || size > 16 * 1024 * 1024) {
                    reject(new Error('Windows inspection failed or exceeded its output limit'));
                } else {
                    resolve(output.replace(/^\uFEFF/, ''));
                }
            });
            child.stdin.on('error', () => {});
            child.stdin.end(JSON.stringify(input));
        });
    } finally {
        if (filename) {
            await unlink(filename).catch(() => {});
        }

        if (directory) {
            await rmdir(directory).catch(() => {});
        }
    }
}

const registryProgram = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$hive = [Microsoft.Win32.RegistryHive]::CurrentUser
if ($request.hive -eq 'HKLM') { $hive = [Microsoft.Win32.RegistryHive]::LocalMachine }
$view = [Microsoft.Win32.RegistryView]::Default
if ($request.view -eq '32') { $view = [Microsoft.Win32.RegistryView]::Registry32 }
if ($request.view -eq '64') { $view = [Microsoft.Win32.RegistryView]::Registry64 }
$base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
try {
    $key = $base.OpenSubKey($request.key, $false)
    if ($null -eq $key) { 'null'; exit }
    try {
        if ($request.probe) { 'true'; exit }
        $result = @()
        function Visit($node, $prefix) {
            $settings = @{}
            foreach ($name in $node.GetValueNames()) {
                $settings[$name] = $node.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            }
            if ($settings.Count -gt 0) {
                $script:result += @{ name = $prefix; settings = $settings }
            }
            foreach ($name in $node.GetSubKeyNames()) {
                $child = $node.OpenSubKey($name, $false)
                try { Visit $child ($prefix + $name + '\') } finally { $child.Dispose() }
            }
        }
        Visit $key ''
        ConvertTo-Json -InputObject @($script:result) -Depth 20 -Compress
    } finally { $key.Dispose() }
} finally { $base.Dispose() }
`;

export const windowsRegistry: RegistryReader = {
    async exists(storage) {
        return (await runPowerShell(registryProgram, {...storage, probe: true})).trim() === 'true';
    },
    async read(storage) {
        const result = JSON.parse(await runPowerShell(registryProgram, storage)) as NativeSession[] | null;

        if (result === null) {
            throw new Error('Registry source does not exist');
        }

        return result.map(session => ({...session, name: session.name.replace(/\\$/, '')}));
    },
};

export async function exists(filename: string): Promise<boolean> {
    try {
        await stat(filename);

        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
            return false;
        }

        throw error;
    }
}

export async function readText(filename: string): Promise<string> {
    const bytes = await readFile(filename);

    if (bytes.length > 16 * 1024 * 1024) {
        throw new Error('Configuration file exceeds 16 MiB');
    }

    return (bytes[0] === 0xff && bytes[1] === 0xfe ?
        bytes.subarray(2).toString('utf16le') : bytes.toString('utf8')).replace(/^\uFEFF/, '');
}

export async function directoryFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, {withFileTypes: true});

    return entries.filter(entry => entry.isFile()).map(entry => entry.name).sort();
}

export function decodeName(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value.replace(/%([a-f\d]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    }
}

export function parseIni(text: string): NativeSession[] {
    const sections = new Map<string, Record<string, NativeValue>>();
    let current: Record<string, NativeValue> = Object.create(null);

    sections.set('', current);

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || /^[;#]/.test(trimmed)) {
            continue;
        }

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const name = trimmed.slice(1, -1);

            current = sections.get(name) ?? Object.create(null);
            sections.set(name, current);

            continue;
        }

        const separator = line.indexOf('=');

        if (separator >= 0) {
            current[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
        }
    }

    return Array.from(sections, ([name, settings]) => ({name, settings}));
}

function unquote(value: string): string {
    if (!/^"(?:[^"\\]|\\.)*"$/.test(value)) {
        throw new Error('Invalid quoted registry value');
    }

    return value.slice(1, -1).replace(/\\([\\"])/g, '$1');
}

export function parseRegistryExport(text: string, root: string): NativeSession[] {
    const sessions: NativeSession[] = [];
    let current: Record<string, NativeValue> | undefined;
    const normalized = root.replace(/^HKCU\\/i, 'HKEY_CURRENT_USER\\')
        .replace(/^HKLM\\/i, 'HKEY_LOCAL_MACHINE\\').replace(/\\$/, '');

    for (const line of text.replace(/\\\r?\n\s*/g, '').split(/\r?\n/)) {
        const section = /^\[([^\]]+)\]$/.exec(line.trim());

        if (section) {
            current = undefined;

            const name = section[1];

            if (name.toLowerCase().startsWith(normalized.toLowerCase() + '\\')) {
                current = Object.create(null);
                sessions.push({name: name.slice(normalized.length + 1), settings: current!});
            }

            continue;
        }

        const entry = /^("(?:[^"\\]|\\.)*"|@)=(.*)$/.exec(line.trim());

        if (!current || !entry) {
            continue;
        }

        const key = entry[1] === '@' ? '' : unquote(entry[1]);
        const value = entry[2];

        if (value.startsWith('"')) {
            current[key] = unquote(value);
        } else if (/^dword:[a-f\d]{1,8}$/i.test(value)) {
            current[key] = parseInt(value.slice(6), 16) | 0;
        } else {
            const hex = /^hex(?:\(([a-f\d]+)\))?:([a-f\d,\s]*)$/i.exec(value);

            if (!hex) {
                throw new Error('Unsupported registry export value');
            }

            const bytes = Buffer.from(hex[2].replace(/[,\s]/g, ''), 'hex');

            if (hex[1] === '1' || hex[1] === '2') {
                current[key] = bytes.toString('utf16le').replace(/\0+$/, '');
            } else if (hex[1] === '7') {
                current[key] = bytes.toString('utf16le').replace(/\0+$/, '').split('\0');
            } else {
                current[key] = [...bytes];
            }
        }
    }

    return sessions;
}
