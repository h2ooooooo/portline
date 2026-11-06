---
layout: home
pageClass: portline-home
hero:
  name: Portline
  text: Use the connections you've already saved.
  tagline: Read the profiles already configured in FileZilla, PuTTY, KiTTY, HeidiSQL, JetBrains, OpenSSH and WinSCP through JavaScript APIs and command-line tools.
  actions:
    - theme: brand
      text: Choose a library
      link: '#choose-the-application'
    - theme: alt
      text: Explore workflows
      link: /workflows/
---

<script setup>
import LibraryCards from './.vitepress/theme/LibraryCards.js';
</script>

## Choose the application

Start with the application that owns the connection. Each library has its own API quick start, CLI guide and examples.

<LibraryCards />

Compare [storage, discovery, credentials and writing support](/libraries/compare) before choosing a library.

## Why Portline?

You've already configured the connection in a tool you use. Scripts often ask for the same hostname, username, port, private-key path and remote directory again.

Portline makes those saved profiles available to code and terminal commands. Find a connection by name, reuse its settings, access stored credentials where supported, or preview changes to another application's profiles.

## Use the saved settings

- [Find the right connection](/workflows/read): discover a settings source, search profiles and select an exact saved path.
- [Inspect authentication](/workflows/authentication): distinguish credential references, private-key files on the host and directories on the server.
- [Preview a one-way sync](/workflows/sync): review supported changes before applying them to another application's profiles. Writers check revisions, application state and locks and retain recovery backups.

## Transfers, SSH and keys

[Dockline](https://h2ooooooo.github.io/dockline/) performs file transfers and SSH operations. Start with a selected profile and supply the available authentication to the appropriate client.

[Dockline Keys](https://h2ooooooo.github.io/dockline/keys/) works independently to load, inspect and convert keys, including PuTTY PPK v2/v3 and encrypted exports. See [related tools](/libraries/related) to choose the right part.

## Build an integration

Writing an adapter or embedding a profile CLI? The [integration documentation](/integration/) covers the shared packages, contracts and runnable examples. Application readers and executables remain in their own repositories.
