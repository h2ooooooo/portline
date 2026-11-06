# CLI documentation

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

`@jalsoedesign/portline-cli` supplies an embeddable command engine. Each application repository owns its executable, native source selection and writer factory. Installing this shared package does not create a `portline` command.

## Build a command

1. [Run the toolkit quick start](/integration/cli/quick-start) with a synthetic catalog.
2. Explore [commands, flags, output and errors](/integration/cli/commands).
3. Add [native source and writer hooks](/integration/cli/hooks) when integrating an application adapter.

The quick start includes complete programs in four languages and captured output. The shared runner returns an exit code so it can also be tested or embedded.

## Use an existing command

Choose [FileZilla, PuTTY/KiTTY, HeidiSQL, JetBrains, OpenSSH or WinSCP](/ecosystem). Their documentation describes installation, source flags and native output. Compatibility adapters can retain existing command behavior, so legacy output is not necessarily identical across applications.

Before changing native settings, review [preview/apply, locks and recovery](/integration/native-writing). For catalogs, credentials and sync planning without a terminal, use the [API documentation](/integration/api/).
