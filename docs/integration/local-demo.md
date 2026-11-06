# Run repository fixtures

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

For an installed-package example, start with the [API quick start](/integration/api/quick-start) or [CLI quick start](/integration/cli/quick-start). This page is for contributors running the repository's existing assertion scripts.

From the Portline checkout after installing dependencies:

```sh
npm run build
npm run demo:profiles
```

The script constructs a synthetic catalog and runs the embedded CLI. It does not start a transport server or open a connection.

```text
$ demo-profiles list --json
[
  {
    "path": "Demo",
    "host": "127.0.0.1",
    "protocol": "ssh",
    "keyFile": "",
    "remoteDirectory": ""
  }
]
$ demo-profiles get Demo host --json
"127.0.0.1"
PASS: shared catalog, query and embedded CLI. No server connection.
```

To run the API assertion script:

```sh
npm run demo:api
```

```text
Profiles: 1
Selected: Demo
Host: 127.0.0.1
Matches: 1
Metadata only; no remote connection.
```

These contributor fixtures keep their actual `.mjs` filenames under `examples/`. They are not published application commands. Their assertions return a nonzero exit on failure.

## Check the documented variants

```sh
npm run docs:examples:check
```

The checker audits language order, formatting, matching run commands and downloadable sources, type-checks the complete TypeScript programs, then executes every language variant against synthetic metadata. See [development](/integration/development) for the full validation commands.
