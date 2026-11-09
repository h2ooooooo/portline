# Portline Abstract

Application-independent contracts for saved connection profiles, sources, credential references, writers and connector providers. This package has no application-reader or Dockline dependency.

`ConnectionProfile` contains metadata and credential references, never passwords, passphrases or private-key contents. Each profile can contain SSH/SFTP, FTP/TLS, database or unsupported connection definitions. SSH hops in `via` describe relationships; they do not open tunnels.

Execution metadata includes FTP `passive` intent, `filenameEncoding`, distinct `prompt-password` and keyboard-interactive authentication, optional canonical SHA256 fingerprint pins and `unsupportedOptions` that an executor must refuse. Readers interpret native settings and retain diagnostics rather than inventing supported behavior.

`ProfileSource` supports synchronous or asynchronous list, exact-path get and search. `CredentialProvider` resolves one reference explicitly. `ProfileConnectorFactory` is a generic extension contract; it does not map profiles or implement a transport.

Use the optional [Portline Dockline bridge](https://h2ooooooo.github.io/portline/integration/execution) for shared supported file/SSH execution. See [profiles and snapshots](https://h2ooooooo.github.io/portline/integration/profiles), [exact types](https://h2ooooooo.github.io/portline/integration/reference/types) and the [ecosystem directory](https://h2ooooooo.github.io/portline/ecosystem).
