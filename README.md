**[Read the documentation](https://h2ooooooo.github.io/portline/)**

# Portline

Portline is the saved-connection library family for FileZilla, PuTTY/KiTTY, HeidiSQL, JetBrains, OpenSSH and WinSCP. Start with the [application libraries](https://h2ooooooo.github.io/portline/libraries/) or [cross-application workflows](https://h2ooooooo.github.io/portline/workflows/).

This repository contains the five shared packages used by those independent application repositories. Adapter authors can use [Build an integration](https://h2ooooooo.github.io/portline/integration/) for contracts, catalogs, CLI embedding and guarded native writes. The optional shared Dockline bridge maps supported normalized connections for execution. Dockline supplies the transports and key conversion.

| Package | Purpose |
| --- | --- |
| `@jalsoedesign/portline-abstract` | Profile, source, credential and connector contracts |
| `@jalsoedesign/portline-core` | Queries, catalogs, credential resolution, registries and sync policy |
| `@jalsoedesign/portline-platform` | Native storage, discovery primitives and guarded preview/apply infrastructure |
| `@jalsoedesign/portline-cli` | CLI parsing, presentation and profile writing commands; no executable |
| `@jalsoedesign/portline-dockline` | Optional normalized FTP/SFTP/SSH execution with selected Dockline clients |

[Browse the ecosystem directory](https://h2ooooooo.github.io/portline/ecosystem). Its source is [ecosystem.json](ecosystem.json); npm releases are independent of directory updates.

## Installation

~~~sh
npm install @jalsoedesign/portline-core@rc @jalsoedesign/portline-platform@rc
~~~

Node 22.22.2 or newer is required. Abstract, core, platform and the Dockline bridge provide CommonJS-compatible exports; CLI is ESM. Profiles contain credential references rather than stored passwords or key contents. For execution, install `@jalsoedesign/portline-dockline` and the selected FTP, SFTP or SSH client; see the [complete execution guide](https://h2ooooooo.github.io/portline/integration/execution).


## Development

~~~sh
npm ci --ignore-scripts
npm run check
npm run docs:build
npm run docs:check
~~~

These commands operate only on this repository. No build searches for or builds other checkouts.

[Architecture](docs/integration/architecture.md) · [Writing safeguards and recovery](docs/integration/native-writing.md) · [Contributing catalog entries](CONTRIBUTING.md)

MIT. See [LICENSE](LICENSE).


[Documentation](https://h2ooooooo.github.io/portline/) · [Quick start](https://h2ooooooo.github.io/portline/integration/api/quick-start) · [API reference](https://h2ooooooo.github.io/portline/integration/reference/api)

## Runnable examples

[Run a local demo](docs/integration/local-demo.md) for one-command examples and captured output. Profile demos use synthetic settings and make no remote connections.

Use the optional [shared Dockline bridge](https://h2ooooooo.github.io/portline/integration/execution) to execute a selected normalized profile. Readers stay independent of protocol clients.

See [First release candidate](RELEASE_RC.md) for RC versions and installation commands.
