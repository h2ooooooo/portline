# API quick start

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Create a catalog, select a saved profile and search its metadata. This complete example uses an in-memory SSH profile; it reads no native settings and opens no network connection.

## Install

```sh
npm install @jalsoedesign/portline-core
```

For the default TypeScript tab, also install `tsx`, `typescript` and `@types/node` as development dependencies. Set `"type": "module"` in `package.json` for TypeScript and JavaScript; the MJS and CommonJS extensions choose their module format explicitly. The [example setup guide](/integration/examples) has copyable commands for every tab.

## Create a catalog

Save the selected tab as `profiles.ts`, `profiles.js`, `profiles.mjs` or `profiles.cjs`.

::: code-group

```ts [TypeScript]
// profiles.ts
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

const selected = catalog.get('Demo');
const connection = selected?.connections[0];

if (!selected || !connection) {
    throw new Error('The demo profile must contain a connection');
}

const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log('Profiles: ' + catalog.list().length);
console.log('Selected: ' + selected.path);
console.log('Host: ' + connection.endpoint.host);
console.log('Matches: ' + matches.length);
console.log('Metadata only: no settings read and no connection opened.');
```

```js [JavaScript]
// profiles.js
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

const selected = catalog.get('Demo');
const connection = selected?.connections[0];

if (!selected || !connection) {
    throw new Error('The demo profile must contain a connection');
}

const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log('Profiles: ' + catalog.list().length);
console.log('Selected: ' + selected.path);
console.log('Host: ' + connection.endpoint.host);
console.log('Matches: ' + matches.length);
console.log('Metadata only: no settings read and no connection opened.');
```

```js [MJS]
// profiles.mjs
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

const selected = catalog.get('Demo');
const connection = selected?.connections[0];

if (!selected || !connection) {
    throw new Error('The demo profile must contain a connection');
}

const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log('Profiles: ' + catalog.list().length);
console.log('Selected: ' + selected.path);
console.log('Host: ' + connection.endpoint.host);
console.log('Matches: ' + matches.length);
console.log('Metadata only: no settings read and no connection opened.');
```

```js [CommonJS]
// profiles.cjs
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

    const selected = catalog.get('Demo');
    const connection = selected?.connections[0];

    if (!selected || !connection) {
        throw new Error('The demo profile must contain a connection');
    }

    const matches = catalog.search('127.0.0.1', {fields: 'all'});

    console.log('Profiles: ' + catalog.list().length);
    console.log('Selected: ' + selected.path);
    console.log('Host: ' + connection.endpoint.host);
    console.log('Matches: ' + matches.length);
    console.log('Metadata only: no settings read and no connection opened.');
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
npx tsx profiles.ts
```

```sh [JavaScript]
node profiles.js
```

```sh [MJS]
node profiles.mjs
```

```sh [CommonJS]
node profiles.cjs
```

:::

### Output

```text
Profiles: 1
Selected: Demo
Host: 127.0.0.1
Matches: 1
Metadata only: no settings read and no connection opened.
```

Download: <a href="/examples/profiles.ts" download="profiles.ts">profiles.ts</a> · <a href="/examples/profiles.js" download="profiles.js">profiles.js</a> · <a href="/examples/profiles.mjs" download="profiles.mjs">profiles.mjs</a> · <a href="/examples/profiles.cjs" download="profiles.cjs">profiles.cjs</a>

## Use native saved connections

Replace the in-memory catalog with an [application adapter](/ecosystem). Adapters expose the same `list`, `get` and `search` source contract while interpreting their own native settings.

Continue with [catalog queries](/integration/queries), [explicit credential resolution](/integration/credentials) or a [safe sync preview](/integration/sync).
