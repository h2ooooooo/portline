# Installation

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Choose the package needed by the code being written:

| Task | Install |
| --- | --- |
| Query profiles, resolve references or plan sync | `npm install @jalsoedesign/portline-core` |
| Import profile and provider types directly | `npm install @jalsoedesign/portline-abstract` |
| Implement native discovery or a guarded writer | `npm install @jalsoedesign/portline-platform` |
| Embed command parsing and presentation | `npm install @jalsoedesign/portline-cli` |

Install packages that the code imports directly. Internal dependencies are installed by npm. For native saved settings, choose an [application adapter](/ecosystem); the shared packages do not install application readers or executables automatically.

## First program

Follow the [API quick start](/integration/api/quick-start) for an in-memory catalog or the [CLI toolkit quick start](/integration/cli/quick-start) for a command. Both include complete TypeScript, JavaScript, MJS and CommonJS programs, matching commands and output. [Language setup](/integration/examples) explains the filenames and tooling.

## Runtime and platform support

Node.js 22.22.2 or newer is required. The shared packages include TypeScript declarations.

In-memory querying and file projections work independently of native application processes. Live Windows registry/process inspection and the built-in native commit backends require Windows. File reads and previews remain available elsewhere; native apply refuses unknown availability. See [writing and recovery](/integration/native-writing).

Contributor installation and packed-package workflows are in [development](/integration/development).
