# Profile writing and one-way sync

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Portline separates native writing from reading and connection execution. Writers support explicit create, update/upsert and delete previews. Nothing is applied by creating or saving a preview.

## CLI workflow

All destination CLIs expose `write`, `sync`, `apply` and the read-only `write-status`: `filezilla-js`, `putty-js` (including `--variant kitty`), `heidisql-js`, `winscp-js`, `openssh-js` and `jsbrains-profiles`. Existing read commands retain their behavior.

For example, copy a saved HeidiSQL SSH tunnel to a WinSCP site:

```sh
winscp-js sync --from heidisql --from-file portable_settings.txt --profile work --connection ssh --target-path Imported --file WinSCP.ini --preview import-preview.json --json
```

Inspect `import-preview.json` before continuing. The source profile is `work` in HeidiSQL; the destination is `Imported` in the WinSCP file. Close both applications before this separate apply command:

```sh
winscp-js apply --file WinSCP.ini --plan import-preview.json --json
```

Install the source adapter alongside the destination CLI. Source packages are selected from a fixed allowlist; the CLI never installs plugins automatically. For unpublished adapters, use the explicit packed-package workflow in the development guide. Source adapters are normal installed dependencies.

`sync` is one-way and uses exact paths. Multi-connection profiles require `--connection`; dependencies of the selected connection remain attached. Database-to-SSH sync normally selects HeidiSQL's `ssh` connection. Sync does not infer that a database endpoint is an SSH server and does not delete other destination profiles.

`write --input profiles.json --preview preview.json` accepts normalized profiles, full normalized CLI records, or `{"mutations": [...]}`. A mutation has `operation`, `path` and (except for delete) `profile`. Supported operations are `create`, `update`, `upsert` and `delete`.

The default profile-write mode is `create`. Existing paths fail rather than overwrite. Use `--mode update` or `--mode upsert` explicitly, and repeat that policy when applying the preview. `--allow-lossy` acknowledges supported metadata omissions, such as transfer directories on SSH-only targets; omitted fields are listed. It does not bypass unsupported protocols, ambiguous paths, unresolved native authentication, locks or process checks.

Preview JSON contains sanitized intent, changed field names, target identity, revision, diagnostics and availability. It contains no native configuration bytes or credential values. Preview output files use create-only semantics, so an existing preview is not silently replaced. Applying a saved preview reconstructs the native changes from its intent and rejects changed settings or an edited preview. The digest detects accidental edits; it is not an authentication signature.

Explicit destinations are required for reproducible workflows: `--file`, `--directory`, `--registry` and `--registry-view` where supported. JetBrains global writes use `--config`; project writes require `--scope project --project <directory>`. JetBrains target paths are `global/ssh/<id>`, `global/deployments/<id>` or the corresponding `project/...` paths. The selected IDE config's `options` directory or project's `.idea` directory must already exist.

## SDK: preview, review, apply

This adapter recipe requires the HeidiSQL and WinSCP core packages plus Portline core. The source file is HeidiSQL's portable settings; the destination file is WinSCP's INI. Both paths are on the host. This is native integration code, separate from the [runnable in-memory preview](/integration/sync).

::: code-group

```ts [TypeScript]
import {planProfileSync} from '@jalsoedesign/portline-core';
import {HeidiSqlProfileSource} from '@jalsoedesign/heidisql-core';
import {WinScpProfileSource, createWinScpWriter} from '@jalsoedesign/winscp-core';

const source = await HeidiSqlProfileSource.fromFile('portable_settings.txt');
const destination = await WinScpProfileSource.fromFile('WinSCP.ini');
const writer = createWinScpWriter(destination.source, {mode: 'create'});

// Read profile work from HeidiSQL and preview its SSH connection at Imported in WinSCP.
const preview = await planProfileSync(source, writer, [{
    sourcePath: 'work',
    connectionId: 'ssh',
    targetPath: 'Imported',
}]);

console.log(preview);
```

```js [JavaScript]
import {planProfileSync} from '@jalsoedesign/portline-core';
import {HeidiSqlProfileSource} from '@jalsoedesign/heidisql-core';
import {WinScpProfileSource, createWinScpWriter} from '@jalsoedesign/winscp-core';

const source = await HeidiSqlProfileSource.fromFile('portable_settings.txt');
const destination = await WinScpProfileSource.fromFile('WinSCP.ini');
const writer = createWinScpWriter(destination.source, {mode: 'create'});

// Read profile work from HeidiSQL and preview its SSH connection at Imported in WinSCP.
const preview = await planProfileSync(source, writer, [{
    sourcePath: 'work',
    connectionId: 'ssh',
    targetPath: 'Imported',
}]);

console.log(preview);
```

```js [MJS]
import {planProfileSync} from '@jalsoedesign/portline-core';
import {HeidiSqlProfileSource} from '@jalsoedesign/heidisql-core';
import {WinScpProfileSource, createWinScpWriter} from '@jalsoedesign/winscp-core';

const source = await HeidiSqlProfileSource.fromFile('portable_settings.txt');
const destination = await WinScpProfileSource.fromFile('WinSCP.ini');
const writer = createWinScpWriter(destination.source, {mode: 'create'});

// Read profile work from HeidiSQL and preview its SSH connection at Imported in WinSCP.
const preview = await planProfileSync(source, writer, [{
    sourcePath: 'work',
    connectionId: 'ssh',
    targetPath: 'Imported',
}]);

console.log(preview);
```

```js [CommonJS]
const {planProfileSync} = require('@jalsoedesign/portline-core');
const {HeidiSqlProfileSource} = require('@jalsoedesign/heidisql-core');
const {WinScpProfileSource, createWinScpWriter} = require('@jalsoedesign/winscp-core');

const source = await HeidiSqlProfileSource.fromFile('portable_settings.txt');
const destination = await WinScpProfileSource.fromFile('WinSCP.ini');
const writer = createWinScpWriter(destination.source, {mode: 'create'});

// Read profile work from HeidiSQL and preview its SSH connection at Imported in WinSCP.
const preview = await planProfileSync(source, writer, [{
    sourcePath: 'work',
    connectionId: 'ssh',
    targetPath: 'Imported',
}]);

console.log(preview);
```

:::

Review the preview, close both applications and retain the same writer policies before applying. The following is a separate operation using the writer and preview above:

::: code-group

```ts [TypeScript]
await writer.apply(preview);

console.log(writer.backupPaths);
```

```js [JavaScript]
await writer.apply(preview);

console.log(writer.backupPaths);
```

```js [MJS]
await writer.apply(preview);

console.log(writer.backupPaths);
```

```js [CommonJS]
await writer.apply(preview);

console.log(writer.backupPaths);
```

:::

Factories are `createFileZillaWriter`, `createPuttyWriter`, `createHeidiSqlWriter`, `createWinScpWriter`, `createOpenSshWriter` and `createJetBrainsWriter`. PuTTY's factory uses the selected source's KiTTY variant. They return the shared `NativeProfileWriter`. `planChanges` supports explicit deletes; no sync pruning occurs. SDK callers may serialize a preview and later use `writer.importPlan(document)` before `apply`.

Backend injection is available for testing or hosts providing their own guarded transaction implementation. It is a trusted host extension, not a CLI force/bypass option.

## Native formats and preservation

| Application | Writable native storage | Projection boundaries |
| --- | --- | --- |
| FileZilla | Site Manager XML | SSH/SFTP and FTP/TLS; absolute POSIX remote directories |
| PuTTY | Registry and .reg exports | Direct SSH; unknown portable fork formats are refused |
| KiTTY | Registry, .reg exports, Sessions directory files | Direct SSH; encrypted savemode=file snapshots remain unsupported |
| HeidiSQL | Portable typed settings, registry and .reg exports | TCP MySQL/PostgreSQL/MSSQL and one SSH tunnel; SSH-only imports update an existing database session |
| WinSCP | INI, registry and .reg exports | SFTP, FTP/TLS and one SSH tunnel; unsupported protocols/TLS policy conversions are refused |
| JetBrains | Global/project `webServers.xml` and `sshConfigs.xml` | Direct SSH/SFTP and supported FTP settings; deployment mapping changes require separate native handling |
| OpenSSH | Explicit config file | Creates/updates/deletes Portline-managed literal Host blocks; existing unmanaged/shared blocks are refused |

Registry writes default to native Windows transactions. If a host cannot provide them, apply reports the native error and refuses; it never automatically switches policies. `write-status` reports application, lock and registry availability without changing settings.

For hosts without working registry transactions, explicitly select `--registry-mode guarded` (SDK: `registryMode: 'guarded'`). This policy uses ordinary registry access with revision checks, application/lock checks before each operation, a cooperative writer mutex, a flushed DPAPI backup and conditional rollback. It supports at most 512 value operations per commit and a 30-second mutation deadline. Deleting a profile requires a leaf key owned by the current token and full-control access so rollback can restore its values and ACL. Unsupported value kinds are refused before mutation.

Guarded mode is **not atomic**: readers can observe a partial update, and checks cannot eliminate races with other writers. Keep the application and other settings writers closed throughout apply. Rollback only restores values that still match this operation's after-image; it retains detected foreign edits. If an application opens, a lock appears or rollback conflicts, the error reports `recoveryRequired` and retained backup paths. No policy bypasses application or lock checks.

The selected policy is bound to the saved preview. Pass `--registry-mode guarded` for both preview and apply; a transactional writer refuses a guarded preview. File destinations reject this registry-only option.

~~~sh
putty-js write-status --registry 'HKCU\Software\SimonTatham\PuTTY\Sessions' --registry-mode guarded --json
putty-js write --registry 'HKCU\Software\SimonTatham\PuTTY\Sessions' --registry-mode guarded --input profiles.json --preview plan.json --json
```

Review `plan.json` and keep the application closed. Then apply with the same registry policy:

```sh
putty-js apply --registry 'HKCU\Software\SimonTatham\PuTTY\Sessions' --registry-mode guarded --plan plan.json --json
~~~

Windows can report `ERROR_RM_NOT_ACTIVE` (6801) for registry transactions even when ordinary access works. Transactional writes refuse that capability error without an automatic downgrade. Guarded mode is an explicit alternative with weaker atomicity, as described above. See the [native API contract](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regopenkeytransactedw). Test transaction support on the target Windows system before relying on transactional apply.

Updates preserve unrelated native settings. INI/registry-export/portable text edits retain unrelated lines; XML serialization may change formatting while retaining unrelated elements, attributes and comments. JetBrains deployment updates detach the selected deployment from a shared SSH reference instead of modifying other deployments using that reference. Deleting a profile is explicit; folders are not recursively pruned.

Stored passwords, passphrases, private key contents and host trust policies are not copied. Input fields outside the normalized contract are discarded. Existing target credentials are retained only when the adapter can preserve the relevant identity; invalidated credentials are cleared or disabled. Password Safe entries are never created or deleted. Concrete key paths are copied; relative paths need a known base directory. OpenSSH destinations reject PPK keys until they have been converted separately.

## Apply-time protection and recovery

The built-in commit backend currently requires Windows. On other platforms, read/preview remains available for files, but apply refuses unknown availability. There is no `--force` option.

Before apply, Portline rechecks the destination revision, application state and lock availability. A whole relevant application process blocks writes, including FileZilla with Site Manager open. Known lock markers such as JetBrains `.lock` and per-file `.lock`/`.lck` also block writes, even if they may be stale. Portline does not remove native locks, terminate applications, or acquire FileZilla's internal IPC mutex. Executables with custom names should be identified through the source's executable metadata; this is conservative process inspection, not a universal application-start interlock.

Windows file commits acquire exclusive OS handles before comparing bytes, retain them through backup/write/rollback, and recheck process/lock state before and after mutation. A concurrently created destination fails its create-only claim. KiTTY nested directory creation stays inside the selected Sessions directory. Linked/reparse targets are refused. Transactional registry commits use transacted native APIs for every accessed key; guarded registry commits require explicit selection as described above.

File updates happen under exclusive handles rather than an atomic file replacement. Detected failures trigger rollback. A process/system crash can still interrupt a multi-file write; retained backups provide recovery. Backups live under `%LOCALAPPDATA%\Portline\backups`. File backups and their target-to-backup manifests have a current-user-only ACL; registry backups are protected with Windows DPAPI for the current user. Apply reports backup paths, and SDK writers expose `backupPaths`. Restore only with the application closed, using the manifest to identify the target and the same guarded checks.

The tests use synthetic settings and disposable registry keys. They cover preview redaction, native preservation, stale/tampered plans, busy/unknown state, held file handles, nested file creation/deletion, rollback, registry capability refusal and packed cross-app CLI sync.


## Write input and recovery data

Write inputs need normalized connection intent, including path and connections. Compact list summaries are not write intents. Full normalized Portline CLI records can supply this structure, but FileZilla’s legacy native get/list JSON is a different shape; use `FileZillaProfileSource` or `sync --from filezilla` for that conversion. The writer ignores presentation fields and removes secret values from accepted intent.

Sync does not copy credential values between profiles. Recovery backups are different: they contain the original native settings and can include stored or obfuscated credentials. File backups are protected by current-user ACLs; registry backups use current-user DPAPI. Keep them private and retain them when recovery is required.

The writer accepts a supported intent subset, not a lossless export of every `ConnectionProfile` or native setting. Authentication method kinds and concrete key paths are projected where supported; credential values/references, agent socket selectors and arbitrary native options are not copied as transport policy. Inspect the preview and the target adapter’s format limits. A `registryMode` field in a file preview does not make file writes registry transactions or atomically replace files; the file backend remains the exclusive-handle/backup/rollback path described above.
