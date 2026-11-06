# Read and search profiles

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

The [API quick start](/integration/api/quick-start) creates `catalog` and shows a complete runnable program. The recipes below continue in that program, after catalog construction.

## List saved metadata

::: code-group

```ts [TypeScript]
const profiles = catalog.list();

console.log(profiles.map(profile => profile.path).join(', '));
```

```js [JavaScript]
const profiles = catalog.list();

console.log(profiles.map(profile => profile.path).join(', '));
```

```js [MJS]
const profiles = catalog.list();

console.log(profiles.map(profile => profile.path).join(', '));
```

```js [CommonJS]
const profiles = catalog.list();

console.log(profiles.map(profile => profile.path).join(', '));
```

:::

```text
Demo
```

## Select an exact profile

`get` uses the canonical profile path, including folder segments when present. This path identifies a saved record; it is not a file path on the host or a remote server.

::: code-group

```ts [TypeScript]
const profile = catalog.get('Demo');

console.log(profile?.connections[0]?.endpoint.host ?? 'Profile not found');
```

```js [JavaScript]
const profile = catalog.get('Demo');

console.log(profile?.connections[0]?.endpoint.host ?? 'Profile not found');
```

```js [MJS]
const profile = catalog.get('Demo');

console.log(profile?.connections[0]?.endpoint.host ?? 'Profile not found');
```

```js [CommonJS]
const profile = catalog.get('Demo');

console.log(profile?.connections[0]?.endpoint.host ?? 'Profile not found');
```

:::

```text
127.0.0.1
```

## Search connection metadata

Default search checks names and canonical paths. Use `fields: 'all'` to include supported connection metadata such as host and username. Neither form resolves credentials.

::: code-group

```ts [TypeScript]
const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log(matches.map(profile => profile.path).join(', '));
```

```js [JavaScript]
const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log(matches.map(profile => profile.path).join(', '));
```

```js [MJS]
const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log(matches.map(profile => profile.path).join(', '));
```

```js [CommonJS]
const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log(matches.map(profile => profile.path).join(', '));
```

:::

```text
Demo
```

## Replace the catalog with a native source

An application adapter implements the same source operations. The contract allows synchronous or asynchronous results, so `await source.list()` works with either. Choose a [native adapter](/ecosystem), then follow its source selection and discovery guide.

## Identity and refresh behavior

`ProfileCatalog` requires profiles to belong to its source and have unique IDs and canonical paths. It holds a metadata snapshot; reconstruct or reopen a source to refresh native changes. See [profiles and snapshots](/integration/profiles) for the model and [method contracts](/integration/reference/api) for failure behavior.
