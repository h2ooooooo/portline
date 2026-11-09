# Profiles and credentials

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

## Profile identity and provenance

A `ConnectionProfile` has a source-scoped id, canonical path, display name, source reference, connection list and diagnostics. Optional local directories retain their path format and base directory. A `SourceReference` can describe file, directory or registry storage, application version, scope and executable metadata when actually known.

Do not merge unrelated installations implicitly. Discovery returns candidates and a selected ID only when a choice is established by explicit input, a running application, its default or the only candidate.

## Connections and SSH hops

Connections distinguish SSH/SFTP, FTP/TLS, database and unsupported protocols. Endpoints include host, port and optional username. FTP TLS policy remains explicit: `none`, `explicit`, `implicit` or ambiguous `optional`. FTP `passive` and file `filenameEncoding` preserve saved execution intent. SSH definitions may include canonical SHA256 fingerprint pins. Nonempty `unsupportedOptions` records native settings a bridge must refuse rather than ignore. Database and SSH authentication are independent.

A connection's `via` list refers to SSH-hop IDs in the same profile. Sync validates missing or cyclic dependencies. A database endpoint is never inferred to be an SSH server. The shared execution bridge currently refuses selected connections with nonempty `via`; preserving hop metadata does not implement a tunnel.

## Credentials remain references

Authentication methods contain password/passphrase references, key metadata, agent methods, distinct `prompt-password` and keyboard-interactive methods or an explicit unsupported native method. References identify the owning source and credential kind. They do not contain secret values.

`CredentialResolver` registers a provider per source ID and resolves a reference explicitly without caching cleartext. States distinguish available, not-stored, locked, unavailable and unsupported. An available reference can still fail when its native store changes or cannot be unlocked.

Never log the value of an available `CredentialResult`. Raw native settings are a separate opt-in API and can contain secrets. Key paths can be projected without reading private-key contents; conversion and encrypted export belong to dockline-keys.

## Querying and execution

`ProfileCatalog` and the generic query functions operate on metadata. Connector factories/registries permit arbitrary connector results, such as transfers, command sessions or tunnels; registration does not implement a transport. Use separate capability providers rather than placing an SQL or SSH implementation inside a profile reader.

## Executable capability is separate

The optional [Portline Dockline bridge](/integration/execution) maps supported normalized FTP, SFTP and SSH definitions for every application reader. It supplies `toConfig`, `toSshConfig`, `createFileAdapter`, `withFiles` and `withSsh`. Select the source/connection explicitly, supply credentials and trust, and install the protocol client used. Per-reader FileZilla FTP/SFTP factories have been removed. Generic registries remain extension contracts rather than implementations. SSH-hop execution, SQL and database import/export remain outside this bridge.

## Snapshots and native data

A normalized profile source is a metadata snapshot, not a filesystem watcher or live authenticated session. Reopen/reconstruct it to refresh changed native settings or rerun discovery. Reading the selected native file or registry values can read password-bearing bytes; metadata-only means the normalized output omits credential values and key contents, not that native credential bytes were never read.

Raw native settings access is explicit. HeidiSQL and WinSCP sources retain native settings snapshots and decode supported stored values on explicit resolution; a source instance does not automatically refresh those bytes. `FileZillaProfileSource.fromFile` uses a selected-profile loader for explicit credential resolution, while the legacy `SiteManager`/CLI have their separately documented loading defaults. `CredentialResolver` does not cache resolved cleartext, but that is not a memory-erasure guarantee for native snapshots or caller-held results.
