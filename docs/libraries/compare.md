# Choose a library

Start with the application that owns the saved settings. Its library understands native names, storage and authentication. The [library directory](/libraries/) links directly to each API and CLI guide.

## Storage and discovery

| Library | Readable settings | Choosing a source |
| --- | --- | --- |
| FileZilla | Site Manager XML | Select the Site Manager file; report its source path |
| PuTTY / KiTTY | Windows registry and registry exports; supported KiTTY Sessions directory files | Discover registry/portable candidates; select variant and storage explicitly when ambiguous |
| HeidiSQL | Windows registry, registry exports and portable typed settings | Discover candidates and select the intended registry or portable store |
| JetBrains / jsbrains | Supported IDE global/project SSH and deployment settings | Discover IDE/config candidates; select product, version and scope as needed |
| OpenSSH | SSH configuration files and supported includes | Select config/system files; inspect diagnostics for directives needing native SSH evaluation |
| WinSCP | INI, Windows registry and registry exports | Discover candidates and select the intended INI or registry store |

Discovery reports candidates and provenance. It does not guarantee that every running installation reveals its active settings path. When the source remains ambiguous, select it explicitly. PuTTY's official storage is the registry; portable files depend on the fork and supported format. KiTTY encrypted file snapshots are unsupported.

## Authentication and writes

| Library | Authentication boundary | Native write scope |
| --- | --- | --- |
| FileZilla | Saved credential references and supported explicit resolution; private-key paths | SFTP and FTP/TLS Site Manager profiles |
| PuTTY / KiTTY | Key/authentication metadata; KiTTY saved-password formats are unsupported | Direct SSH in supported registry/export/Session formats |
| HeidiSQL | Database and SSH credentials are separate; supported stored obfuscation can be decoded explicitly | Supported TCP database sessions and one SSH tunnel; SSH-only imports update an existing database session |
| JetBrains / jsbrains | Saved references and credential status; Password Safe behavior depends on the IDE/store | Supported SSH and deployment settings; no Password Safe entry creation/deletion |
| OpenSSH | Identity paths, agent-related metadata and supported jump hosts; key bytes are separate | Portline-managed literal Host blocks in an explicit file |
| WinSCP | Supported internal stored-password formats; external/master-password blobs remain locked | Supported SFTP and FTP/TLS sessions with one SSH tunnel |

These summaries describe supported projections, not every native setting. Unknown or unsupported options can remain available as native data without having a normalized equivalent. Follow the selected adapter's documentation for exact formats and diagnostics.

Native writes use explicit preview/apply. Built-in commit backends currently require Windows and refuse unknown availability elsewhere. See [write safety and recovery](/workflows/safety) before applying. Reading and previewing supported files remains available independently of native apply.

## Choose by task

- **Inspect or query settings:** use the application's API or CLI.
- **Move a supported connection:** follow [cross-application sync](/workflows/sync).
- **Run SSH commands or transfer files:** use the [shared Portline Dockline bridge](/integration/execution) with the selected protocol client.
- **Convert or encrypt a private key:** use [Dockline Keys](/libraries/related#dockline-keys).
- **Implement a new reader or CLI:** use [Build an integration](/integration/).
