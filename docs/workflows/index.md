# Cross-application workflows

Choose a task, then follow the application library's API or CLI guide for its exact inputs and output. Portline supplies the common workflow; native formats and settings remain the responsibility of each adapter.

| Task | Start here |
| --- | --- |
| Read saved profiles and identify the selected settings store | [Find a saved connection](/workflows/read) |
| Inspect password status, SSH tunnel authentication or key paths | [Understand authentication](/workflows/authentication) |
| Copy a supported connection from one application to another | [Preview a one-way sync](/workflows/sync) |
| Understand locks, changed settings, backups or recovery | [Write safety and recovery](/workflows/safety) |
| Transfer files or run commands with a selected profile | [Shared file and SSH execution](/integration/execution) |
| Inspect or convert a private key | [Dockline Keys](/libraries/related#dockline-keys) |

## Choose the source first

Use the [library directory](/libraries/) to find the application that owns the existing settings. If multiple installations or storage backends are discovered, select the intended one before reading or planning changes.

## Keep execution separate

Reading a profile or creating a preview does not connect to the saved server. Applying a preview changes local application settings. Transfers and SSH operations are explicit calls to the optional [shared bridge](/integration/execution), which resolves selected credentials, requires SSH trust and closes scoped sessions. SQL and SSH-hop/tunnel execution require separate implementations.

To implement these workflows in a new adapter or embedded CLI, use [Build an integration](/integration/).
