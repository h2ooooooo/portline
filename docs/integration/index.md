# Build an integration

This section is for adapter authors and developers embedding Portline's shared infrastructure. To use an existing application library or command, start with [Libraries](/libraries/). For moving a supported saved connection, follow [Workflows](/workflows/).

## Choose the integration task

| Task | Guide |
| --- | --- |
| Query normalized metadata | [Shared API quick start](/integration/api/quick-start) |
| Implement a reader or discovery provider | [Profile/source model](/integration/profiles) and [architecture](/integration/architecture) |
| Resolve credential references explicitly | [Credential providers](/integration/credentials) |
| Embed commands in an executable | [CLI toolkit quick start](/integration/cli/quick-start) |
| Plan sync or implement a native writer | [Sync planning](/integration/sync) and [native writing](/integration/native-writing) |
| Look up public exports and exact types | [API contracts](/integration/reference/api) and [TypeScript signatures](/integration/reference/types) |

## Shared packages

| Package | Responsibility |
| --- | --- |
| `@jalsoedesign/portline-abstract` | Profiles, sources, credentials, writer and provider contracts |
| `@jalsoedesign/portline-core` | Catalogs, queries, credential resolution, connector registration and sync planning |
| `@jalsoedesign/portline-platform` | Native discovery/storage primitives and guarded writer infrastructure |
| `@jalsoedesign/portline-cli` | Embeddable CLI parsing, commands and presentation |

Choose packages based on the [installation guide](/integration/installation). The shared CLI package provides a toolkit; each application repository supplies its own executable.

The complete examples retain TypeScript, JavaScript, MJS and CommonJS tabs, matching run commands and verified output. [Example setup](/integration/examples) explains the language variants. Contributor builds and packed-package checks live under [development](/integration/development).
