# Portline Platform

Native storage, source discovery and guarded profile writing for the Portline family. Sources expose normalized metadata and explicit credential resolution; discovery reports candidates without merging unrelated installations.

`NativeProfileWriter` separates sanitized previews from explicit apply, refuses changed/busy/unknown storage and preserves unrelated native settings. Built-in apply requires Windows. File commits use exclusive handles, protected backups and rollback. Registry commits default to native transactions; explicit `registryMode: 'guarded'` supports checks, protected backups and conditional rollback on hosts without transactions. Guarded mode is not atomic and never bypasses application/lock checks.

Native writing accepts a supported intent subset. It strips credential references and values, accepts password-prompt metadata, and refuses nonempty `unsupportedOptions`, explicit boolean `passive`, `filenameEncoding` and nonempty SSH fingerprint pins because current codecs cannot preserve those execution settings. `passive: null` is default intent and can be omitted. Loss policy does not bypass these refusals.

Use the optional [shared execution bridge](https://h2ooooooo.github.io/portline/integration/execution) when connecting to a saved server. Native writing never opens that connection or imports trust approvals.

See [native writing and recovery](https://h2ooooooo.github.io/portline/integration/native-writing), [source selection](https://h2ooooooo.github.io/portline/integration/profiles) and the [ecosystem directory](https://h2ooooooo.github.io/portline/ecosystem).
