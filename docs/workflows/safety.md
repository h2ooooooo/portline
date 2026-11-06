# Write safety and recovery

Preview and apply are separate operations. Reading profiles and saving previews do not change native settings; apply performs the guarded commit.

## Before applying

1. Select an explicit destination and review the preview's changes and diagnostics.
2. Close the destination application and other settings writers. For cross-application workflows, close both applications before apply.
3. Apply with the same destination and policies used for the preview.
4. Retain reported backup paths and inspect any recovery instructions.

Application process checks are conservative: FileZilla running with Site Manager open blocks writing. Known lock markers also block apply, including potentially stale markers. Portline does not remove locks or terminate applications.

## Changed or unavailable settings

Apply rechecks the destination revision and availability. Changed bytes, edited plans, an open application, locks or unknown availability cause refusal. There is no `--force` bypass. Checks reduce races but cannot provide a universal interlock against an application starting later.

Built-in commit backends currently require Windows. Supported file reads and previews remain available elsewhere; native apply refuses unknown availability.

## Files and registry writes

File commits use exclusive handles, backups and rollback. A crash can still interrupt a multi-file change. Registry writes default to Windows transactions and refuse capability errors rather than changing policy automatically.

An explicitly selected guarded registry mode is available where supported. It uses backups and conditional rollback but is not atomic: another reader can observe a partial change. See [registry policies and limits](/integration/native-writing#native-formats-and-preservation) before choosing it.

## Backups and credentials

Native backups can contain stored or obfuscated credentials even though sync previews exclude credential values. Keep backups private. File backups use current-user ACLs; registry backups use current-user DPAPI.

Errors requiring recovery identify retained backup paths. Keep the application closed and follow [apply-time protection and recovery](/integration/native-writing#apply-time-protection-and-recovery). Do not retry a failed write blindly.

For supported formats, preservation behavior and SDK details, use the [native writing guide](/integration/native-writing).
