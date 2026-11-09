# Portline connection profiles

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Portline is the family name for the saved-connection libraries and their integrations. Its shared profile library lives in the independent Portline repository as five npm workspaces:

| Package | Role |
| --- | --- |
| `@jalsoedesign/portline-abstract` | Source/profile contracts, endpoints, authentication references, SSH-hop relationships and unconstrained connector factories |
| `@jalsoedesign/portline-core` | Queries, profile catalogs, credential resolution and connector registries |
| `@jalsoedesign/portline-cli` | Reusable CLI parsing, commands and presentation |
| `@jalsoedesign/portline-dockline` | Optional normalized FTP/SFTP/SSH execution with selected Dockline clients |
| `@jalsoedesign/portline-platform` | Native storage, injectable discovery, catalogs and guarded profile writing |

The shared packages are released independently of application adapters. Runtime dependencies use ordinary npm ranges; unpublished dependency development uses explicit tarballs.

## Package naming

Names follow the existing `@jalsoedesign/<family>-<role>` convention: `portline-abstract`, `portline-core`, `portline-platform`, `portline-cli` and the optional `portline-dockline`. Existing `filezilla-*` and `dockline-*` package identities are retained. Public API compatibility follows each package’s version. Future application packages can follow the same application/role convention, with Portline as their umbrella family.

Dockline defines `dockline-abstract`, `dockline-core`, `dockline-cli`, `dockline-ftp-client`, `dockline-sftp-client`, `dockline-ssh-client` and `dockline-keys`. The SSH client describes SSH execution, sudo scopes and file transfers. Transport integrations can use that client for SSH execution. Additional capability support must be verified against its actual API.

## Dependency direction

```text
portline-abstract
    ↑ portline-core
        ↑ portline-cli

filezilla-core → portline-core + abstract
portline-dockline → portline-abstract + Dockline core/contracts + optional selected client
filezilla-cli → portline-cli + FileZilla source + optional shared execution bridge
```

The profile contracts, core, platform and CLI do not import native application readers or transports. The optional `portline-dockline` package maps normalized execution definitions to Dockline and loads only the explicitly selected protocol client. Shared abstract and core output CommonJS so existing CommonJS FileZilla consumers continue to work. Shared CLI uses ESM, matching FileZilla CLI and Chalk.

## Storage selection and discovery

Source references can describe file, directory and registry storage, including the registry hive and 32/64-bit view. They can report an application version and executable path when discovery actually establishes those values. `ProfileSourceDiscovery` reports candidates, an optional selected source and whether selection came from an explicit choice, a running application, its default configuration or the only candidate. Ambiguous installations should remain unselected.

`filezilla-js source --json` reports the selected FileZilla XML location and storage backend. The sibling readers use shared registry/portable discovery and report executable versions when known. They identify the selected backend instead of merging registry and portable settings implicitly.

## Profiles and native configuration

A normalized `ConnectionProfile` has a source-scoped ID, canonical path, name, source provenance, connections, optional local directory and diagnostics. Connection definitions distinguish SSH/SFTP, FTP/TLS and database endpoints. Unsupported protocols remain explicit rather than being silently treated as SSH. SSH-hop IDs in `via` preserve database/tunnel relationships; database credentials and SSH credentials remain independent.

These relationships are data contracts. Readers normalize PuTTY, HeidiSQL, JetBrains and other applications; SSH execution, tunnel creation and database drivers remain separate capabilities. The optional [shared Dockline bridge](/integration/execution) maps normalized FTP, SFTP and SSH definitions. SSH hops, unsupported native options and ambiguous TLS require explicit resolution; the bridge does not execute tunnels or database drivers.

Native configuration remains available through FileZilla's existing `Server`, `SiteManager`, enums and property APIs. Numeric protocols and encoded source paths are interpreted by FileZilla adapters, not the common packages. The normalized projection distinguishes optional, explicit and implicit FTP TLS. Unsupported remote-directory decoding produces a diagnostic and an execution blocker; it does not fabricate a decoded path. FileZilla saved FTP and FTPES map to required explicit TLS; only the saved insecure protocol maps to plaintext.

## Credentials and native adapters

Register an adapter's credential provider with `CredentialResolver` and resolve the selected connection's reference explicitly. The [credential guide](/integration/credentials) has a runnable example and explains returned states and secret lifetime.

FileZilla's legacy native APIs retain their separately documented credential defaults. Its normalized source and connection-check path use explicit credential resolution. The normalized source searches metadata without resolving secrets. Refer to the [FileZilla API documentation](https://h2ooooooo.github.io/filezilla-js/api/) for its selected-profile loader and native compatibility behavior.

Private-key paths retain saved spelling, format and base-directory metadata. Normalization does not read key files, convert keys or import trust policies.

## CLI compatibility and extensions

`filezilla-cli` remains the package providing the `filezilla-js` executable and `run()` API. Its source adapter preserves:

- Full native properties and numeric protocol values in full records.
- Existing compact/search JSON shapes, exact-path selection, native folder decoding and recursive `servers` arrays.
- CLI help, permissive unknown query flags, error messages and password flags.
- Private-key/remote-directory output and the single highlighted hidden-password footer.
- The application-specific `check` command and its exported check types/functions.
- Existing `dist/types` and `dist/commands/list`, `get` and `search` exports as compatibility wrappers.

The shared engine accepts custom field labels, secret fields, source flags, nouns, help and command handlers. The new application CLIs use the same commands while adapting native settings and adding application-specific operations.

Application readers provide complete normalized execution metadata and explicit credential providers. The shared `DocklineBridge` supplies `toConfig`, `toSshConfig`, `createFileAdapter`, `withFiles` and `withSsh`. Per-reader FTP/SFTP factory packages are removed; generic factories and registries remain extension contracts for other capabilities.

## Profile writing and lock checks

Native writer factories and the shared preview/sync/apply workflow are now available. See [profile writing and one-way sync](/integration/native-writing) for format support, native lock checks, recovery and current registry transaction limitations. Reading remains independent of writing.

## Repository boundaries and validation

The shared packages live in the independent Portline repository. See [separate-repository development](/integration/development) for independent builds and checks. Application packages stay in their own repositories.

## Native readers and CLIs

The [ecosystem directory](/ecosystem) is the canonical list of repositories, packages and documentation.

The application binaries are `putty-js`, `heidisql-js`, `openssh-js`, `winscp-js` and `jsbrains-profiles`. They share search, list, get and source commands, plus sources for discovery. Existing `filezilla-js` and `jsbrains` commands remain available. The original `jsbrains` library and CLI retain their Node 20 requirement; the optional bridge and other Portline application packages require Node 22.22.2.

Windows readers accept `--file`, `--registry`, `--registry-view` and `--executable`; PuTTY/KiTTY also accept `--directory` and `--variant` kitty. OpenSSH accepts `--file` and `--system-file`. JetBrains accepts `--config`, `--project`, `--product` and `--version`. Use sources `--json` to inspect candidates and `--source` &lt;id&gt; to select one. Source output reports the storage, executable and version when established. Unknown running storage is left unselected. Multiple IDE installations require selection; the bridge does not guess a running IDE from a versioned config folder.

Native settings remain opt-in through `getNativeSettings`(). They can contain saved secrets. Normalized profiles and default CLI JSON contain references and metadata, not raw native settings. Explicit `--show-password` resolves matching credentials and reports their states, including tunnel credentials and passphrases. Resolvers do not cache cleartext.

HeidiSQL historical ANSI/Unicode obfuscation and WinSCP internal password formats are supported. WinSCP external/master-password blobs remain locked. KiTTY saved password formats and encrypted savemode=file snapshots remain unsupported. Official PuTTY itself uses registry storage; file storage belongs to forks, which require a known native format or explicit selection. Unknown native terminal/proxy/advanced settings are retained without claiming they have normalized transport equivalents.

OpenSSH preserves ordering and unknown directives. The safe projection supports Host patterns/negations, first-value precedence, Include globs, repeated identity paths and ProxyJump hops. Match, ProxyCommand, certificate and canonicalization handling requires native OpenSSH evaluation and produces diagnostics. Saved commands are never executed. The reader is not a replacement for ssh -G. Non-TCP database sessions and unsupported transfer protocols stay explicit unsupported projections.

Readers remain read-only. Optional writers implement explicit preview/apply and one-way sync with guarded native storage access. SQL execution is outside these profile libraries; SSH execution and transfers use Dockline; see [profile writing](/integration/native-writing).

### Development and release checks

See [development](/integration/development) for independent builds and validation.

Native format references: [HeidiSQL portable mode](https://www.heidisql.com/help.php#portable), [WinSCP storage](https://winscp.net/eng/docs/config), [OpenSSH configuration](https://man.openbsd.org/ssh_config), [KiTTY portable storage](https://github.com/cyd01/KiTTY/blob/master/kitty_store.c).
