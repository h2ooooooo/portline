import path from 'node:path';
import {createHash} from 'node:crypto';
import {lstat, readFile, readdir} from 'node:fs/promises';
import type {ProfileWriteInspection} from '@jalsoedesign/portline-abstract';
import {runPowerShell} from './storage.js';
import type {NativeWritePatch, ProfileWriteBackend, WriteSnapshot, WriterTarget} from './write-types.js';

export function bytesDigest(data: string | null): string {
    return data === null ? 'missing' : createHash('sha256').update(Buffer.from(data, 'base64')).digest('hex');
}

/** Windows FileShare.None covers the complete read/backup/write/rollback interval. */
export class GuardedFileBackend implements ProfileWriteBackend {
    public constructor(private readonly target: WriterTarget) {}

    public async read(): Promise<WriteSnapshot> {
        const files = [...this.target.files];

        if (this.target.directory) {
            const visit = async (directory: string, depth: number): Promise<void> => {
                if (depth > 32 || files.length > 4096) {
                    throw new Error('Native session directory exceeds write limits');
                }

                for (const entry of await readdir(directory, {withFileTypes: true})) {
                    if (entry.isSymbolicLink()) {
                        throw new Error('Writing through linked session entries is unsupported');
                    }

                    const filename = path.join(directory, entry.name);

                    if (entry.isDirectory()) {
                        await visit(filename, depth + 1);
                    } else if (entry.isFile()) {
                        files.push(filename);
                    }
                }
            };

            try {
                await visit(this.target.directory, 0);
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }

        const images = [];
        let totalBytes = 0;

        for (const filename of [...new Set(files)].sort()) {
            try {
                const info = await lstat(filename);

                if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024 * 1024) {
                    throw new Error('Target is linked, nonregular or too large');
                }

                totalBytes += info.size;

                if (totalBytes > 32 * 1024 * 1024) {
                    throw new Error('Native write snapshot exceeds 32 MiB');
                }

                images.push({path: filename, data: (await readFile(filename)).toString('base64')});
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }

                images.push({path: filename, data: null});
            }
        }

        return {files: images};
    }

    public async inspect(snapshot: WriteSnapshot): Promise<Pick<ProfileWriteInspection, 'application' | 'lock' | 'diagnostics'>> {
        if (process.platform !== 'win32') {
            return {
                application: 'unknown',
                lock: 'unknown',
                diagnostics: [
                    {
                        code: 'unsupported-write-platform',
                        severity: 'warning',
                        message: 'The built-in guarded commit requires Windows; no unsafe fallback is enabled',
                    },
                ],
            };
        }

        try {
            return JSON.parse(await runPowerShell(fileTransactionProgram, {
                action: 'inspect',
                guard: this.target.guard,
                files: snapshot.files.map(file => file.path),
            }));
        } catch {
            return {
                application: 'unknown',
                lock: 'unknown',
                diagnostics: [
                    {
                        code: 'inspection-unavailable',
                        severity: 'warning',
                        message: 'Write availability could not be verified',
                    },
                ],
            };
        }
    }

    public async commit(snapshot: WriteSnapshot, patch: NativeWritePatch): Promise<readonly string[]> {
        if (process.platform !== 'win32' || patch.registry.length) {
            throw new Error('This backend cannot safely commit the requested storage');
        }

        const files = new Map(snapshot.files.map(file => [file.path, {...file, expected: bytesDigest(file.data)}]));

        for (const replacement of patch.files) {
            if (!files.has(replacement.path)) {
                files.set(replacement.path, {path: replacement.path, data: null, expected: 'missing'});
            }
        }

        const result = JSON.parse(await runPowerShell(fileTransactionProgram, {
            action: 'apply',
            guard: this.target.guard,
            rootDirectory: this.target.directory,
            identity: createHash('sha256').update(this.target.source.id).digest('hex'),
            expected: [...files.values()].map(file => ({path: file.path, hash: file.expected})),
            changes: patch.files,
        }, {timeoutMs: 0}));

        if (!result.ok) {
            throw Object.assign(new Error(result.error ?? 'Guarded native write failed'), {backupPaths: result.backups ?? []});
        }

        return result.backups;
    }
}

export const fileTransactionProgram = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class PortlineFiles {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool SetFileInformationByHandle(SafeFileHandle handle, int kind, ref int info, int size);
}
'@
function ExclusiveFile($filename, $create) {
    $disposition = 3
    if ($create) { $disposition = 1 }
    $handle = [PortlineFiles]::CreateFile($filename, 3221291008, 0, [IntPtr]::Zero, $disposition, 128, [IntPtr]::Zero)
    if ($handle.IsInvalid) { $handle.Dispose(); throw 'EXCLUSIVE_OPEN_FAILED' }
    return New-Object System.IO.FileStream($handle, [System.IO.FileAccess]::ReadWrite)
}
function DeleteOnClose($stream, $enabled) {
    $flag = [int]$enabled
    if (![PortlineFiles]::SetFileInformationByHandle($stream.SafeFileHandle, 4, [ref]$flag, 4)) { throw 'DISPOSITION_FAILED' }
}

function AppState {
    $names = @($request.guard.processNames)
    $all = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    foreach ($item in $all) {
        if ($names -contains $item.Name.ToLowerInvariant()) { return 'open' }
    }
    return 'closed'
}
function LockPresent {
    foreach ($filename in @($request.guard.lockPaths)) {
        if (Test-Path -LiteralPath $filename) { return $true }
    }
    return $false
}
function AssertPlainPath($filename) {
    $node = [System.IO.Path]::GetFullPath($filename)
    while ($node) {
        if (Test-Path -LiteralPath $node) {
            if (([System.IO.File]::GetAttributes($node) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'LINKED_TARGET'
            }
        }
        $parent = [System.IO.Path]::GetDirectoryName($node)
        if ($parent -eq $node) { break }
        $node = $parent
    }
}
function HashBytes($bytes) {
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hash.ComputeHash([byte[]]$bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $hash.Dispose() }
}
function ReadBytes($stream) {
    $memory = New-Object System.IO.MemoryStream
    try {
        $stream.Position = 0
        $stream.CopyTo($memory)
        return ,$memory.ToArray()
    } finally { $memory.Dispose() }
}
function PrivateAcl($filename) {
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object System.Security.AccessControl.FileSecurity
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'Allow')
    $acl.AddAccessRule($rule)
    [System.IO.File]::SetAccessControl($filename, $acl)
}
if ($request.action -eq 'inspect') {
    $application = 'unknown'
    $lock = 'unknown'
    try {
        $application = AppState
        $lock = 'unlocked'
        if (LockPresent) { $lock = 'locked' }
        foreach ($filename in @($request.files)) {
            AssertPlainPath $filename
            if (![System.IO.Directory]::Exists([System.IO.Path]::GetDirectoryName($filename))) {
                $lock = 'unknown'; break
            }
            if ([System.IO.File]::Exists($filename)) {
                $stream = [System.IO.File]::Open($filename, 'Open', 'Read', 'None')
                $stream.Dispose()
            }
        }
    } catch { $lock = 'unknown' }
    @{ application = $application; lock = $lock; diagnostics = @() } | ConvertTo-Json -Compress
    exit
}
$mutex = $null
$acquired = $false
$handles = @{}
$originals = @{}
$created = @()
$directories = @()
$deleted = @()
$changed = @()
$backups = @()
$success = $false
$manifest = $null
try {
    $mutex = New-Object System.Threading.Mutex($false, ('Local\Portline-' + $request.identity))
    try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
    if (!$acquired) { throw 'BUSY' }
    if ((AppState) -ne 'closed' -or (LockPresent)) { throw 'IN_USE' }
    foreach ($item in @($request.expected)) {
        AssertPlainPath $item.path
        if ($item.hash -eq 'missing') {
            if ([System.IO.File]::Exists($item.path)) { throw 'CHANGED' }
            continue
        }
        $stream = ExclusiveFile $item.path $false
        $handles[$item.path] = $stream
        $bytes = ReadBytes $stream
        if ((HashBytes $bytes) -ne $item.hash) { throw 'CHANGED' }
        $originals[$item.path] = $bytes
    }
    foreach ($item in @($request.changes)) {
        if (!$handles.ContainsKey($item.path)) {
            if ($null -eq $item.data) { continue }
            AssertPlainPath $item.path
            if (![System.IO.Directory]::Exists([System.IO.Path]::GetDirectoryName($item.path))) {
                if (!$request.rootDirectory) { throw 'MISSING_PARENT' }
                $root = [System.IO.Path]::GetFullPath($request.rootDirectory).TrimEnd('\') + '\'
                $parent = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($item.path))
                if (!(($parent.TrimEnd('\') + '\').StartsWith($root, [StringComparison]::OrdinalIgnoreCase))) { throw 'OUTSIDE_ROOT' }
                $missing = @()
                while (![System.IO.Directory]::Exists($parent)) {
                    $missing = @($parent) + $missing
                    $parent = [System.IO.Path]::GetDirectoryName($parent)
                }
                foreach ($folder in $missing) {
                    AssertPlainPath $folder
                    [System.IO.Directory]::CreateDirectory($folder) | Out-Null
                    $directories += $folder
                }
            }
            $stream = ExclusiveFile $item.path $true
            $handles[$item.path] = $stream
            $created += $item.path
        }
    }
    $backupRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Portline\backups'
    AssertPlainPath $backupRoot
    [System.IO.Directory]::CreateDirectory($backupRoot) | Out-Null
    foreach ($item in @($request.changes)) {
        if ($originals.ContainsKey($item.path)) {
            $backup = Join-Path $backupRoot ([Guid]::NewGuid().ToString('N') + '.bak')
            $handle = [System.IO.File]::Open($backup, 'CreateNew', 'Write', 'None')
            try {
                PrivateAcl $backup
                $bytes = $originals[$item.path]
                $handle.Write($bytes, 0, $bytes.Length)
                $handle.Flush($true)
            } finally { $handle.Dispose() }
            $backups += @{ target = $item.path; backup = $backup }
        }
    }
    if ($backups.Count -gt 0) {
        $manifest = Join-Path $backupRoot ([Guid]::NewGuid().ToString('N') + '.manifest.json')
        $handle = [System.IO.File]::Open($manifest, 'CreateNew', 'Write', 'None')
        try {
            PrivateAcl $manifest
            $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject @($backups) -Compress))
            $handle.Write($bytes, 0, $bytes.Length); $handle.Flush($true)
        } finally { $handle.Dispose() }
    }
    if ((AppState) -ne 'closed' -or (LockPresent)) { throw 'IN_USE' }
    foreach ($item in @($request.changes)) {
        if ($null -eq $item.data) {
            if ($handles.ContainsKey($item.path)) {
                DeleteOnClose $handles[$item.path] 1
                $deleted += $item.path
            }
            continue
        }
        $stream = $handles[$item.path]
        $bytes = [Convert]::FromBase64String($item.data)
        $changed += $item.path
        $stream.Position = 0
        $stream.SetLength(0)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
    }
    if ((AppState) -ne 'closed' -or (LockPresent)) { throw 'IN_USE' }
    $success = $true
    @{ ok = $true; backups = @(@($backups | ForEach-Object { $_.backup }) + @($manifest) | Where-Object { $_ }) } | ConvertTo-Json -Depth 8 -Compress
} catch {
    $restored = $true
    foreach ($filename in $deleted) {
        try { DeleteOnClose $handles[$filename] 0 } catch { $restored = $false }
    }
    foreach ($filename in $changed) {
        if ($originals.ContainsKey($filename)) {
            try {
                $stream = $handles[$filename]
                $bytes = $originals[$filename]
                $stream.Position = 0; $stream.SetLength(0)
                $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true)
            } catch { $restored = $false }
        }
    }
    $message = 'Write refused: source changed, application in use, native lock, or storage unavailable'
    if (!$restored) { $message = 'Write failed and rollback was incomplete; restore retained recovery backups with the application closed' }
    @{ ok = $false; error = $message; backups = @(@($backups | ForEach-Object { $_.backup }) + @($manifest) | Where-Object { $_ }) } | ConvertTo-Json -Depth 8 -Compress
} finally {
    if (!$success) {
        foreach ($filename in $created) {
            try { DeleteOnClose $handles[$filename] 1 } catch {}
        }
    }
    foreach ($stream in $handles.Values) { $stream.Dispose() }
    if (!$success) {
        [Array]::Reverse($directories)
        foreach ($folder in $directories) {
            try { [System.IO.Directory]::Delete($folder, $false) } catch {}
        }
    }
    if ($acquired) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
`;
