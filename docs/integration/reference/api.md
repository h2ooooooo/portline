# API guide

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

For exact parameter/return types and all exports, use the generated [TypeScript reference](/integration/reference/types). The guide below explains how to choose an entry point.

## Contracts: portline-abstract

| Export | Purpose |
| --- | --- |
| `ConnectionProfile` / `ConnectionDefinition` | Normalized saved metadata and supported/unsupported connection kinds |
| `SourceReference` / `ProfileStorage` | Stable source identity and native storage provenance |
| `ProfileSource` / `ProfileSourceDiscovery` | Synchronous or asynchronous reads and explicit discovery results |
| `CredentialReference` / `CredentialProvider` / `CredentialResult` | Source-owned, lazy credential lookup |
| `ProfileWriter` / `ProfileWritePlan` / `ProfileWriteInspection` | Preview/apply contract and availability state |
| `ProfileConnectorFactory` / connector provider contracts | Source-independent connector construction without a storage-only restriction |

## Core: portline-core

| Export | Behavior |
| --- | --- |
| `ProfileCatalog(source, profiles)` | In-memory normalized source with list/get/search and uniqueness validation |
| `searchProfiles` / `getProfileByPath` / `buildProfileTree` | Generic metadata queries using an explicit adapter |
| `CredentialResolver` | Register credential providers by source and resolve without caching secrets |
| `ProfileConnectorRegistry` | Register typed providers by protocol and retain provider-specific options/results |
| `assertProfileWriteAllowed` | Refuse mismatched revision/source and unsafe or unknown write availability |
| `planProfileSync(source, writer, mappings)` | Select profiles and their connection dependencies, then call `writer.plan` |

## Native infrastructure: portline-platform

| Export | Behavior |
| --- | --- |
| `NativeProfileSource` | Catalog plus opt-in raw native settings and explicit secret loader |
| `fileSource` / `registrySource` / `selectSource` / `requireSource` | Construct or select source provenance without hiding ambiguity |
| `discoverNativeSources` | Shared registry/portable candidate discovery with injectable readers |
| `windowsRegistry` / `windowsProcesses` | Windows inspection helpers |
| `NativeProfileWriter` | Sanitized intent, native projection, guarded inspection and commit lifecycle |
| `NativeWriteOptions` / `NativeWritePreview` / `ProfileMutation` | Typed writer policies, saved previews and explicit mutation kinds |
| `RegistryWriteError` / `RegistryWriteMode` | Structured refusal/recovery details and transactional/guarded policy |

Application writer factories supply the selected application and source. `inspect` reports revision and availability; `plan`/`planChanges` produce previews; `importPlan` reconstructs a saved preview; `apply` rechecks guards. `backupPaths` exposes retained recovery files.

Native storage/image/backend contracts are also exported for trusted host integrations. Backend injection is not a CLI force option and does not make arbitrary native writes safe.

## CLI infrastructure: portline-cli

`createProfileCli` builds an embeddable command runner. Its `run(args)` resolves an exit code rather than terminating the host. It supplies `list`, `search`, `get` and `source`, table/JSON presentation, password masking and extension hooks.

`createNormalizedCliSource` adapts a normalized source for presentation. `parseProfileArgs` handles declared common/source options. `createProfileWriteCommands` adds `write`, `sync`, `apply` and `write-status` using a host-provided writer and a fixed allowlist of source adapters.

See [building a CLI](/integration/cli/hooks) and the [writing guide](/integration/native-writing).


## Shared execution: portline-dockline

| Export | Behavior |
| --- | --- |
| `createDocklineBridge(options?)` / `DocklineBridge` | Shared normalized FTP/SFTP/SSH execution with source, credential and trust services |
| `toConfig(input, options?)` | Resolve file configuration, including a bound SFTP trust policy, without loading a protocol client |
| `toSshConfig(input, options?)` | Resolve scalar SSH settings; saved pin-set/callback services are retained by `withSsh` |
| `createFileAdapter(input, options?)` | Load the selected file client and return its disconnected adapter |
| `withFiles(input, callback, options?)` | Run a callback within a Dockline file session and close it on completion/failure |
| `withSsh(input, callback, options?)` | Run a callback within an SSH session with `exec`, `shell` and `asUser` |
| `ExecutionOptions` / `DocklineBridgeOptions` | Connection selection, runtime authentication/trust and supported transport controls |
| `ProfileExecutionError` / `BridgeErrorCode` | Selection, unsupported metadata, missing credentials/trust/client and invalid-profile errors |
| `TrustChallenge` / `TrustProvider` / `PasswordChallenge` | Explicit application callbacks; no automatic persistence |
| `SshConfig` / `SshSession` / `SshExecOptions` / `SshExecResult` | Public structural SSH configuration, scoped command API and results |

All five methods are asynchronous. A string input uses the configured source's exact-path `get`; a direct `ConnectionProfile` needs no source when runtime credentials or a credential provider are supplied. Protocol clients are optional peers. The [execution guide](/integration/execution) documents complete signatures, precedence, client installation, TLS, cancellation and every bridge error code. Generic factory/registry contracts do not replace this concrete shared bridge.
