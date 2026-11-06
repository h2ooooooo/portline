# Development

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Build and test this repository independently using installed dependencies. Runtime APIs and supported Node versions are declared in each package.

```sh
npm install --ignore-scripts
npm run build
npm run lint
npm test
npm run check:publication
npm run check:consumer
```

## Documentation

The private documentation project has its own lockfile. Its build does not require another checkout or an application installation.

```sh
npm run docs:install
npm run docs:build
npm run docs:preview
```

After changing a public API, build the libraries, run `npm run docs:api`, and check the generated reference with `npm run docs:api:check`. Do not edit generated signatures by hand. Tests use synthetic profiles and disposable storage; never substitute a real credential store.

## Develop across separate repositories

Portline owns only the shared libraries. Application repositories consume them as ordinary npm dependencies; each checkout builds only its own workspaces. Dockline and dockline-keys remain independent. No checkout layout is required.

To test an unpublished dependency, build its repository and pack the owned workspaces into an explicit artifact directory:

```sh
npm run build
npm run pack:local -- --output /path/to/artifacts
```

Repeat for the dependency repositories you need. In the consuming application checkout, explicitly install those artifacts before building:

```sh
npm run dev:packages -- --artifacts /path/to/artifacts
npm run build
npm run check:consumer -- --artifacts /path/to/artifacts
```

In PowerShell, use npm.cmd when forwarding flags after --. These scripts verify artifact inventories and integrity. They do not save machine paths to dependency declarations or lockfiles, build sibling checkouts, or publish anything. Optional `--offline` requires cached third-party dependencies. Ordinary installs and builds use declared npm ranges without local configuration.

For a complete cross-application integration, provide shared, Dockline and application tarballs explicitly and run `npm run check:applications -- --artifacts /path/to/artifacts` in Portline. The test installs a disposable consumer outside the checkouts and checks imports, declarations, executable behavior and synthetic write/sync safeguards.

## Keep API examples current

After building, run `npm run docs:api` to regenerate the public declaration reference, `npm run docs:api:check` to detect drift, and `npm run docs:imports:check` to validate documented named imports against installed declarations. Optional integration examples can be checked completely with `npm run docs:imports:check -- --consumer /path/to/isolated-consumer` after installing their adapter packages there. These checks do not fetch another checkout. Runnable local demos and isolated consumers exercise behavior beyond import names.

## Documentation example checks

Run `npm run docs:examples:check` after editing examples. It checks all authored pages, language-tab order, matching runnable files, formatting, strict TypeScript types and captured synthetic output across every language variant. No native settings or network servers are used.

## Verify unpublished dependencies

Normal checkouts use `npm ci --ignore-scripts` and public npm dependency ranges. Before dependency versions are published, collect their verified packages with `npm run pack:local -- --output /path/to/artifacts`. Keep the package inventories beside the tarballs. No sibling checkout layout is required.

```sh
npm run release:lock -- --artifacts /path/to/artifacts
npm run check:locks
npm run test:locks
npm run check:bootstrap -- --artifacts /path/to/artifacts
```

The lock command uses real package metadata and SHA-512 hashes from those artifacts, retaining canonical public npm URLs. The bootstrap check creates a disposable checkout, installs locked versions through a temporary read-only registry, and runs builds, lint, tests and available API/example checks. It does not change npm user configuration or relax remote-package restrictions. Node.js, the repository's declared npm version and the system `tar` command must be available.

This verifies candidate payloads, not their availability on npm. Publish the exact verified tarballs in dependency order; if a package changes, repack it, regenerate downstream locks and repeat the checks. Once dependencies are available publicly, verify a fresh `npm ci --ignore-scripts` without bootstrap and compare registry integrity with the reviewed artifacts.
