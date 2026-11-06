# Related tools

The Portline family reads and changes saved connection settings. Use the following tools when the task moves beyond those settings.

## Dockline

Use Dockline for FTP/FTPS/SFTP transfers and SSH operations. Its documentation provides generic connection examples and host-verification setup.

- [API documentation](https://h2ooooooo.github.io/dockline/api/)
- [CLI documentation](https://h2ooooooo.github.io/dockline/cli/)

FileZilla's connector packages add the mapping from saved FileZilla sites to Dockline. Other normalized Portline profiles require explicit supported transport mapping; there is no universal executor for every profile or tunnel chain.

## Dockline Keys

Use Dockline Keys independently for key inspection, loading, conversion and encrypted exports. It supports the documented OpenSSH, PuTTY PPK v2/v3 and PEM formats. Supported algorithms and encryption options are listed in its [dedicated documentation](https://h2ooooooo.github.io/dockline/keys/).

A saved private-key path identifies a file on the host. Reading profile metadata does not load, convert or copy the private-key contents. Host trust still needs separate verification.

## Database operations

HeidiSQL profiles describe database endpoints and SSH tunnels. SQL queries, database exports and imports require a database implementation; the profile libraries do not supply a shared SQL engine.

## Shared Portline packages

The shared libraries support adapter authors and integrations. For contracts, catalogs, credential providers, CLI embedding and native writer infrastructure, see [Build an integration](/integration/).
