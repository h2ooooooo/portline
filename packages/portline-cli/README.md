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

The engine supplies search/list/get, tables, JSON, password masking and the highlighted password footer. Custom commands receive their own arguments before common parsing, so applications can implement connection checks or tunnel commands independently. Additional source flags are declared through `sourceOptions`. Unknown options are rejected by default; compatibility wrappers can opt into permissive parsing.

`run(args)` returns an exit code and does not exit the process. Sources can be asynchronous. Help does not load configuration. Executable bootstraps should apply color environment settings before importing the engine, which uses Chalk.

See [the architecture and migration notes](../../docs/connection-profiles.md).

Optional createProfileWriteCommands hooks provide write/sync previews and explicit apply commands. They never copy stored secrets and require destination identity/policy/revision checks. See ../../docs/profile-writing.md for usage and supported storage.

[Related libraries and applications](https://h2ooooooo.github.io/portline/ecosystem).
