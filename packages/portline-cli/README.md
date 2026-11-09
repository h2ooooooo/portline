# Portline CLI

Reusable CLI engine for application-specific executables. This is a library, with no executable of its own.

```ts
import {createProfileCli} from '@jalsoedesign/portline-cli';
import {myApplicationSource} from './source.js';

const cli = createProfileCli({
    name: 'my-application-js',
    loadSource: () => myApplicationSource,
    sourceOptions: [
        {flag: '--project', key: 'project', takesValue: true, description: 'Project settings directory'},
    ],
});

process.exitCode = await cli.run();
```

The source implements `ProfileCliSource`: list/get/search plus native summary, properties, property lookup and path projection. These hooks preserve application-specific fields and decoding without copying command handlers. Summary fields, secret fields, folder decoding and recursive JSON record names are configurable.

The engine supplies search/list/get, tables, JSON, password masking and the highlighted password footer. Custom commands receive their own arguments before common parsing. Applications can use the optional shared Dockline bridge for connection checks, file transfers or SSH operations; the base profile engine does not execute connections or tunnel chains. Additional source flags are declared through `sourceOptions`. Unknown options are rejected by default; compatibility wrappers can opt into permissive parsing.

`run(args)` returns an exit code and does not exit the process. Sources can be asynchronous. Help does not load configuration. Executable bootstraps should apply color environment settings before importing the engine, which uses Chalk.

See [CLI hooks](https://h2ooooooo.github.io/portline/integration/cli/hooks) and the [shared execution bridge](https://h2ooooooo.github.io/portline/integration/execution).

Optional `createProfileWriteCommands` hooks provide write/sync previews and explicit apply commands. They never copy stored secrets and require destination identity/policy/revision checks. See [native writing](https://h2ooooooo.github.io/portline/integration/native-writing) for supported storage and the explicit refusal of execution settings that native codecs cannot preserve.

[Related libraries and applications](https://h2ooooooo.github.io/portline/ecosystem).
