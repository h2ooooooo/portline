# Portline Dockline Bridge

Optional shared execution for normalized profiles from FileZilla, WinSCP, PuTTY, OpenSSH, JetBrains and HeidiSQL. Readers supply metadata and explicit credential lookup; Dockline supplies connections and operations. Per-reader FTP/SFTP factory packages are no longer needed.

Install the bridge and the protocol client used by the operation:

```sh
npm install @jalsoedesign/portline-dockline@rc @jalsoedesign/dockline-sftp-client@rc
```

Use `dockline-ftp-client` for FTP/FTPS or `dockline-ssh-client` for SSH commands. The SSH client includes its SFTP support. Protocol clients are optional peers; importing the bridge or mapping configuration does not load one. Missing clients report `ProfileExecutionError` with `code: 'MISSING_HANDLER'` and an install command. Broken installed packages retain their original errors.

`createDocklineBridge({source, credentials, trust})` constructs a `DocklineBridge`. All operation methods accept an exact source path or an already selected `ConnectionProfile`, plus optional `ExecutionOptions`:

| Method | Result and ownership |
| --- | --- |
| `toConfig(input, options)` | Promise of FTP/SFTP configuration; no connection |
| `toSshConfig(input, options)` | Promise of scalar SSH configuration; use `withSsh` to retain bridge trust services |
| `createFileAdapter(input, options)` | Promise of a disconnected Dockline adapter; caller connects/disconnects |
| `withFiles(input, callback, options)` | Scoped Dockline file SDK; closes on callback success/failure |
| `withSsh(input, callback, options)` | Scoped SSH session with `exec`, `shell` and `asUser` |

The bridge uses `credentials.resolve` or the source's `resolve` only for explicit operations. Runtime `password`, `privateKey`, `privateKeyPath`, `agent` or `keyboardInteractive` bypass saved private-key selection; saved password and agent alternatives can remain configured. `passphrase` alone retains native key selection. A replacement key never inherits the saved key's passphrase. Interactive-only profiles require a keyboard-interactive handler. Configuration may contain secrets; never log it as metadata.

SSH/SFTP requires a canonical SHA256 `hostFingerprint`, a saved fingerprint array or explicit `trust(challenge)`. Pins bind the exact endpoint. Runtime pin, saved pins, runtime trust callback and bridge trust callback take precedence in that order. Callbacks accept only literal `true` and never persist approvals. `toSshConfig` returns scalar settings and only the runtime pin; saved pin-set/callback verification is installed by `withSsh`.

Select `connectionId` when several definitions support the requested capability. SSH hops, unsupported native settings/authentication and error diagnostics are refused. Ambiguous FTP TLS requires explicit `tls` selection; otherwise the runtime TLS mode must equal the saved policy. Files can explicitly request SFTP on an SSH endpoint and commands can request SSH on an SFTP endpoint; FTP does not imply an SSH endpoint. Server capability remains authoritative.

`abortSignal` cancels preparation and sessions. SSH `timeoutMs` bounds preparation and the scoped session; file operation deadlines/retries/progress use Dockline options. `readyTimeout` applies to SSH/SFTP handshake readiness. Consume streams inside scoped callbacks.

The [complete guide](https://h2ooooooo.github.io/portline/integration/execution) covers installation, source selection, runnable configuration examples, every option group, trust and error codes. See the [generated TypeScript reference](https://h2ooooooo.github.io/portline/integration/reference/types) for exact exported signatures.

## Default interactive host approval

When neither a fingerprint nor a trust callback is configured, the shared bridge asks for SSH/SFTP host approval if both standard input and standard error are interactive terminals. It displays the endpoint and server fingerprint; only an explicit `yes` accepts a new host. Matching approvals are reused for that bridge instance. A changed approved key requires the distinct response `replace`. Approval is session-only and is never written to disk. Explicit pins and configured providers retain priority, and a pin mismatch never falls back to a prompt.

Redirected input, pipelines and unattended jobs do not prompt: configure a fingerprint or trust provider. Browser/server applications supply their own approval callback. The downloadable programs use explicit pins to remain reproducible in unattended checks; interactive callers may omit them.
