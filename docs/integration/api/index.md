# API documentation

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Use Portline to query saved connection metadata, resolve credential references and plan changes between native application settings. Start with an in-memory catalog, then replace it with the application adapter needed.

## Start here

1. [Install the packages](/integration/installation) imported by the code.
2. [Run the quick start](/integration/api/quick-start): complete code, matching commands and deterministic output.
3. [Read and search profiles](/integration/queries), [resolve credentials](/integration/credentials) or [preview a sync](/integration/sync).

## Choose a layer

| Package | Responsibility |
| --- | --- |
| `@jalsoedesign/portline-abstract` | Profile, source, credential, writer and connector-provider contracts |
| `@jalsoedesign/portline-core` | Catalogs, queries, credential resolution, connector registry and sync planning |
| `@jalsoedesign/portline-platform` | Native provenance/discovery primitives and guarded writer infrastructure |
| `@jalsoedesign/portline-cli` | Embeddable command parsing and presentation |

## Go further

Choose an [application adapter](/ecosystem) to read native settings. Learn the [profile model and snapshots](/integration/profiles), review [writing and recovery](/integration/native-writing) before applying changes, and use [method contracts](/integration/reference/api) or [exact declarations](/integration/reference/types) for lookup.

Profiles are metadata. Transport operations, SSH tunnels and SQL execution require a separate implementation. [Architecture and responsibilities](/integration/architecture) explains these boundaries. For terminal integration, use the [CLI documentation](/integration/cli/).
