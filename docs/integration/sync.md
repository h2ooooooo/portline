# Preview a one-way sync

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Select a source profile and connection, then choose its destination profile path. `planProfileSync` asks the destination writer to plan that change; applying it is a separate operation.

## Try an in-memory preview

Install `@jalsoedesign/portline-core` and `@jalsoedesign/portline-abstract` and follow the [language setup](/integration/examples). Save `sync-preview.ts` or its matching variant. This complete example uses synthetic metadata and a preview-only writer.

`Demo` and `Imported/Demo` are canonical profile paths inside catalogs. They are not filesystem paths or remote transfer destinations. The source is the catalog containing `Demo`; the destination is the writer receiving `Imported/Demo`.

::: code-group

```ts [TypeScript]
// sync-preview.ts
import type {ConnectionProfile, ProfileWriter} from '@jalsoedesign/portline-abstract';
import {planProfileSync} from '@jalsoedesign/portline-core';
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

const destination = {id: 'preview-only', application: 'demo'};
let projected: readonly ConnectionProfile[] = [];

// This in-memory writer demonstrates planning and deliberately refuses apply.
const writer: ProfileWriter = {
    inspect() {
        return {
            source: destination,
            revision: 'demo-revision',
            lock: 'unlocked',
            application: 'closed',
            diagnostics: [],
        };
    },
    plan(profiles) {
        projected = profiles;

        return {
            sourceId: destination.id,
            expectedRevision: 'demo-revision',
            changes: profiles.map(profile => ({
                profileId: profile.id,
                operation: 'create',
                fields: ['path', 'connections'],
            })),
        };
    },
    apply() {
        throw new Error('This example cannot write native settings');
    },
};

// Select profile Demo in the source and plan its SSH connection at Imported/Demo.
const preview = await planProfileSync(catalog, writer, [{
    sourcePath: 'Demo',
    connectionId: 'ssh',
    targetPath: 'Imported/Demo',
}]);

console.log('Source profile: Demo');
console.log('Destination profile: ' + projected[0]?.path);
console.log('Planned changes: ' + preview.changes.length);
console.log('Native settings written: no');
```

```js [JavaScript]
// sync-preview.js
import {planProfileSync} from '@jalsoedesign/portline-core';
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

const destination = {id: 'preview-only', application: 'demo'};
let projected = [];

// This in-memory writer demonstrates planning and deliberately refuses apply.
const writer = {
    inspect() {
        return {
            source: destination,
            revision: 'demo-revision',
            lock: 'unlocked',
            application: 'closed',
            diagnostics: [],
        };
    },
    plan(profiles) {
        projected = profiles;

        return {
            sourceId: destination.id,
            expectedRevision: 'demo-revision',
            changes: profiles.map(profile => ({
                profileId: profile.id,
                operation: 'create',
                fields: ['path', 'connections'],
            })),
        };
    },
    apply() {
        throw new Error('This example cannot write native settings');
    },
};

// Select profile Demo in the source and plan its SSH connection at Imported/Demo.
const preview = await planProfileSync(catalog, writer, [{
    sourcePath: 'Demo',
    connectionId: 'ssh',
    targetPath: 'Imported/Demo',
}]);

console.log('Source profile: Demo');
console.log('Destination profile: ' + projected[0]?.path);
console.log('Planned changes: ' + preview.changes.length);
console.log('Native settings written: no');
```

```js [MJS]
// sync-preview.mjs
import {planProfileSync} from '@jalsoedesign/portline-core';
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

const destination = {id: 'preview-only', application: 'demo'};
let projected = [];

// This in-memory writer demonstrates planning and deliberately refuses apply.
const writer = {
    inspect() {
        return {
            source: destination,
            revision: 'demo-revision',
            lock: 'unlocked',
            application: 'closed',
            diagnostics: [],
        };
    },
    plan(profiles) {
        projected = profiles;

        return {
            sourceId: destination.id,
            expectedRevision: 'demo-revision',
            changes: profiles.map(profile => ({
                profileId: profile.id,
                operation: 'create',
                fields: ['path', 'connections'],
            })),
        };
    },
    apply() {
        throw new Error('This example cannot write native settings');
    },
};

// Select profile Demo in the source and plan its SSH connection at Imported/Demo.
const preview = await planProfileSync(catalog, writer, [{
    sourcePath: 'Demo',
    connectionId: 'ssh',
    targetPath: 'Imported/Demo',
}]);

console.log('Source profile: Demo');
console.log('Destination profile: ' + projected[0]?.path);
console.log('Planned changes: ' + preview.changes.length);
console.log('Native settings written: no');
```

```js [CommonJS]
// sync-preview.cjs
const {planProfileSync} = require('@jalsoedesign/portline-core');
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

    const destination = {id: 'preview-only', application: 'demo'};
    let projected = [];

    // This in-memory writer demonstrates planning and deliberately refuses apply.
    const writer = {
        inspect() {
            return {
                source: destination,
                revision: 'demo-revision',
                lock: 'unlocked',
                application: 'closed',
                diagnostics: [],
            };
        },
        plan(profiles) {
            projected = profiles;

            return {
                sourceId: destination.id,
                expectedRevision: 'demo-revision',
                changes: profiles.map(profile => ({
                    profileId: profile.id,
                    operation: 'create',
                    fields: ['path', 'connections'],
                })),
            };
        },
        apply() {
            throw new Error('This example cannot write native settings');
        },
    };

    // Select profile Demo in the source and plan its SSH connection at Imported/Demo.
    const preview = await planProfileSync(catalog, writer, [{
        sourcePath: 'Demo',
        connectionId: 'ssh',
        targetPath: 'Imported/Demo',
    }]);

    console.log('Source profile: Demo');
    console.log('Destination profile: ' + projected[0]?.path);
    console.log('Planned changes: ' + preview.changes.length);
    console.log('Native settings written: no');
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
npx tsx sync-preview.ts
```

```sh [JavaScript]
node sync-preview.js
```

```sh [MJS]
node sync-preview.mjs
```

```sh [CommonJS]
node sync-preview.cjs
```

:::

### Output

```text
Source profile: Demo
Destination profile: Imported/Demo
Planned changes: 1
Native settings written: no
```

Download: <a href="/examples/sync-preview.ts" download="sync-preview.ts">sync-preview.ts</a> · <a href="/examples/sync-preview.js" download="sync-preview.js">sync-preview.js</a> · <a href="/examples/sync-preview.mjs" download="sync-preview.mjs">sync-preview.mjs</a> · <a href="/examples/sync-preview.cjs" download="sync-preview.cjs">sync-preview.cjs</a>

## Use a native writer

Use an adapter's writer factory to obtain a native preview with destination revision, diagnostics and availability. Review it before a separate explicit apply. Read [native writing, lock checks and recovery](/integration/native-writing) before changing settings.

Choose `connectionId` when a profile contains multiple connections. Required SSH hops remain attached. Sync never treats a database endpoint as an SSH server and does not prune other destination profiles. Stored passwords, passphrases and host trust policies are not copied.

Missing profiles, unknown connection IDs, duplicate target paths and missing or cyclic hop dependencies are rejected. Exact mapping types are in the [reference](/integration/reference/types).
