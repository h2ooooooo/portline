import path from 'node:path';
import type {ProfileDiagnostic, SourceReference} from '@jalsoedesign/portline-abstract';
import {runPowerShell} from './storage.js';

export interface RunningApplication {
    readonly executablePath: string;
    readonly applicationVersion?: string;
    readonly arguments: readonly string[];
}
export interface ProcessReader {
    list(names: readonly string[]): Promise<readonly RunningApplication[]>;
}
export const windowsProcesses: ProcessReader = {
    async list(names) {
        const output = await runPowerShell(String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$names = [Console]::In.ReadToEnd() | ConvertFrom-Json
$result = @()
foreach ($process in Get-CimInstance Win32_Process) {
    if ($names -contains $process.Name -and $process.ExecutablePath) {
        $version = (Get-Item -LiteralPath $process.ExecutablePath).VersionInfo.FileVersion
        $result += @{ executablePath = $process.ExecutablePath; applicationVersion = $version; commandLine = $process.CommandLine }
    }
}
ConvertTo-Json -InputObject @($result) -Compress
`, names);
        const rows = JSON.parse(output) as {
            executablePath: string;
            applicationVersion?: string;
            commandLine?: string;
        }[];

        return rows.map(row => ({
            executablePath: row.executablePath,
            applicationVersion: row.applicationVersion,
            arguments: splitWindowsArguments(row.commandLine ?? '').slice(1),
        }));
    },
};

/** Windows quoting for paths/storage switches; never executes the parsed arguments. */
export function splitWindowsArguments(commandLine: string): string[] {
    const result: string[] = [];
    let token = '';
    let quoted = false;
    let started = false;

    for (let index = 0; index < commandLine.length; index++) {
        const char = commandLine[index];

        if (char === '\\') {
            let count = 1;

            while (commandLine[index + 1] === '\\') {
                count++;
                index++;
            }

            if (commandLine[index + 1] === '"') {
                token += '\\'.repeat(Math.floor(count / 2));
                index++;

                if (count % 2) {
                    token += '"';
                } else {
                    quoted = !quoted;
                }
            } else {
                token += '\\'.repeat(count);
            }
        } else if (char === '"') {
            quoted = !quoted;
            started = true;
        } else if (/\s/.test(char) && !quoted) {
            if (started || token) {
                result.push(token);
                token = '';
                started = false;
            }
        } else {
            token += char;
            started = true;
        }
    }

    if (started || token) {
        result.push(token);
    }

    return result;
}

export interface DiscoveryResult {
    readonly candidates: readonly SourceReference[];
    readonly selectedSourceId?: string;
    readonly selectedBy?: 'explicit' | 'running-application' | 'application-default' | 'only-candidate';
    readonly diagnostics: readonly ProfileDiagnostic[];
}

export function selectSource(
    candidates: readonly SourceReference[],
    options: {sourceId?: string; runningIds?: readonly string[]; defaultId?: string} = {},
    diagnostics: readonly ProfileDiagnostic[] = [],
): DiscoveryResult {
    const unique = [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()];
    let selectedSourceId: string | undefined;
    let selectedBy: DiscoveryResult['selectedBy'];

    if (options.sourceId) {
        if (!unique.some(candidate => candidate.id === options.sourceId)) {
            throw new Error('Requested source was not discovered');
        }

        selectedSourceId = options.sourceId;
        selectedBy = 'explicit';
    } else {
        const active = [...new Set(options.runningIds ?? [])].filter(id => unique.some(item => item.id === id));

        if (active.length === 1) {
            selectedSourceId = active[0];
            selectedBy = 'running-application';
        } else if (active.length === 0 && options.defaultId && unique.some(item => item.id === options.defaultId)) {
            selectedSourceId = options.defaultId;
            selectedBy = 'application-default';
        } else if (active.length === 0 && unique.length === 1) {
            selectedSourceId = unique[0].id;
            selectedBy = 'only-candidate';
        }
    }

    return {
        candidates: unique,
        selectedSourceId,
        selectedBy,
        diagnostics,
    };
}

export function requireSource(result: DiscoveryResult): SourceReference {
    const source = result.candidates.find(item => item.id === result.selectedSourceId);

    if (!source) {
        throw new Error(result.candidates.length === 1 ?
            'Active storage is unknown; select --source, --file, --directory or --registry explicitly' :
            result.candidates.length ?
                'Multiple sources are available; select --source, --file, --directory or --registry explicitly' :
                'No configuration source found; specify --file, --directory or --registry');
    }

    return source;
}

export function fileSource(application: string, filename: string, kind: 'file' | 'directory' = 'file'): SourceReference {
    const resolved = path.resolve(filename);

    return {
        id: application + ':' + resolved,
        application,
        location: resolved,
        storage: [{kind, path: resolved}],
    };
}
