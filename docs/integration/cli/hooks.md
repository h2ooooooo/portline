# Add native sources and commands

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Start with the complete [CLI quick start](/integration/cli/quick-start). Keep the bootstrap and replace its in-memory source when integrating native settings.

## Adapt a source

This recipe assumes an already selected `nativeSource` implementing `ProfileSource`. It is a replacement for the quick start's runner setup, not a separate runnable file. Import the named functions from `@jalsoedesign/portline-cli` as in that example.

::: code-group

```ts [TypeScript]
const cli = createProfileCli({
    name: 'my-profiles',
    loadSource: () => createNormalizedCliSource(nativeSource),
});

process.exitCode = await cli.run(process.argv.slice(2));
```

```js [JavaScript]
const cli = createProfileCli({
    name: 'my-profiles',
    loadSource: () => createNormalizedCliSource(nativeSource),
});

process.exitCode = await cli.run(process.argv.slice(2));
```

```js [MJS]
const cli = createProfileCli({
    name: 'my-profiles',
    loadSource: () => createNormalizedCliSource(nativeSource),
});

process.exitCode = await cli.run(process.argv.slice(2));
```

```js [CommonJS]
const cli = createProfileCli({
    name: 'my-profiles',
    loadSource: () => createNormalizedCliSource(nativeSource),
});

process.exitCode = await cli.run(process.argv.slice(2));
```

:::

The host owns source selection. Help is handled before `loadSource`, so requesting it does not load native settings. Normalized presentation masks credential values by default; `--show-password` explicitly requests supported resolution.

## Declare source options

Use `sourceOptions` to declare flag names, destination option keys, whether a value is required and help text. `loadSource` receives the parsed options. Unknown options fail by default; compatibility wrappers can choose `ignoreUnknownOptions` to retain legacy parsing.

Native CLI adapters can supply summary, property and canonical-path hooks, custom field labels, secret fields and help text. Use these hooks when preserving an application's existing output contract. See `ProfileCliDefinition` in the [exact signatures](/integration/reference/types).

## Add writer commands

`createProfileWriteCommands` accepts an application identifier, declared source options, a writer factory and an allowlisted source importer. Register its `write`, `sync`, `apply` and `write-status` handlers through `commands`. These are optional extensions rather than commands enabled by the base runner.

Preview files use create-only output. Apply requires the same explicit destination and policies, and repeats native availability/revision checks. Follow the [writing workflow](/integration/native-writing) for review, locks, backups and registry limitations.

## Terminal output and embedding

Configure colour preferences in the executable bootstrap before importing the engine. JSON output is colour-free. `run(args)` returns an exit code; it does not terminate the process. Set `process.exitCode` in an executable, or inspect the return value in an embedding test.

Custom handlers can implement application-specific checks while keeping transfers, SSH execution and database operations outside the shared profile engine.
