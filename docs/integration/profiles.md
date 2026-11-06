# Profiles and credentials

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

## Profile identity and provenance

A `ConnectionProfile` has a source-scoped id, canonical path, display name, source reference, connection list and diagnostics. Optional local directories retain their path format and base directory. A `SourceReference` can describe file, directory or registry storage, application version, scope and executable metadata when actually known.

Do not merge unrelated installations implicitly. Discovery returns candidates and a selected ID only when a choice is established by explicit input, a running application, its default or the only candidate.

## Connections and SSH hops

Connections distinguish SSH/SFTP, FTP/TLS, database and unsupported protocols. Endpoints include host, port and optional username. FTP TLS policy remains explicit. Database and SSH authentication are independent.

A connection's `via` list refers to SSH-hop IDs in the same profile. Sync validates missing or cyclic dependencies. A database endpoint is never inferred to be an SSH server.

## Credentials remain references

Authentication methods contain password/passphrase references, key metadata, agent/interactive methods or an explicit unsupported native method. References identify the owning source and credential kind. They do not contain secret values.

`CredentialResolver` registers a provider per source ID and resolves a reference explicitly without caching cleartext. States distinguish available, not-stored, locked, unavailable and unsupported. An available reference can still fail when its native store changes or cannot be unlocked.

Never log the value of an available `CredentialResult`. Raw native settings are a separate opt-in API and can contain secrets. Key paths can be projected without reading private-key contents; conversion and encrypted export belong to dockline-keys.

## Querying and execution

`ProfileCatalog` and the generic query functions operate on metadata. Connector factories/registries permit arbitrary connector results, such as transfers, command sessions or tunnels; registration does not implement a transport. Use separate capability providers rather than placing an SQL or SSH implementation inside a profile reader.

## Executable capability is separate

A normalized profile is not a Dockline connection configuration. There is no built-in universal provider that executes every application profile or opens its `via`/ProxyJump tunnel chain. Callers must select a supported connection, map its settings, resolve credentials explicitly and provide trust policy. FileZilla supplies saved-site factories; generic Portline registries only dispatch providers that the caller registers. SQL execution and database import/export remain outside these libraries.

## Snapshots and native data

A normalized profile source is a metadata snapshot, not a filesystem watcher or live authenticated session. Reopen/reconstruct it to refresh changed native settings or rerun discovery. Reading the selected native file or registry values can read password-bearing bytes; metadata-only means the normalized output omits credential values and key contents, not that native credential bytes were never read.

Raw native settings access is explicit. HeidiSQL and WinSCP sources retain native settings snapshots and decode supported stored values on explicit resolution; a source instance does not automatically refresh those bytes. `FileZillaProfileSource`.fromFile uses a selected-profile loader for explicit credential resolution, while the legacy `SiteManager`/CLI have their separately documented loading defaults. `CredentialResolver` does not cache resolved cleartext, but that is not a memory-erasure guarantee for native snapshots or caller-held results.
