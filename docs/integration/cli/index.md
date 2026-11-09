# CLI documentation

`@jalsoedesign/portline-cli` provides the shared command engine for saved-profile queries, output and guarded writes. Use an existing application command below, or embed the engine in a Node.js executable with its native reader.

## Build a command

1. [Run the toolkit quick start](/integration/cli/quick-start) with a synthetic catalog.
2. Explore [commands, flags, output and errors](/integration/cli/commands).
3. Add [native source and writer hooks](/integration/cli/hooks) when integrating an application adapter.

The quick start includes complete programs in four languages and captured output. The shared runner returns an exit code so it can also be tested or embedded.

## Use an existing command

Install the CLI for the application that owns the saved settings. Each quick start includes a synthetic settings file, exact commands and expected output.

| Application | Install | Command | Quick start |
| --- | --- | --- | --- |
| FileZilla | `npm install -g @jalsoedesign/filezilla-cli` | `filezilla-js` | [Run FileZilla queries](https://h2ooooooo.github.io/filezilla-js/cli/quick-start.html) |
| PuTTY and KiTTY | `npm install -g @jalsoedesign/putty-cli` | `putty-js` | [Run session queries](https://h2ooooooo.github.io/putty-js/cli/quick-start.html) |
| HeidiSQL | `npm install -g @jalsoedesign/heidisql-cli` | `heidisql-js` | [Run session queries](https://h2ooooooo.github.io/heidisql-js/cli/quick-start.html) |
| JetBrains profiles | `npm install -g @jalsoedesign/jsbrains-portline-cli` | `jsbrains-profiles` | [Run profile queries](https://h2ooooooo.github.io/jsbrains/cli/profiles.html) |
| OpenSSH | `npm install -g @jalsoedesign/openssh-cli` | `openssh-js` | [Run SSH profile queries](https://h2ooooooo.github.io/openssh-js/cli/quick-start.html) |
| WinSCP | `npm install -g @jalsoedesign/winscp-cli` | `winscp-js` | [Run session queries](https://h2ooooooo.github.io/winscp-js/cli/quick-start.html) |

Before changing native settings, review [preview/apply, locks and recovery](/integration/native-writing). For catalogs, credentials and sync planning without a terminal, use the [API documentation](/integration/api/).
