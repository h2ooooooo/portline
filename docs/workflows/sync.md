# Preview a one-way sync

Copy a supported saved connection between application settings in two stages: create and inspect a preview, then apply it explicitly. The destination CLI owns the operation and its native writer.

## Example: HeidiSQL SSH tunnel to WinSCP

Install the destination CLI and source adapter in the same project/environment:

```sh
npm install @jalsoedesign/winscp-cli @jalsoedesign/heidisql-core
```

The commands below are native-settings templates. They require an existing HeidiSQL portable settings file and WinSCP INI, both on the host. They are not connected-server tests.

| Role | Value |
| --- | --- |
| Source settings | `./portable_settings.txt`, read by HeidiSQL's adapter |
| Source profile and connection | Profile `work`, connection `ssh` |
| Destination settings | `./WinSCP.ini`, written by WinSCP's adapter |
| Destination profile | `Imported`, a saved profile path |
| Preview file | `./import-preview.json`, a new file on the host |

### Create a preview

```sh
npx winscp-js sync --from heidisql --from-file ./portable_settings.txt --profile work --connection ssh --target-path Imported --file ./WinSCP.ini --preview ./import-preview.json --json
```

Inspect the emitted JSON and saved preview. It describes the destination, revision, planned changes, diagnostics and availability. Creating the preview does not change WinSCP settings. The preview file must not already exist.

### Review before applying

Confirm that `Imported` is the intended new destination profile. The default mode creates profiles and refuses an existing target. Metadata omissions require the supported explicit loss policy; unsupported protocols or unsafe availability still cause refusal.

The preview does not copy passwords, passphrases or host trust policies. Inspect authentication and key paths separately. Close applications and other settings writers before applying, and review [write safety and recovery](/workflows/safety).

### Apply separately

```sh
npx winscp-js apply --file ./WinSCP.ini --plan ./import-preview.json --json
```

Apply rechecks native revision, process and lock state and reports retained backups. A changed source, edited preview or unsafe state is refused; inspect the error before creating a fresh preview. Built-in apply currently requires Windows.

## Other source and destination pairs

Choose supported adapters from the [library directory](/libraries/) and compare their [write boundaries](/libraries/compare#authentication-and-writes). Install the source adapter alongside the destination CLI; source imports use a fixed allowlist. Multi-connection profiles require explicit connection selection, and required SSH hops stay attached. Sync does not prune unrelated destination profiles.

For complete policies and registry modes, see [native writing and recovery](/integration/native-writing). For SDK integration, use the [planning API](/integration/sync).
