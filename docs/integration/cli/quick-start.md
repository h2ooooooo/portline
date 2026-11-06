# CLI toolkit quick start

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Build a runnable command around an in-memory catalog. `@jalsoedesign/portline-cli` is an embeddable library; it does not install a `portline` executable. This example supplies the bootstrap and receives real command-line arguments.

## Install

```sh
npm install @jalsoedesign/portline-core @jalsoedesign/portline-cli
```

Follow the [language setup](/integration/examples) for TypeScript tooling or JavaScript module configuration. Save `profile-cli.ts` or its matching variant. The displayed help name `demo-profiles` identifies this example; run the saved file using the tabs below.

## Build the command

::: code-group

```ts [TypeScript]
// profile-cli.ts
import {createProfileCli, createNormalizedCliSource} from '@jalsoedesign/portline-cli';
import {ProfileCatalog} from '@jalsoedesign/portline-core';

const source = {id: 'demo', application: 'demo'};
const catalog = new ProfileCatalog(source, [
    {
        id: 'demo',
        name: 'Demo',
        path: 'Demo',
        source,
        diagnostics: [],
        connections: [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'ssh',
                endpoint: {host: '127.0.0.1', port: 22, username: 'fixture'},
                authentication: [],
            },
        ],
    },
]);

const cli = createProfileCli({
    name: 'demo-profiles',
    loadSource: () => createNormalizedCliSource(catalog),
});

process.exitCode = await cli.run(process.argv.slice(2));
```

```js [JavaScript]
// profile-cli.js
import {createProfileCli, createNormalizedCliSource} from '@jalsoedesign/portline-cli';
import {ProfileCatalog} from '@jalsoedesign/portline-core';

const source = {id: 'demo', application: 'demo'};
const catalog = new ProfileCatalog(source, [
    {
        id: 'demo',
        name: 'Demo',
        path: 'Demo',
        source,
        diagnostics: [],
        connections: [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'ssh',
                endpoint: {host: '127.0.0.1', port: 22, username: 'fixture'},
                authentication: [],
            },
        ],
    },
]);

const cli = createProfileCli({
    name: 'demo-profiles',
    loadSource: () => createNormalizedCliSource(catalog),
});

process.exitCode = await cli.run(process.argv.slice(2));
```

```js [MJS]
// profile-cli.mjs
import {createProfileCli, createNormalizedCliSource} from '@jalsoedesign/portline-cli';
import {ProfileCatalog} from '@jalsoedesign/portline-core';

const source = {id: 'demo', application: 'demo'};
const catalog = new ProfileCatalog(source, [
    {
        id: 'demo',
        name: 'Demo',
        path: 'Demo',
        source,
        diagnostics: [],
        connections: [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'ssh',
                endpoint: {host: '127.0.0.1', port: 22, username: 'fixture'},
                authentication: [],
            },
        ],
    },
]);

const cli = createProfileCli({
    name: 'demo-profiles',
    loadSource: () => createNormalizedCliSource(catalog),
});

process.exitCode = await cli.run(process.argv.slice(2));
```

```js [CommonJS]
// profile-cli.cjs
const {createProfileCli, createNormalizedCliSource} = require('@jalsoedesign/portline-cli');
const {ProfileCatalog} = require('@jalsoedesign/portline-core');

async function main() {
    const source = {id: 'demo', application: 'demo'};
    const catalog = new ProfileCatalog(source, [
        {
            id: 'demo',
            name: 'Demo',
            path: 'Demo',
            source,
            diagnostics: [],
            connections: [
                {
                    id: 'ssh',
                    kind: 'ssh',
                    protocol: 'ssh',
                    endpoint: {host: '127.0.0.1', port: 22, username: 'fixture'},
                    authentication: [],
                },
            ],
        },
    ]);

    const cli = createProfileCli({
        name: 'demo-profiles',
        loadSource: () => createNormalizedCliSource(catalog),
    });

    process.exitCode = await cli.run(process.argv.slice(2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
```

:::

### Run it

::: code-group

```sh [TypeScript]
npx tsx profile-cli.ts list --json
```

```sh [JavaScript]
node profile-cli.js list --json
```

```sh [MJS]
node profile-cli.mjs list --json
```

```sh [CommonJS]
node profile-cli.cjs list --json
```

:::

### Output

```text
[
  {
    "path": "Demo",
    "host": "127.0.0.1",
    "protocol": "ssh",
    "keyFile": "",
    "remoteDirectory": ""
  }
]
```

Download: <a href="/examples/profile-cli.ts" download="profile-cli.ts">profile-cli.ts</a> · <a href="/examples/profile-cli.js" download="profile-cli.js">profile-cli.js</a> · <a href="/examples/profile-cli.mjs" download="profile-cli.mjs">profile-cli.mjs</a> · <a href="/examples/profile-cli.cjs" download="profile-cli.cjs">profile-cli.cjs</a>

## Select one property

Run the same saved program with an exact profile path and property:

::: code-group

```sh [TypeScript]
npx tsx profile-cli.ts get Demo host --json
```

```sh [JavaScript]
node profile-cli.js get Demo host --json
```

```sh [MJS]
node profile-cli.mjs get Demo host --json
```

```sh [CommonJS]
node profile-cli.cjs get Demo host --json
```

:::

```text
"127.0.0.1"
```

The result is a JSON string. Both commands exit with code `0`. The catalog holds a loopback address as metadata; neither command connects to it.

Use `--help` to inspect the command, then continue with [inputs and output](/integration/cli/commands) or [source and writer hooks](/integration/cli/hooks).
