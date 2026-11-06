# Shared command contracts

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

The shared engine supplies a consistent base; application compatibility adapters can retain native shapes and parsing. An application's own documentation remains the authority for its executable.

| Command | Input | Output |
| --- | --- | --- |
| `list` | Optional metadata filter and presentation options | Profile summaries, table/tree or selected full records |
| `search <term>` | Metadata term | Matching profile presentation |
| `get <path> [property]` | Exact canonical path; optional property | Record or scalar |
| `source` | Selected source | Source provenance |
| `write` / `sync` | Declared writer/source selectors and supported intent | Preview and diagnostics; no settings mutation |
| `apply` | Reviewed saved plan, same destination/policies | Guarded native commit or explicit refusal |
| `write-status` | Explicit destination | Read-only availability/revision inspection |

The [embedded example](/integration/cli/quick-start) demonstrates actual list JSON and scalar selection output. For native table colours, credentials, write results and failure envelopes, follow an [application's CLI documentation](/ecosystem).

Help does not load settings. Default presentation masks secret values; `--show-password` requests explicit supported resolution. JSON is colour-free. Colour setup belongs in the executable bootstrap before the engine is imported. Common/source options and extension hooks are documented in [build a CLI](/integration/cli/hooks), with exact signatures in [the reference](/integration/reference/types).

## Optional writer commands

Writer commands require host-provided factories and allowlisted source imports. Saving previews uses create-only semantics. Native apply rechecks source revision, process/lock availability and policies; [the writing guide](/integration/native-writing) documents platform, backup and registry limitations.

## Common input options

| Input | Meaning |
| --- | --- |
| `--json` | Colour-free JSON output |
| `--table` | Table presentation |
| `--full` | Full records for `list` |
| `--recurse --json` | Folder tree with full records for `list` |
| `--search <term>` | Search selection; with `list`, filter names and paths |
| `--show-password` | Explicitly request supported credential resolution |
| `--help` / `-h` | Help without loading a source |
| `--file <path>` | Pass a file selection to the source loader |
| `--color` / `--no-color` | Colour preferences handled by the executable bootstrap |

The source loader decides whether and how to use a file selection. Other native flags and `sources` discovery are supplied by application wrappers, not the base runner. `search` rejects `--full` and `--recurse`; `list --recurse` requires `--json`. Query search uses all supported metadata fields, while a list filter uses names/paths.

## Captured commands and output

Use the complete saved program from the [CLI quick start](/integration/cli/quick-start). These commands run that same file; they do not rely on a globally installed binary.

### Exact property lookup

::: code-group

```sh [TypeScript]
npx tsx profile-cli.ts get Demo host --json
```

```sh [JavaScript]
node profile-cli.js get Demo host --json
```

```sh [MJS]
node profile-cli.mjs get Demo host --json
```

```sh [CommonJS]
node profile-cli.cjs get Demo host --json
```

:::

```text
"127.0.0.1"
```

### Selected source

::: code-group

```sh [TypeScript]
npx tsx profile-cli.ts source --json
```

```sh [JavaScript]
node profile-cli.js source --json
```

```sh [MJS]
node profile-cli.mjs source --json
```

```sh [CommonJS]
node profile-cli.cjs source --json
```

:::

```text
{
  "id": "demo",
  "application": "demo"
}
```

### Invalid option

::: code-group

```sh [TypeScript]
npx tsx profile-cli.ts list --unknown --json
```

```sh [JavaScript]
node profile-cli.js list --unknown --json
```

```sh [MJS]
node profile-cli.mjs list --unknown --json
```

```sh [CommonJS]
node profile-cli.cjs list --unknown --json
```

:::

Standard error, exit code `1`:

```text
{"error":"Unknown option \"--unknown\""}
```

### Human-readable search

::: code-group

```sh [TypeScript]
npx tsx profile-cli.ts search Demo
```

```sh [JavaScript]
node profile-cli.js search Demo
```

```sh [MJS]
node profile-cli.mjs search Demo
```

```sh [CommonJS]
node profile-cli.cjs search Demo
```

:::

Captured with terminal colours enabled. This fixture has no saved password or private key; those rows are empty.

<pre class="cli-output"><code>Found 1 profile

<span style="color:#00aaaa">┌</span><span style="color:#00aaaa">──────────────────</span><span style="color:#00aaaa">┬</span><span style="color:#00aaaa">────────────</span><span style="color:#00aaaa">┐</span>
<span style="color:#00aaaa">│</span> <span style="font-weight:700"></span><span style="color:#ffffff;font-weight:700">Label           </span><span style="font-weight:700"></span> <span style="color:#00aaaa">│</span> <span style="font-weight:700"></span><span style="color:#ffffff;font-weight:700">Value     </span><span style="font-weight:700"></span> <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">├</span><span style="color:#00aaaa">──────────────────</span><span style="color:#00aaaa">┼</span><span style="color:#00aaaa">────────────</span><span style="color:#00aaaa">┤</span>
<span style="color:#00aaaa">│</span> Name             <span style="color:#00aaaa">│</span> Demo       <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Path             <span style="color:#00aaaa">│</span> Demo       <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Protocol         <span style="color:#00aaaa">│</span> ssh        <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Host             <span style="color:#00aaaa">│</span> 127.0.0.1  <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Port             <span style="color:#00aaaa">│</span> 22         <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Username         <span style="color:#00aaaa">│</span> fixture    <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Password         <span style="color:#00aaaa">│</span>            <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Passphrase       <span style="color:#00aaaa">│</span>            <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Credential state <span style="color:#00aaaa">│</span> not-stored <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Authentication   <span style="color:#00aaaa">│</span>            <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Private key      <span style="color:#00aaaa">│</span>            <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">│</span> Remote           <span style="color:#00aaaa">│</span>            <span style="color:#00aaaa">│</span>
<span style="color:#00aaaa">└</span><span style="color:#00aaaa">──────────────────</span><span style="color:#00aaaa">┴</span><span style="color:#00aaaa">────────────</span><span style="color:#00aaaa">┘</span></code></pre>

## Exit codes and stream contracts

Successful commands and help return `0`. Parsing, source loading and command errors return `1`. `run` returns that code instead of exiting; the quick start assigns it to `process.exitCode`.

JSON records go to standard output; handled failures go to standard error. An unknown command also prints help on standard output, so callers should use the exit code before treating output as successful JSON. Ordinary handled query failures use `{"error":"message"}` in JSON mode. Registry write failures can add native code, operation, recovery and backup fields.

Native terminal colours and password states depend on adapter hooks. When hidden credentials are reported in human search output, the engine uses `(hidden*)` and a footer with the `--show-password` flag highlighted green. JSON has no ANSI colour codes and does not include that footer. See an adapter's CLI guide for its captured native output.
