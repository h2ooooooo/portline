# Resolve credentials explicitly

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Profiles describe authentication through references. Resolve a reference only when a selected operation needs its value. Reading or searching a catalog does not call credential providers.

## Try it without a credential store

Install `@jalsoedesign/portline-core` and `@jalsoedesign/portline-abstract`. Follow the [language setup](/integration/examples), then save `credentials.ts` or its matching variant. The provider below returns a synthetic password; the output prints only its state.

::: code-group

```ts [TypeScript]
// credentials.ts
import type {CredentialReference} from '@jalsoedesign/portline-abstract';
import {CredentialResolver} from '@jalsoedesign/portline-core';

const reference: CredentialReference = {
    sourceId: 'demo',
    id: 'ssh-password',
    kind: 'password',
    state: 'available',
};
const resolver = new CredentialResolver();
let requests = 0;

resolver.register('demo', {
    resolve() {
        requests++;

        return {state: 'available', value: 'synthetic-demo-password'};
    },
});

console.log('Provider calls before resolution: ' + requests);

const credential = await resolver.resolve(reference);

console.log('Credential state: ' + credential.state);
console.log('Provider calls after resolution: ' + requests);
console.log('Secret value omitted from output.');
```

```js [JavaScript]
// credentials.js
import {CredentialResolver} from '@jalsoedesign/portline-core';

const reference = {
    sourceId: 'demo',
    id: 'ssh-password',
    kind: 'password',
    state: 'available',
};
const resolver = new CredentialResolver();
let requests = 0;

resolver.register('demo', {
    resolve() {
        requests++;

        return {state: 'available', value: 'synthetic-demo-password'};
    },
});

console.log('Provider calls before resolution: ' + requests);

const credential = await resolver.resolve(reference);

console.log('Credential state: ' + credential.state);
console.log('Provider calls after resolution: ' + requests);
console.log('Secret value omitted from output.');
```

```js [MJS]
// credentials.mjs
import {CredentialResolver} from '@jalsoedesign/portline-core';

const reference = {
    sourceId: 'demo',
    id: 'ssh-password',
    kind: 'password',
    state: 'available',
};
const resolver = new CredentialResolver();
let requests = 0;

resolver.register('demo', {
    resolve() {
        requests++;

        return {state: 'available', value: 'synthetic-demo-password'};
    },
});

console.log('Provider calls before resolution: ' + requests);

const credential = await resolver.resolve(reference);

console.log('Credential state: ' + credential.state);
console.log('Provider calls after resolution: ' + requests);
console.log('Secret value omitted from output.');
```

```js [CommonJS]
// credentials.cjs
const {CredentialResolver} = require('@jalsoedesign/portline-core');

async function main() {
    const reference = {
        sourceId: 'demo',
        id: 'ssh-password',
        kind: 'password',
        state: 'available',
    };
    const resolver = new CredentialResolver();
    let requests = 0;

    resolver.register('demo', {
        resolve() {
            requests++;

            return {state: 'available', value: 'synthetic-demo-password'};
        },
    });

    console.log('Provider calls before resolution: ' + requests);

    const credential = await resolver.resolve(reference);

    console.log('Credential state: ' + credential.state);
    console.log('Provider calls after resolution: ' + requests);
    console.log('Secret value omitted from output.');
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
npx tsx credentials.ts
```

```sh [JavaScript]
node credentials.js
```

```sh [MJS]
node credentials.mjs
```

```sh [CommonJS]
node credentials.cjs
```

:::

### Output

```text
Provider calls before resolution: 0
Credential state: available
Provider calls after resolution: 1
Secret value omitted from output.
```

Download: <a href="/examples/credentials.ts" download="credentials.ts">credentials.ts</a> · <a href="/examples/credentials.js" download="credentials.js">credentials.js</a> · <a href="/examples/credentials.mjs" download="credentials.mjs">credentials.mjs</a> · <a href="/examples/credentials.cjs" download="credentials.cjs">credentials.cjs</a>

## Use an adapter's provider

Register the provider under its source ID. An adapter may implement `CredentialProvider` itself or expose a separate provider; follow its API documentation. Resolve the selected connection's password or passphrase reference, then pass an available value directly to the operation that needs it.

An `available` reference is a lookup opportunity, not a guarantee that a changed or locked native store can still return a value. Other states are `not-stored`, `locked`, `unavailable` and `unsupported`. An unregistered available source resolves as `unsupported`.

## Secret lifetime and keys

`CredentialResolver` does not cache results or erase caller-held values. Native sources can retain password-bearing snapshots. Keep returned values out of logs, serialized profiles and previews.

Private-key paths are metadata. Loading keys, PPK v2/v3 conversion and encrypted exports belong to [Dockline Keys](https://h2ooooooo.github.io/dockline/keys/), which can be used independently of Portline. See [profile snapshots](/integration/profiles#snapshots-and-native-data) for source-specific lifetime details.
