/** Shared PowerShell helpers for the explicitly selected non-atomic registry policy. */
export const guardedRegistryFunctions = String.raw`
function GuardedValue($key, $name) {
    if (!$key) { return @{ exists = $false } }
    $actual = @($key.GetValueNames() | Where-Object { $_ -ieq $name })
    if ($actual.Count -eq 0) { return @{ exists = $false } }
    $kind = $key.GetValueKind($actual[0]).ToString()
    $value = $key.GetValue($actual[0], $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    if ($kind -eq 'QWord') { $value = $value.ToString() }
    return @{ exists = $true; kind = $kind; value = $value }
}
function GuardedValueEqual($left, $right) {
    if ([bool]$left.exists -ne [bool]$right.exists) { return $false }
    if (!$left.exists) { return $true }
    if ($left.kind -cne $right.kind) { return $false }
    return (ConvertTo-Json -InputObject $left.value -Depth 20 -Compress) -ceq (ConvertTo-Json -InputObject $right.value -Depth 20 -Compress)
}
function GuardedSet($key, $name, $image) {
    if (!$image.exists) { $key.DeleteValue($name, $false); return }
    $value = $image.value
    switch ($image.kind) {
        'DWord' { $value = [int]$value }
        'QWord' { $value = [long]$value }
        'Binary' { $value = [byte[]]$value }
        'MultiString' { $value = [string[]]$value }
        'String' { $value = [string]$value }
        'ExpandString' { $value = [string]$value }
        default { Fail 'unsupported-registry-kind' 0 'guarded-preflight' }
    }
    $kind = [Microsoft.Win32.RegistryValueKind][Enum]::Parse([Microsoft.Win32.RegistryValueKind], $image.kind)
    $key.SetValue($name, $value, $kind)
}
function GuardedPath($relative) {
    return $request.storage.key + '\' + $relative
}
function GuardedCheckAvailable {
    if ($writeClock.Elapsed.TotalSeconds -gt 30) { Fail 'registry-operation-timeout' 0 'guarded-deadline' }
    if ($request.ownerProcessId) {
        try { [Diagnostics.Process]::GetProcessById([int]$request.ownerProcessId).Dispose() } catch {
            Fail 'registry-caller-exited' 0 'guarded-cancellation'
        }
    }
    if ((AppState) -ne 'closed' -or (LockPresent)) { Fail 'registry-in-use' 0 'guarded-availability' }
}
function GuardedWritable {
    $full = $request.storage.key
    while ($full) {
        $read = $base.OpenSubKey($full, $false)
        if ($read) {
            $read.Dispose()
            $write = $base.OpenSubKey($full, $true)
            if (!$write) { Fail 'registry-permission-denied' 5 'guarded-access' }
            $write.Dispose()
            return
        }
        $index = $full.LastIndexOf('\')
        if ($index -lt 0) { break }
        $full = $full.Substring(0, $index)
    }
    Fail 'registry-permission-denied' 5 'guarded-access'
}
function ApplyGuarded {
    $journal = New-Object System.Collections.ArrayList
    $deleted = New-Object System.Collections.ArrayList
    $created = New-Object System.Collections.ArrayList
    $operations = New-Object System.Collections.ArrayList
    $backupPath = $null
    $beforeKeys = @($keys)
    try {
        GuardedCheckAvailable
        $allowedKinds = @('DWord', 'QWord', 'Binary', 'MultiString', 'String', 'ExpandString')
        foreach ($change in @($request.changes)) {
            ValidateChange $change
            $key = $base.OpenSubKey((GuardedPath $change.path), $false)
            try {
                if ($change.remove) {
                    if (!$key -or $key.SubKeyCount -gt 0) { Fail 'registry-source-changed' 0 'guarded-preflight' }
                    $acl = $key.GetAccessControl()
                    $owner = $acl.GetOwner([System.Security.Principal.SecurityIdentifier])
                    if ($owner -ne [System.Security.Principal.WindowsIdentity]::GetCurrent().User -and
                        $owner -ne [System.Security.Principal.WindowsIdentity]::GetCurrent().Owner) {
                        Fail 'guarded-delete-owner-required' 0 'guarded-preflight'
                    }
                    $verifyRights = $base.OpenSubKey((GuardedPath $change.path),
                        [Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree,
                        [System.Security.AccessControl.RegistryRights]::FullControl)
                    $verifyRights.Dispose()
                    $values = @()
                    foreach ($name in $key.GetValueNames()) {
                        $image = GuardedValue $key $name
                        if ($allowedKinds -notcontains $image.kind) { Fail 'unsupported-registry-kind' 0 'guarded-preflight' }
                        $values += @{ name = $name; image = $image }
                    }
                    [void]$operations.Add(@{ path = $change.path; remove = $true; values = $values; acl = $acl })
                } else {
                    foreach ($property in $change.set.PSObject.Properties) {
                        $old = GuardedValue $key $property.Name
                        if ($old.exists -and $allowedKinds -notcontains $old.kind) { Fail 'unsupported-registry-kind' 0 'guarded-preflight' }
                        $kind = 'String'
                        if ($property.Value -is [int] -or $property.Value -is [long]) { $kind = 'DWord' }
                        [void]$operations.Add(@{ path = $change.path; remove = $false; name = $property.Name; before = $old;
                            after = @{ exists = $true; kind = $kind; value = $property.Value } })
                    }
                    foreach ($name in @($change.unset)) {
                        $old = GuardedValue $key $name
                        if ($old.exists -and $allowedKinds -notcontains $old.kind) { Fail 'unsupported-registry-kind' 0 'guarded-preflight' }
                        [void]$operations.Add(@{ path = $change.path; remove = $false; name = $name; before = $old; after = @{ exists = $false } })
                    }
                }
            } finally { if ($key) { $key.Dispose() } }
        }
        $operationCount = $operations.Count
        foreach ($operation in $operations) { if ($operation.remove) { $operationCount += @($operation.values).Count } }
        if ($operationCount -gt 512) { Fail 'guarded-registry-batch-too-large' 0 'guarded-preflight' }
        $backupPath = SaveRegistryBackup $beforeKeys 'guarded'
        foreach ($operation in $operations) {
            GuardedCheckAvailable
            $full = GuardedPath $operation.path
            if ($operation.remove) {
                $key = $base.OpenSubKey($full, $true)
                try {
                    if (!$key -or $key.SubKeyCount -gt 0 -or $key.ValueCount -ne @($operation.values).Count) {
                        Fail 'registry-source-changed' 0 'guarded-delete'
                    }
                    foreach ($value in $operation.values) {
                        if (!(GuardedValueEqual (GuardedValue $key $value.name) $value.image)) {
                            Fail 'registry-source-changed' 0 'guarded-delete'
                        }
                    }
                } finally { if ($key) { $key.Dispose() } }
                $base.DeleteSubKey($full, $true)
                [void]$deleted.Add($operation)
            } else {
                $key = $base.OpenSubKey($full, $true)
                if (!$key) {
                    if ($operation.before.exists) { Fail 'registry-source-changed' 0 'guarded-set' }
                    $parts = $full.Split('\')
                    $prefix = ''
                    foreach ($part in $parts) {
                        if ($prefix) { $prefix += '\' }
                        $prefix += $part
                        $probe = $base.OpenSubKey($prefix, $false)
                        if ($probe) { $probe.Dispose() } else {
                            # RegCreateKeyEx disposition prevents claiming a concurrently created key as ours.
                            $raw = [IntPtr]::Zero; $disposition = [uint32]0
                            $nativeCode = [PortlineRegistry]::RegCreateKeyEx($nativeRoot, $prefix, 0, $null, 0,
                                (131103 -bor $viewFlag), [IntPtr]::Zero, [ref]$raw, [ref]$disposition)
                            if ($nativeCode -ne 0) { Fail 'registry-operation-failed' $nativeCode 'guarded-create' }
                            [PortlineRegistry]::RegCloseKey($raw) | Out-Null
                            if ($disposition -eq 1) { [void]$created.Add($prefix) }
                        }
                    }
                    $key = $base.OpenSubKey($full, $true)
                }
                try {
                    if (!(GuardedValueEqual (GuardedValue $key $operation.name) $operation.before)) {
                        Fail 'registry-source-changed' 0 'guarded-set'
                    }
                    # Record first: if a native write reports an error after changing a value, rollback still examines it.
                    [void]$journal.Add($operation)
                    GuardedSet $key $operation.name $operation.after
                    if (!(GuardedValueEqual (GuardedValue $key $operation.name) $operation.after)) {
                        Fail 'registry-write-conflict' 0 'guarded-verify'
                    }
                } finally { $key.Dispose() }
            }
        }
        GuardedCheckAvailable
        return @{ ok = $true; backups = @($backupPath); mode = 'guarded' }
    } catch {
        $reason = CurrentFailure $_
        $restored = $true
        $canRollback = $false
        try { $canRollback = (AppState) -eq 'closed' -and !(LockPresent) } catch {}
        if (!$canRollback -and ($journal.Count -gt 0 -or $deleted.Count -gt 0 -or $created.Count -gt 0)) {
            $restored = $false
        } elseif ($canRollback) {
            for ($index = $deleted.Count - 1; $index -ge 0; $index--) {
                if ((AppState) -ne 'closed' -or (LockPresent)) { $restored = $false; break }
                $operation = $deleted[$index]
                try {
                    $full = GuardedPath $operation.path
                    $existing = $base.OpenSubKey($full, $false)
                    if ($existing) { $existing.Dispose(); $restored = $false; continue }
                    $raw = [IntPtr]::Zero; $disposition = [uint32]0
                    $nativeCode = [PortlineRegistry]::RegCreateKeyEx($nativeRoot, $full, 0, $null, 0,
                        (131103 -bor $viewFlag), [IntPtr]::Zero, [ref]$raw, [ref]$disposition)
                    if ($nativeCode -ne 0) { $restored = $false; continue }
                    [PortlineRegistry]::RegCloseKey($raw) | Out-Null
                    if ($disposition -ne 1) { $restored = $false; continue }
                    $key = $base.OpenSubKey($full, $true)
                    try {
                        foreach ($value in $operation.values) { GuardedSet $key $value.name $value.image }
                        $key.SetAccessControl($operation.acl)
                    } finally { $key.Dispose() }
                } catch { $restored = $false }
            }
            for ($index = $journal.Count - 1; $index -ge 0; $index--) {
                if ((AppState) -ne 'closed' -or (LockPresent)) { $restored = $false; break }
                $operation = $journal[$index]
                try {
                    $key = $base.OpenSubKey((GuardedPath $operation.path), $true)
                    try {
                        $current = GuardedValue $key $operation.name
                        if (GuardedValueEqual $current $operation.before) { continue }
                        if (!$key -or !(GuardedValueEqual $current $operation.after)) { $restored = $false; continue }
                        GuardedSet $key $operation.name $operation.before
                    } finally { if ($key) { $key.Dispose() } }
                } catch { $restored = $false }
            }
            for ($index = $created.Count - 1; $index -ge 0; $index--) {
                if ((AppState) -ne 'closed' -or (LockPresent)) { $restored = $false; break }
                try {
                    $full = $created[$index]
                    $key = $base.OpenSubKey($full, $false)
                    $empty = $key -and $key.ValueCount -eq 0 -and $key.SubKeyCount -eq 0
                    if ($key) { $key.Dispose() }
                    if ($empty) { $base.DeleteSubKey($full, $false) } else { $restored = $false }
                } catch { $restored = $false }
            }
        }
        return @{ ok = $false; error = $reason; backups = @($backupPath | Where-Object { $_ });
            recoveryRequired = !$restored; mode = 'guarded' }
    }
}
`;
