# Understand authentication and key paths

A saved connection can contain a password reference, a private-key path, agent settings or multiple authentication contexts. Inspect these before choosing a connection or planning a sync.

## Password and passphrase status

Normalized profile output describes credentials without including their values. The application's CLI masks supported secret output by default; `--show-password` explicitly requests resolution where supported. Legacy APIs can have different loading defaults, so follow the selected library's credential guide.

An available reference does not guarantee that a locked or changed store can return a value. Unsupported formats and locked stores remain explicit. Keep revealed values out of logs and shared command transcripts.

## Private-key paths

A private-key path points to a file on the host. A remote directory identifies a location on the saved server. They serve different purposes and must not be interchanged.

Profile readers can report the saved key path and its base-directory metadata without loading its contents. Use [Dockline Keys](/libraries/related#dockline-keys) to inspect or convert the key separately. Cross-application sync does not copy private-key contents or import host trust policies.

## Database sessions and SSH tunnels

HeidiSQL database and SSH tunnel endpoints have independent credentials. When copying its SSH tunnel to an SSH-oriented destination, select the `ssh` connection explicitly. Do not use the database host as an inferred SSH endpoint. See the [sync example](/workflows/sync).

For exact support, choose an [application library](/libraries/compare#authentication-and-writes). For implementing explicit credential providers, see the [integration example](/integration/credentials).
