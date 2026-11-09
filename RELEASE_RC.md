# First release candidate

Historical prerelease notes. See [Stable release](RELEASE.md) for the current stable versions.

This release uses the `rc` npm tag. Existing stable `latest` tags remain unchanged. Install this candidate explicitly:

```sh
npm install @jalsoedesign/portline-abstract@rc @jalsoedesign/portline-cli@rc @jalsoedesign/portline-core@rc @jalsoedesign/portline-dockline@rc @jalsoedesign/portline-platform@rc
```

| Package | Candidate |
| --- | --- |
| `@jalsoedesign/portline-abstract` | `1.0.0-rc.1` |
| `@jalsoedesign/portline-cli` | `1.0.0-rc.1` |
| `@jalsoedesign/portline-core` | `1.0.0-rc.1` |
| `@jalsoedesign/portline-dockline` | `1.0.0-rc.1` |
| `@jalsoedesign/portline-platform` | `1.0.0-rc.1` |

Family dependencies explicitly include the candidate versions. A stable range such as `^1.0.0` does not accept `1.0.0-rc.1`.

Saved profiles use the shared `@jalsoedesign/portline-dockline` execution bridge. Install the FTP, SFTP or SSH Dockline handler required by the operation. Reader packages continue to work without execution handlers.

For SSH and SFTP through the bridge, an interactive terminal asks you to confirm unknown fingerprints by default. Explicit pins and trust callbacks take priority. Unattended jobs require configured trust. Default bridge approvals last for that bridge instance and are not written to disk.
