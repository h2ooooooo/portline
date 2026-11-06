import {createHash} from 'node:crypto';
import {runPowerShell} from './storage.js';
import {guardedRegistryFunctions} from './registry-guarded-program.js';
import {guardedRegistryWarning, registryDiagnostic, RegistryWriteError} from './registry-write-status.js';
import type {NativeWritePatch, ProfileWriteBackend, RegistryKeyImage, WriteSnapshot, WriterTarget} from './write-types.js';

export class GuardedRegistryBackend implements ProfileWriteBackend {
    public constructor(private readonly target: WriterTarget) {}

    public async read(): Promise<WriteSnapshot> {
        const result = JSON.parse(await runPowerShell(registryTransactionProgram, {
            action: 'read',
            storage: this.target.registry,
            mode: this.target.registryMode ?? 'transactional',
            guard: this.target.guard,
        }));

        if (!result.ok) {
            throw new RegistryWriteError(result);
        }

        return {files: [], registry: result.keys};
    }

    public async inspect() {
        try {
            const result = JSON.parse(await runPowerShell(registryTransactionProgram, {
                action: 'inspect',
                storage: this.target.registry,
                mode: this.target.registryMode ?? 'transactional',
                guard: this.target.guard,
            }));

            return {
                application: result.application as 'open' | 'closed' | 'unknown',
                lock: result.lock as 'locked' | 'unlocked' | 'unknown',
                diagnostics: [
                    ...(result.error ? [registryDiagnostic(result.error)] : []),
                    ...(this.target.registryMode === 'guarded' ? [guardedRegistryWarning] : []),
                ],
            };
        } catch {
            return {
                application: 'unknown' as const,
                lock: 'unknown' as const,
                diagnostics: [
                    {
                        code: 'inspection-unavailable',
                        severity: 'warning' as const,
                        message: 'Registry application and transaction availability could not be verified',
                    },
                ],
            };
        }
    }

    public async commit(snapshot: WriteSnapshot, patch: NativeWritePatch): Promise<readonly string[]> {
        const result = JSON.parse(await runPowerShell(registryTransactionProgram, {
            action: 'apply',
            storage: this.target.registry,
            mode: this.target.registryMode ?? 'transactional',
            guard: this.target.guard,
            identity: createHash('sha256').update(this.target.registry!.hive + '\\' +
                this.target.registry!.key.toLowerCase()).digest('hex'),
            expected: canonicalRegistry(snapshot.registry ?? []),
            changes: patch.registry,
            ownerProcessId: process.pid,
        }, {timeoutMs: 0}));

        if (!result.ok) {
            throw new RegistryWriteError(result);
        }

        return result.backups;
    }
}

function canonicalRegistry(keys: readonly RegistryKeyImage[]): readonly RegistryKeyImage[] {
    return [...keys].sort((a, b) => a.path.localeCompare(b.path, 'en')).map(key => ({
        path: key.path,
        values: [...key.values].sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }));
}

/** Transactional by default. Guarded mode is selected explicitly and never used as a fallback. */
export const registryTransactionProgram = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PortlineRegistry {
    [DllImport("KtmW32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern IntPtr CreateTransaction(IntPtr a, IntPtr b, uint c, uint d, uint e, uint f, string description);
    [DllImport("KtmW32.dll", SetLastError=true)]
    public static extern bool CommitTransaction(IntPtr transaction);
    [DllImport("KtmW32.dll", SetLastError=true)]
    public static extern bool RollbackTransaction(IntPtr transaction);
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr handle);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
    public static extern int RegOpenKeyTransacted(IntPtr key, string path, uint options, int access, out IntPtr result, IntPtr transaction, IntPtr extension);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
    public static extern int RegCreateKeyTransacted(IntPtr key, string path, uint reserved, string klass, uint options, int access, IntPtr security, out IntPtr result, out uint disposition, IntPtr transaction, IntPtr extension);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
    public static extern int RegCreateKeyEx(IntPtr key, string path, uint reserved, string klass, uint options, int access, IntPtr security, out IntPtr result, out uint disposition);
    [DllImport("advapi32.dll")]
    public static extern int RegCloseKey(IntPtr key);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
    public static extern int RegDeleteKeyTransacted(IntPtr key, string path, int view, uint reserved, IntPtr transaction, IntPtr extension);
}
'@
function AppState {
    $names = @($request.guard.processNames | ForEach-Object { $_.ToLowerInvariant() -replace '\.(exe|com)$', '' })
    foreach ($item in @(Get-Process -ErrorAction Stop)) {
        if ($names -contains $item.ProcessName.ToLowerInvariant()) { return 'open' }
    }
    return 'closed'
}
function LockPresent {
    foreach ($filename in @($request.guard.lockPaths)) {
        if (Test-Path -LiteralPath $filename) { return $true }
    }
    return $false
}
$hive = [Microsoft.Win32.RegistryHive]::CurrentUser
if ($request.storage.hive -eq 'HKLM') { $hive = [Microsoft.Win32.RegistryHive]::LocalMachine }
$view = [Microsoft.Win32.RegistryView]::Default
$viewFlag = 0
if ($request.storage.view -eq '32') { $view = [Microsoft.Win32.RegistryView]::Registry32; $viewFlag = 512 }
if ($request.storage.view -eq '64') { $view = [Microsoft.Win32.RegistryView]::Registry64; $viewFlag = 256 }
$base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
# RegistryKey.Handle can be null for predefined HKLM roots when the caller lacks root-wide write access.
# The native APIs explicitly support these predefined handles; requested per-key access remains enforced.
$nativeRoot = [IntPtr]::new(-2147483647)
if ($request.storage.hive -eq 'HKLM') { $nativeRoot = [IntPtr]::new(-2147483646) }
$script:registryFailure = $null
$applicationState = 'unknown'
$backup = $null
$guarded = $request.mode -eq 'guarded'
$writeClock = [Diagnostics.Stopwatch]::StartNew()
function Fail($code, $nativeCode, $operation) {
    $script:registryFailure = @{ code = $code; nativeCode = $nativeCode; operation = $operation }
    throw 'PORTLINE_REGISTRY_REFUSED'
}
function CurrentFailure($exception) {
    if ($script:registryFailure) { return $script:registryFailure }
    $nativeCode = 0
    if ($exception.Exception -is [UnauthorizedAccessException] -or $exception.Exception.InnerException -is [UnauthorizedAccessException]) { $nativeCode = 5 }
    return @{ code = 'registry-operation-failed'; nativeCode = $nativeCode; operation = $request.action }
}
function ValidateChange($change) {
    if (!$change.path -or $change.path.StartsWith('\') -or
        @($change.path.Split('\') | Where-Object { !$_ -or $_ -eq '..' -or $_ -eq '.' }).Count -gt 0) {
        Fail 'invalid-registry-path' 0 'preflight'
    }
}
function SaveRegistryBackup($images, $mode) {
    Add-Type -AssemblyName System.Security
    $backupRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Portline\backups'
    [System.IO.Directory]::CreateDirectory($backupRoot) | Out-Null
    $filename = Join-Path $backupRoot ([Guid]::NewGuid().ToString('N') + '.registry.dpapi')
    $json = ConvertTo-Json -InputObject @{
        schemaVersion = 1; storage = $request.storage; keys = @($images); changes = @($request.changes); mode = $mode
    } -Depth 30 -Compress
    $protected = [System.Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($json), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $stream = [System.IO.File]::Open($filename, 'CreateNew', 'Write', 'None')
    try { $stream.Write($protected, 0, $protected.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    return $filename
}
$transaction = [IntPtr]::Zero
$mutex = $null
$acquired = $false
$script:keys = @()
function OpenTransacted($relative, $create) {
    $raw = [IntPtr]::Zero
    $full = $request.storage.key
    if ($relative) { $full += '\' + $relative }
    if ($transaction -eq [IntPtr]::Zero) {
        if ($create -and $guarded) { return $base.CreateSubKey($full) }
        return $base.OpenSubKey($full, ($guarded -and $request.action -eq 'apply'))
    }
    $access = 131103 -bor $viewFlag
    if ($create) {
        $disposition = [uint32]0
        $code = [PortlineRegistry]::RegCreateKeyTransacted($nativeRoot, $full, 0, $null, 0, $access, [IntPtr]::Zero, [ref]$raw, [ref]$disposition, $transaction, [IntPtr]::Zero)
    } else {
        $code = [PortlineRegistry]::RegOpenKeyTransacted($nativeRoot, $full, 0, $access, [ref]$raw, $transaction, [IntPtr]::Zero)
        if ($code -eq 2) { return $null }
    }
    if ($code -ne 0) { Fail 'registry-transaction-unavailable' $code 'open-transacted-key' }
    $safe = New-Object Microsoft.Win32.SafeHandles.SafeRegistryHandle($raw, $true)
    return [Microsoft.Win32.RegistryKey]::FromHandle($safe, $view)
}
function Snapshot($relative) {
    if ($script:keys.Count -gt 4096 -or @($relative.Split('\')).Count -gt 32) { throw 'SNAPSHOT_LIMIT' }
    $key = OpenTransacted $relative $false
    if ($null -eq $key) { return }
    try {
        $values = @()
        foreach ($name in $key.GetValueNames()) {
            $kind = $key.GetValueKind($name).ToString()
            $value = $key.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            if ($kind -eq 'QWord') { $value = $value.ToString() }
            $values += @{ name = $name; kind = $kind; value = $value }
        }
        $script:keys += @{ path = $relative; values = @($values) }
        foreach ($name in $key.GetSubKeyNames()) {
            $child = $name
            if ($relative) { $child = $relative + '\' + $name }
            Snapshot $child
        }
    } finally { $key.Dispose() }
}
function CompareSnapshot($actual, $expected) {
    if (@($actual).Count -ne @($expected).Count) { Fail 'registry-source-changed' 0 'compare-snapshot' }
    foreach ($old in @($expected)) {
        $matches = @($actual | Where-Object { $_.path -ceq $old.path })
        if ($matches.Count -ne 1) { Fail 'registry-source-changed' 0 'compare-snapshot' }
        $values = @($matches[0].values)
        if ($values.Count -ne @($old.values).Count) { Fail 'registry-source-changed' 0 'compare-snapshot' }
        foreach ($value in @($old.values)) {
            $items = @($values | Where-Object { $_.name -ceq $value.name })
            if ($items.Count -ne 1 -or $items[0].kind -cne $value.kind) { Fail 'registry-source-changed' 0 'compare-snapshot' }
            $left = ConvertTo-Json -InputObject $items[0].value -Depth 20 -Compress
            $right = ConvertTo-Json -InputObject $value.value -Depth 20 -Compress
            if ($left -cne $right) { Fail 'registry-source-changed' 0 'compare-snapshot' }
        }
    }
}
${guardedRegistryFunctions}
try {
    if ($request.action -eq 'read') {
        Snapshot ''
        @{ ok = $true; keys = @($keys) } | ConvertTo-Json -Depth 30 -Compress
        exit
    }
    if ($request.mode -and @('transactional', 'guarded') -notcontains $request.mode) { Fail 'invalid-registry-mode' 0 'policy' }
    $applicationState = AppState
    if (!$guarded) {
        $transaction = [PortlineRegistry]::CreateTransaction([IntPtr]::Zero, [IntPtr]::Zero, 0, 0, 0, 15000, 'Portline profile write')
        if ($transaction -eq [IntPtr]::Zero -or $transaction.ToInt64() -eq -1) {
            Fail 'registry-transaction-unavailable' ([Runtime.InteropServices.Marshal]::GetLastWin32Error()) 'create-transaction'
        }
    }
    if ($request.action -eq 'inspect') {
        if ($guarded) { GuardedWritable } else {
            $probe = OpenTransacted '' $false
            if ($probe) { $probe.Dispose() }
        }
        $lock = 'unlocked'
        if (LockPresent) { $lock = 'locked' }
        @{ application = $applicationState; lock = $lock; mode = $request.mode } | ConvertTo-Json -Compress
        exit
    }
    $mutex = New-Object System.Threading.Mutex($false, ('Local\Portline-' + $request.identity))
    try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
    if (!$acquired -or (AppState) -ne 'closed' -or (LockPresent)) { Fail 'registry-in-use' 0 'availability' }
    Snapshot ''
    CompareSnapshot $keys @($request.expected)
    if ($guarded) {
        ApplyGuarded | ConvertTo-Json -Depth 10 -Compress
        exit
    }
    $backup = SaveRegistryBackup $keys 'transactional'
    foreach ($change in @($request.changes)) {
        ValidateChange $change
        if ($change.remove) {
            $key = OpenTransacted $change.path $false
            if (!$key) { Fail 'registry-source-changed' 0 'compare-snapshot' }
            try { if ($key.SubKeyCount -gt 0) { throw 'NOT_A_LEAF' } } finally { $key.Dispose() }
            $full = $request.storage.key + '\' + $change.path
            $code = [PortlineRegistry]::RegDeleteKeyTransacted($nativeRoot, $full, $viewFlag, 0, $transaction, [IntPtr]::Zero)
            if ($code -ne 0) { Fail 'registry-operation-failed' $code 'delete-transacted-key' }
        } else {
            $key = OpenTransacted $change.path $true
            try {
                foreach ($property in $change.set.PSObject.Properties) {
                    $value = $property.Value
                    $kind = [Microsoft.Win32.RegistryValueKind]::String
                    if ($value -is [int] -or $value -is [long]) { $kind = [Microsoft.Win32.RegistryValueKind]::DWord; $value = [int]$value }
                    $key.SetValue($property.Name, $value, $kind)
                }
                foreach ($name in @($change.unset)) { $key.DeleteValue($name, $false) }
            } finally { $key.Dispose() }
        }
    }
    if ((AppState) -ne 'closed' -or (LockPresent)) { Fail 'registry-in-use' 0 'availability' }
    if (![PortlineRegistry]::CommitTransaction($transaction)) {
        Fail 'registry-transaction-unavailable' ([Runtime.InteropServices.Marshal]::GetLastWin32Error()) 'commit-transaction'
    }
    @{ ok = $true; backups = @($backup) } | ConvertTo-Json -Compress
} catch {
    if ($request.action -eq 'inspect') {
        @{ application = $applicationState; lock = 'unknown'; error = (CurrentFailure $_) } | ConvertTo-Json -Compress
    } else {
        @{ ok = $false; error = (CurrentFailure $_); backups = @($backup | Where-Object { $_ }) } | ConvertTo-Json -Depth 8 -Compress
    }
} finally {
    if ($transaction -ne [IntPtr]::Zero -and $transaction.ToInt64() -ne -1) {
        [PortlineRegistry]::RollbackTransaction($transaction) | Out-Null
        [PortlineRegistry]::CloseHandle($transaction) | Out-Null
    }
    if ($acquired) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
    $base.Dispose()
}
`;
