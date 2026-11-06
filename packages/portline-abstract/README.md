# Portline Abstract

Shared contracts for saved connection profiles, source adapters, credential references and connector factories.

Independent shared contracts with no FileZilla, Dockline or transport dependency.

`ConnectionProfile` contains metadata and credential references, never secret values. Each profile may contain several `ConnectionDefinition` records, including a database endpoint and independently authenticated SSH hops referenced by `via`. Source-native configuration remains the source adapter's responsibility.

`ProfileSource` supports synchronous or asynchronous list, exact-path get and substring search. Its optional generic parameter permits native compatibility adapters. `ProfileConnectorFactory` accepts arbitrary connector results, including tunnels and command sessions rather than only storage adapters.

See [the architecture and migration notes](../../docs/connection-profiles.md).

[Related libraries and applications](https://h2ooooooo.github.io/portline/ecosystem).
