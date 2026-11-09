# Execute a normalized profile

Use the optional `@jalsoedesign/portline-dockline` package to reuse a selected profile for files or SSH commands. FileZilla, WinSCP, PuTTY, OpenSSH, JetBrains and HeidiSQL readers supply normalized settings and explicit credential lookup. This one shared bridge maps supported definitions; Dockline owns the connections and operations. Per-reader FileZilla FTP/SFTP factories have been removed.

## Install the capability used

| Task | Install |
| --- | --- |
| Resolve configuration without connecting | `npm install @jalsoedesign/portline-dockline` |
| FTP/FTPS file operations | `npm install @jalsoedesign/portline-dockline @jalsoedesign/dockline-ftp-client` |
| SFTP file operations | `npm install @jalsoedesign/portline-dockline @jalsoedesign/dockline-sftp-client` |
| SSH commands | `npm install @jalsoedesign/portline-dockline @jalsoedesign/dockline-ssh-client` |

Install the application reader separately when reading native settings. The bridge has required Dockline contracts/SDK dependencies and optional protocol-client peers. The SSH client includes SFTP support for its own helpers. Importing the bridge, listing metadata, `toConfig` and `toSshConfig` do not load a protocol client or open a socket. Connection operations report an actionable `MISSING_HANDLER` error when the selected client is absent.

Node.js 22.22.2 or newer is required. The bridge provides CommonJS-compatible exports and TypeScript declarations. Follow [language setup](/integration/examples) before running a program.

## Try configuration mapping without a server

Install `@jalsoedesign/portline-dockline` and `@jalsoedesign/portline-abstract`. Save the selected variant below. This complete program constructs a synthetic source, selects `Demo` by exact path and explicitly resolves its password twice, once for each configuration method. It prints only nonsecret fields. No protocol client or application installation is required.

The all-zero SHA256 fingerprint is synthetic configuration data for this no-network example; obtain the actual server fingerprint independently before connecting to a real server.

::: code-group

```ts [TypeScript]
// execution.ts
import type {ConnectionProfile, CredentialProvider, ProfileSource} from '@jalsoedesign/portline-abstract';
import {createDocklineBridge} from '@jalsoedesign/portline-dockline';

const profile: ConnectionProfile = {
    id: 'demo',
    path: 'Demo',
    name: 'Demo',
    source: {id: 'demo-source', application: 'Synthetic fixture'},
    diagnostics: [],
    connections: [{
        id: 'primary',
        kind: 'ssh',
        protocol: 'sftp',
        endpoint: {host: 'example.test', port: 22, username: 'demo'},
        remoteDirectory: '/reports',
        authentication: [{
            type: 'password',
            credential: {sourceId: 'demo-source', id: 'demo-password', kind: 'password', state: 'available'},
        }],
    }],
};
let requests = 0;
const source: ProfileSource & CredentialProvider = {
    source: profile.source,
    list: () => [profile],
    get: selectedPath => selectedPath === profile.path ? profile : undefined,
    search: term => profile.name.includes(term) ? [profile] : [],
    resolve(reference) {
        if (reference.sourceId !== profile.source.id || reference.id !== 'demo-password') {
            return {state: 'unavailable'};
        }

        requests++;

        return {state: 'available', value: 'synthetic-demo-password'};
    },
};
const bridge = createDocklineBridge({source});
const options = {hostFingerprint: 'SHA256:' + 'A'.repeat(43)};

console.log('Credential requests before mapping: ' + requests);

const files = await bridge.toConfig('Demo', options);
const ssh = await bridge.toSshConfig('Demo', options);

console.log('File protocol: ' + files.protocol);
console.log('File root: ' + files.root);
console.log('SSH endpoint: ' + ssh.host + ':' + ssh.port);
console.log('Credential requests after mapping: ' + requests);
console.log('No client loaded, no connection opened; secret values omitted.');
```

```js [JavaScript]
// execution.js

import {createDocklineBridge} from '@jalsoedesign/portline-dockline';

const profile = {
    id: 'demo',
    path: 'Demo',
    name: 'Demo',
    source: {id: 'demo-source', application: 'Synthetic fixture'},
    diagnostics: [],
    connections: [{
        id: 'primary',
        kind: 'ssh',
        protocol: 'sftp',
        endpoint: {host: 'example.test', port: 22, username: 'demo'},
        remoteDirectory: '/reports',
        authentication: [{
            type: 'password',
            credential: {sourceId: 'demo-source', id: 'demo-password', kind: 'password', state: 'available'},
        }],
    }],
};
let requests = 0;
const source = {
    source: profile.source,
    list: () => [profile],
    get: selectedPath => selectedPath === profile.path ? profile : undefined,
    search: term => profile.name.includes(term) ? [profile] : [],
    resolve(reference) {
        if (reference.sourceId !== profile.source.id || reference.id !== 'demo-password') {
            return {state: 'unavailable'};
        }

        requests++;

        return {state: 'available', value: 'synthetic-demo-password'};
    },
};
const bridge = createDocklineBridge({source});
const options = {hostFingerprint: 'SHA256:' + 'A'.repeat(43)};

console.log('Credential requests before mapping: ' + requests);

const files = await bridge.toConfig('Demo', options);
const ssh = await bridge.toSshConfig('Demo', options);

console.log('File protocol: ' + files.protocol);
console.log('File root: ' + files.root);
console.log('SSH endpoint: ' + ssh.host + ':' + ssh.port);
console.log('Credential requests after mapping: ' + requests);
console.log('No client loaded, no connection opened; secret values omitted.');
```

```js [MJS]
// execution.mjs

import {createDocklineBridge} from '@jalsoedesign/portline-dockline';

const profile = {
    id: 'demo',
    path: 'Demo',
    name: 'Demo',
    source: {id: 'demo-source', application: 'Synthetic fixture'},
    diagnostics: [],
    connections: [{
        id: 'primary',
        kind: 'ssh',
        protocol: 'sftp',
        endpoint: {host: 'example.test', port: 22, username: 'demo'},
        remoteDirectory: '/reports',
        authentication: [{
            type: 'password',
            credential: {sourceId: 'demo-source', id: 'demo-password', kind: 'password', state: 'available'},
        }],
    }],
};
let requests = 0;
const source = {
    source: profile.source,
    list: () => [profile],
    get: selectedPath => selectedPath === profile.path ? profile : undefined,
    search: term => profile.name.includes(term) ? [profile] : [],
    resolve(reference) {
        if (reference.sourceId !== profile.source.id || reference.id !== 'demo-password') {
            return {state: 'unavailable'};
        }

        requests++;

        return {state: 'available', value: 'synthetic-demo-password'};
    },
};
const bridge = createDocklineBridge({source});
const options = {hostFingerprint: 'SHA256:' + 'A'.repeat(43)};

console.log('Credential requests before mapping: ' + requests);

const files = await bridge.toConfig('Demo', options);
const ssh = await bridge.toSshConfig('Demo', options);

console.log('File protocol: ' + files.protocol);
console.log('File root: ' + files.root);
console.log('SSH endpoint: ' + ssh.host + ':' + ssh.port);
console.log('Credential requests after mapping: ' + requests);
console.log('No client loaded, no connection opened; secret values omitted.');
```

```js [CommonJS]
// execution.cjs
const {createDocklineBridge} = require('@jalsoedesign/portline-dockline');

async function main() {
    const profile = {
        id: 'demo',
        path: 'Demo',
        name: 'Demo',
        source: {id: 'demo-source', application: 'Synthetic fixture'},
        diagnostics: [],
        connections: [{
            id: 'primary',
            kind: 'ssh',
            protocol: 'sftp',
            endpoint: {host: 'example.test', port: 22, username: 'demo'},
            remoteDirectory: '/reports',
            authentication: [{
                type: 'password',
                credential: {sourceId: 'demo-source', id: 'demo-password', kind: 'password', state: 'available'},
            }],
        }],
    };
    let requests = 0;
    const source = {
        source: profile.source,
        list: () => [profile],
        get: selectedPath => selectedPath === profile.path ? profile : undefined,
        search: term => profile.name.includes(term) ? [profile] : [],
        resolve(reference) {
            if (reference.sourceId !== profile.source.id || reference.id !== 'demo-password') {
                return {state: 'unavailable'};
            }

            requests++;

            return {state: 'available', value: 'synthetic-demo-password'};
        },
    };
    const bridge = createDocklineBridge({source});
    const options = {hostFingerprint: 'SHA256:' + 'A'.repeat(43)};

    console.log('Credential requests before mapping: ' + requests);

    const files = await bridge.toConfig('Demo', options);
    const ssh = await bridge.toSshConfig('Demo', options);

    console.log('File protocol: ' + files.protocol);
    console.log('File root: ' + files.root);
    console.log('SSH endpoint: ' + ssh.host + ':' + ssh.port);
    console.log('Credential requests after mapping: ' + requests);
    console.log('No client loaded, no connection opened; secret values omitted.');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
```

:::

Run the matching file:

::: code-group

```sh [TypeScript]
npx tsx execution.ts
```

```sh [JavaScript]
node execution.js
```

```sh [MJS]
node execution.mjs
```

```sh [CommonJS]
node execution.cjs
```

:::

<a href="/examples/execution.ts" download="execution.ts">Download TypeScript</a> · <a href="/examples/execution.js" download="execution.js">JavaScript</a> · <a href="/examples/execution.mjs" download="execution.mjs">MJS</a> · <a href="/examples/execution.cjs" download="execution.cjs">CommonJS</a>

```text
Credential requests before mapping: 0
File protocol: sftp
File root: /reports
SSH endpoint: example.test:22
Credential requests after mapping: 2
No client loaded, no connection opened; secret values omitted.
```

## Select the source and connection

`createDocklineBridge({source})` returns a `DocklineBridge`. Construct `source` using the application reader after selecting the intended file, registry view, installation and scope. Discovery reports candidates; the bridge does not discover applications, merge installations or select a similarly named profile.

Every method accepts either an exact source path or a `ConnectionProfile`. A string calls the configured source's `get(path)`. A direct profile needs no source if runtime authentication or a separate credential provider supplies the necessary material. Use `connectionId` when several definitions support the requested capability. File methods consider FTP and SSH/SFTP definitions; SSH methods consider only SSH/SFTP definitions. An unknown or incompatible ID is refused.

An explicit `withFiles` may request SFTP on an SSH endpoint, and `withSsh` may request commands on an SFTP endpoint. The server determines whether the requested capability exists. A database or FTP host is never inferred to be an SSH server. Selected connections with nonempty `via` are refused; the bridge does not open ProxyJump or database tunnel chains.

Sources are metadata snapshots. Reconstruct the reader to refresh native settings. The [profile guide](/integration/profiles) explains native snapshot and credential-loading limits.

## Methods and resource ownership

| Signature | Result and lifecycle |
| --- | --- |
| `toConfig(input: ConnectionProfile \| string, options?: ExecutionOptions): Promise<TransferConfig>` | Maps FTP/SFTP settings and resolves credentials. No client load or connection. SFTP configuration includes the bridge's endpoint-bound trust policy. |
| `toSshConfig(input: ConnectionProfile \| string, options?: ExecutionOptions): Promise<SshConfig>` | Resolves scalar SSH settings and validates that trust is available. No client load or connection. |
| `createFileAdapter(input: ConnectionProfile \| string, options?: ExecutionOptions): Promise<TransferAdapter>` | Loads only the selected FTP/SFTP client and returns its disconnected adapter. Caller owns connect/disconnect. |
| `withFiles<T>(input, callback: (remote: Dockline) => Promise<T>, options?: ExecutionOptions): Promise<T>` | Opens a file session, awaits the callback and closes it on success or failure. |
| `withSsh<T>(input, callback: (session: SshSession) => Promise<T>, options?: ExecutionOptions): Promise<T>` | Opens an SSH session, awaits the callback and closes it on success or failure. |

`toSshConfig` returns scalar authentication/endpoint settings and the runtime `hostFingerprint` when supplied. Saved fingerprint arrays and trust callbacks live in the bridge services installed by `withSsh`; they are not serialized into `SshConfig`. Prefer `withSsh` to retain that verification. A standalone client using returned settings must receive equivalent trust services explicitly.

Both configuration methods can return secrets. Do not log or serialize the objects as metadata. No secret cache is maintained by the bridge, so separate calls may resolve the same reference again.

### Scoped file and SSH recipes

These recipes reuse `bridge` and `options` from the complete program. Before running them, replace its synthetic source with the intended application source, select the real path and supply independently verified trust. Unlike the configuration example, these calls open network connections and require the corresponding client package.

List files through the managed SDK:

::: code-group

```ts [TypeScript]
await bridge.withFiles('Demo', async remote => {
    for await (const entry of remote.list()) {
        console.log(entry.path);
    }
}, options);
```

```js [JavaScript]
await bridge.withFiles('Demo', async remote => {
    for await (const entry of remote.list()) {
        console.log(entry.path);
    }
}, options);
```

```js [MJS]
await bridge.withFiles('Demo', async remote => {
    for await (const entry of remote.list()) {
        console.log(entry.path);
    }
}, options);
```

```js [CommonJS]
await bridge.withFiles('Demo', async remote => {
    for await (const entry of remote.list()) {
        console.log(entry.path);
    }
}, options);
```

:::

Run an argument-based SSH command:

::: code-group

```ts [TypeScript]
await bridge.withSsh('Demo', async session => {
    const result = await session.exec('whoami');

    console.log(result.stdout.trim());
}, options);
```

```js [JavaScript]
await bridge.withSsh('Demo', async session => {
    const result = await session.exec('whoami');

    console.log(result.stdout.trim());
}, options);
```

```js [MJS]
await bridge.withSsh('Demo', async session => {
    const result = await session.exec('whoami');

    console.log(result.stdout.trim());
}, options);
```

```js [CommonJS]
await bridge.withSsh('Demo', async session => {
    const result = await session.exec('whoami');

    console.log(result.stdout.trim());
}, options);
```

:::

`session.exec(program, args?, options?)` returns `{code, stdout, stderr}`. Use `session.shell(command, options?)` when shell interpretation is intended, or `session.asUser(user, callback)` for a scoped user. `SshExecOptions` supports `timeout`, `sudo` and `allowFailure`; command failure normally rejects. Consult [Dockline SSH](https://h2ooooooo.github.io/dockline/ssh/quick-start) for server permissions and command semantics.

Consume streams, iterators and pending operations within the scoped callback. Returning a resource to use after the callback ends does not extend its connection lifetime.

### Explicit adapter lifecycle

Only use a disconnected adapter when the application needs to manage its lifetime. This contextual recipe also opens a network connection:

::: code-group

```ts [TypeScript]
const adapter = await bridge.createFileAdapter('Demo', options);

try {
    await adapter.connect();

    const entry = await adapter.stat('report.csv');

    console.log(entry.size);
} finally {
    await adapter.disconnect();
}
```

```js [JavaScript]
const adapter = await bridge.createFileAdapter('Demo', options);

try {
    await adapter.connect();

    const entry = await adapter.stat('report.csv');

    console.log(entry.size);
} finally {
    await adapter.disconnect();
}
```

```js [MJS]
const adapter = await bridge.createFileAdapter('Demo', options);

try {
    await adapter.connect();

    const entry = await adapter.stat('report.csv');

    console.log(entry.size);
} finally {
    await adapter.disconnect();
}
```

```js [CommonJS]
const adapter = await bridge.createFileAdapter('Demo', options);

try {
    await adapter.connect();

    const entry = await adapter.stat('report.csv');

    console.log(entry.size);
} finally {
    await adapter.disconnect();
}
```

:::

## Bridge construction options

Both `new DocklineBridge(options?)` and `createDocklineBridge(options?)` accept:

| Option | Behavior |
| --- | --- |
| `source?: ProfileSource & Partial<CredentialProvider>` | Exact-path lookup and, when implemented, default credential resolution. No automatic discovery. |
| `credentials?: CredentialProvider` | Overrides the source's `resolve`. A `CredentialResolver` can dispatch references from multiple explicitly registered sources. |
| `trust?: TrustProvider` | Default SSH/SFTP trust callback when no pin or runtime callback takes precedence. |
| `loadPackage?: (packageName: string) => Awaitable<unknown>` | Advanced embedding hook. Must supply the named Dockline package's standard module exports; ordinary applications use the default loader. |

The default loader checks the requested package before importing it. A missing top-level client receives an installation error. Failure inside an installed client remains the original failure rather than being relabeled as a missing package. `loadPackage` overrides loading only; it does not add unsupported protocols or implement SSH hops.

## Authentication and key selection

Profiles contain password/passphrase references, key metadata, agent selections or interactive intent. Providers are called only for an explicit configuration/connection operation. Metadata reads and bridge construction do not request credentials. A provider can return `available`, `not-stored`, `locked`, `unavailable` or `unsupported`; an available reference does not guarantee that the native store is still usable. References already marked `unsupported` are skipped before provider resolution; use explicit runtime authentication such as `password` or `passphrase` instead of relying on a replacement provider to unlock that reference.

Runtime authentication behavior is deliberate:

- `password`, `privateKey`, `privateKeyPath`, `agent` or `keyboardInteractive` bypass native private-key selection. Runtime values replace corresponding material; saved password and agent alternatives can remain configured. This does not guarantee that only one SSH authentication method is offered.
- `passphrase` alone retains the saved key path and overrides that key's passphrase. A replacement runtime key does not inherit the saved key's passphrase.
- Without those runtime selections, one saved key path can be used. Several native identities are refused because a single-key Dockline configuration cannot preserve their order. Supply explicit runtime authentication to select the intended material.
- An unavailable saved password does not prevent a usable configured key or agent. `promptPassword` is called only when no usable material, keyboard handler or file-transport credential callback is available.
- A saved interactive-only definition requires `keyboardInteractive`. Supplying `password` alone does not silently change that mode. Definitions containing other supported authentication alternatives may use those alternatives.

Saved key paths retain native format/base metadata. Relative paths without a base, or explicitly foreign operating-system paths, require a runtime `privateKeyPath` selection. Reading normalized metadata does not read the key; Dockline loads it when connecting.

| Execution option | Scope and precedence |
| --- | --- |
| `connectionId?: string` | Explicit compatible definition; required when there are several candidates. |
| `password?: string` | Runtime password, including an explicitly empty value. Replaces a saved password reference. |
| `passphrase?: string` | Runtime key passphrase; does not select a different key. |
| `privateKey?: string \| Buffer` | In-memory private key for SFTP. SSH command execution currently requires a path. |
| `privateKeyPath?: string` | Runtime private-key path on the host; bypasses saved key selection. |
| `agent?: string` | Explicit supported agent socket/pipe or `pageant`; no automatic agent discovery. |
| `keyboardInteractive?: SftpKeyboardInteractive` | String for a single prompt or callback returning one answer per grouped prompt. SSH and SFTP retain server challenge name, instructions, language, prompts and cancellation signal. |
| `promptPassword?: (challenge: PasswordChallenge) => Awaitable<string>` | Application password prompt fallback. Current bridge prompts use `kind: 'password'` and include the selected profile and connection; the exported challenge type also reserves `passphrase`. |
| `credentialProvider` | Dockline's file-transport callback for FTP/SFTP attempts. SSH commands reject this option; use Portline `credentials`, runtime values or `promptPassword`. |

FTP supports password/prompt-password or anonymous intent. Key, agent and keyboard-interactive FTP definitions are refused. Anonymous usernames map to `anonymous`. Unsupported native authentication is refused rather than reinterpreted.

## Trust and fingerprint precedence

SSH/SFTP verifies host identity using canonical SHA256 pins, an explicit application callback or default interactive terminal approval. Pins use `SHA256:` followed by canonical unpadded base64 for 32 bytes. Saved pins must be an array of valid strings; malformed arrays, string-instead-of-array input and noncanonical pins are invalid profiles.

Verification precedence is:

1. Runtime `hostFingerprint`.
2. A nonempty saved `connection.trust.fingerprints` array.
3. Runtime `trust` callback.
4. Bridge-level `trust` callback.
5. Default interactive terminal approval, when both stdin and stderr are terminals.

Pins compare exact fingerprint values for the selected host and port. Callbacks also bind that endpoint and accept only literal `true`. A callback cannot override an existing higher-priority pin. Without explicit trust, an interactive terminal can request session approval; unattended execution fails before opening a socket. The bridge does not import trust files automatically or persist approvals.

`TrustProvider` receives `{host, port, fingerprint, profile, connection, publicKey?, abortSignal?}`. SFTP supplies the wire-format public key and its attempt signal; SSH verification exposes the fingerprint. Application trust stores can inspect these values and explicitly decide whether to accept. The reader's native host-key import APIs remain reader-specific; the bridge accepts their result through explicit pins or policy.

| Option | Meaning |
| --- | --- |
| `hostFingerprint?: string` | One canonical SHA256 pin for this selected endpoint. |
| `trust?: TrustProvider` | Runtime callback used only when no pin takes precedence. |

## FTP TLS, paths and filename intent

| Saved TLS policy | File configuration |
| --- | --- |
| `none` | `protocol: 'ftp'` |
| `explicit` | `protocol: 'ftps'`, required explicit TLS |
| `implicit` | `protocol: 'ftps-implicit'` |
| `optional` | Refused until runtime `tls` explicitly chooses `none`, `explicit` or `implicit` |

When saved policy is already definite, a runtime `tls` value must equal it. There is no plaintext fallback or implicit upgrade/downgrade. Invalid saved/runtime TLS values and FTPS paired with `none` are refused. FileZilla's saved FTP/FTPES definitions normalize to required explicit TLS; its insecure FTP protocol normalizes to `none`.

Saved `remoteDirectory` becomes the file SDK root. File operations use server paths relative to that root; host upload/download paths stay local. Passive-mode and filename intent are passed to Dockline, which validates whether its client can honor them. Preserving an active-mode request does not claim active FTP support.

| Option or normalized field | Scope |
| --- | --- |
| `tls?: 'none' \| 'explicit' \| 'implicit'` | FTP policy disambiguation as described above. |
| `secureOptions` | FTP/FTPS TLS connection options. |
| `filenameEncoding?: {charset: string}` | Runtime file-name encoding overrides saved `filenameEncoding`. FTP supports the client's documented charsets; SFTP requires supported UTF-8 intent. File-content bytes are not transcoded. |
| `connection.passive?: boolean \| null` | Saved FTP transfer-mode intent. `null` means the client default. |

## Deadlines, retries and cancellation

`ExecutionOptions` extends Dockline's file connection/operation options. Their presence in the shared type does not make every file control an SSH command setting:

| Options | Applies to |
| --- | --- |
| `abortSignal` | Cancels source/credential/prompt waits and is passed to connection execution. Cancellation does not force a provider to stop its own work. |
| `timeoutMs` or `timeout` | File per-attempt deadline; for `withSsh`, bounds preparation and the scoped session. Zero disables that deadline. |
| `readyTimeout` | SSH/SFTP handshake readiness deadline; SSH requires a positive supported integer. |
| `autoReconnect`, `maxTransientRetries` | Dockline file-transport reconnect/retry policy; command callbacks are not automatically replayed. |
| `keepalive`, `onConnectionState`, `siteId` | Dockline file connection controls. Mapped file configuration uses the selected profile ID as `siteId`. |
| `onProgress`, `totalBytes`, `maxBytes`, `progressIntervalMs`, `bandwidth` | File-operation observation, limits and throughput policy. |

SSH command options are supplied separately to `session.exec` or `session.shell`. See [Dockline file operations](https://h2ooooooo.github.io/dockline/api/files) for transfer completion, retry and overwrite semantics. Source/credential resolution in standalone configuration methods is cancellation-aware; their transport timeout values do not create a preparation timer.

## Refusals and native writing

The selected definition is refused for nonempty `unsupportedOptions`, nonempty `via`, unsupported authentication, invalid endpoints, incompatible protocols or profile error diagnostics. Reader warnings alone are not all fatal; reader execution blockers identify settings such as native proxy commands, unsupported SSH evaluation or an undecodable remote root that must not be silently ignored.

These execution fields do not imply native-writer support. Current native codecs refuse nonempty `unsupportedOptions`, explicit boolean `passive`, `filenameEncoding` and nonempty SSH fingerprint pins; `passive: null` can be omitted. Credential references/values and trust approvals are not copied. See [native write-intent limits](/integration/native-writing#write-input-and-recovery-data).

## Error codes

`ProfileExecutionError` has `name: 'ProfileExecutionError'` and a stable `code`. Inspect the code instead of parsing its message:

| Code | Typical trigger and next action |
| --- | --- |
| `PROFILE_NOT_FOUND` | Exact path lookup had no selected profile, or a string input has no source. Select the intended source/path. |
| `CONNECTION_SELECTION_REQUIRED` | Several compatible definitions exist without `connectionId`. Choose one explicitly. |
| `UNSUPPORTED_PROFILE` | Unsupported native settings/authentication/hops/capability, ambiguous or changed TLS, multiple saved keys without explicit selection, or incompatible key paths. Resolve the recorded setting deliberately. |
| `MISSING_CREDENTIAL` | No usable authentication material/provider or required interactive handler. Supply supported runtime material or a provider. |
| `MISSING_TRUST` | No pin or explicit policy. Independently verify the server and supply trust. |
| `MISSING_HANDLER` | Required client is absent. Follow the named `npm install` command. |
| `INVALID_PROFILE` | Endpoint or canonical fingerprint data is invalid. Correct the profile/runtime pin. |

Installed-package failures, provider errors, cancellation and Dockline transport errors retain their own identities. Creating a bridge or preview never approves a connection or writes native settings. Consult the generated [TypeScript reference](/integration/reference/types) for every exact exported contract.

## Default interactive host approval

When neither a fingerprint nor a trust callback is configured, the shared bridge asks for SSH/SFTP host approval if both standard input and standard error are interactive terminals. It displays the endpoint and server fingerprint; only an explicit `yes` accepts a new host. Matching approvals are reused for that bridge instance. A changed approved key requires the distinct response `replace`. Approval is session-only and is never written to disk. Explicit pins and configured providers retain priority, and a pin mismatch never falls back to a prompt.

Redirected input, pipelines and unattended jobs do not prompt: configure a fingerprint or trust provider. Browser/server applications supply their own approval callback. The downloadable programs use explicit pins to remain reproducible in unattended checks; interactive callers may omit them.
