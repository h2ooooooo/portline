# Find a saved connection

Use the library for the application where the connection is saved. Start with its read commands or API quick start; shared class setup is only needed when building a new integration.

## Identify the settings source

An explicit file or registry selection gives a reproducible source. Discovery can list portable stores, registry candidates or IDE configurations where supported. The chosen source reports its location and backend rather than silently merging installations.

For example, with the FileZilla CLI installed, inspect a selected Site Manager file on the host:

```sh
filezilla-js source --file ./sitemanager.xml --json
```

The JSON describes the selected native source. Use a real settings file only when ready to read it; this is a command template, not a synthetic fixture.

## List, search and select

Use the selected application's `list` and `search` commands to find a profile, then `get` with its exact canonical path. Folder/profile paths identify saved records; they are not file-transfer destinations. Read commands inspect settings without connecting to the saved endpoint.

Native source flags and legacy output shapes differ. Choose the application's CLI documentation from the [library directory](/libraries/) for copyable commands and captured output. Use its API documentation when embedding reads in code.

## If discovery is ambiguous

Inspect candidates, select the required source explicitly and rerun the read. A config folder's version alone does not prove that a running application uses it. See [storage and discovery support](/libraries/compare#storage-and-discovery).

For metadata snapshots, credential resolution and source implementation contracts, continue to [Build an integration](/integration/profiles).
