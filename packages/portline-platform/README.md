# Portline platform

Native storage, discovery and guarded profile writing for the Portline family. NativeProfileWriter separates redacted preview intents from explicit apply, rejects changed/busy/unknown storage, and preserves unrelated native settings. Windows file commits use exclusive handles, backups and rollback. Registry commits default to native transactions; an explicit `registryMode: 'guarded'` policy supports hosts without transactions using checks, protected backups and conditional rollback. Guarded mode is not atomic and never bypasses app/lock checks. There is no automatic downgrade. Built-in apply is Windows-only. See the repository profile-writing guide for format boundaries and recovery limitations.

[Related libraries and applications](https://h2ooooooo.github.io/portline/ecosystem).
