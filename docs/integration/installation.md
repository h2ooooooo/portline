# Installation

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Choose the package needed by the code being written:

| Task | Install |
| --- | --- |
| Query profiles, resolve references or plan sync | `npm install @jalsoedesign/portline-core` |
| Import profile and provider types directly | `npm install @jalsoedesign/portline-abstract` |
| Implement native discovery or a guarded writer | `npm install @jalsoedesign/portline-platform` |
| Embed command parsing and presentation | `npm install @jalsoedesign/portline-cli` |
| Map a supported normalized profile without connecting | `npm install @jalsoedesign/portline-dockline` |
| Connect for FTP/FTPS files | `npm install @jalsoedesign/portline-dockline @jalsoedesign/dockline-ftp-client` |
| Connect for SFTP files | `npm install @jalsoedesign/portline-dockline @jalsoedesign/dockline-sftp-client` |
| Run SSH commands | `npm install @jalsoedesign/portline-dockline @jalsoedesign/dockline-ssh-client` |

Install packages that the code imports directly. Internal dependencies are installed by npm. For native saved settings, choose an [application adapter](/ecosystem); the shared packages do not install application readers or executables automatically.

The bridge installs its shared Dockline contracts/SDK dependencies, with protocol clients as optional peers. Metadata-only readers do not depend on those clients. Configuration mapping works without a client; an explicit connection operation reports a missing-client installation command. The SSH client includes SFTP support for its own file helpers. Install each package imported directly.

## First program

Follow the [API quick start](/integration/api/quick-start) for an in-memory catalog or the [CLI toolkit quick start](/integration/cli/quick-start) for a command. The [shared execution guide](/integration/execution) adds a complete no-network configuration example plus scoped file/SSH recipes. Complete programs include TypeScript, JavaScript, MJS and CommonJS, matching commands and output. [Language setup](/integration/examples) explains the filenames and tooling.

## Runtime and platform support

Node.js 22.22.2 or newer is required. The shared packages include TypeScript declarations. Abstract, core, platform and the Dockline bridge provide CommonJS-compatible exports; CLI is ESM. Node.js 22.22.2 supports the documented CommonJS CLI example through synchronous ESM loading.

In-memory querying and file projections work independently of native application processes. Live Windows registry/process inspection and the built-in native commit backends require Windows. File reads and previews remain available elsewhere; native apply refuses unknown availability. See [writing and recovery](/integration/native-writing).

Contributor installation and packed-package workflows are in [development](/integration/development).
