# Contributing to the ecosystem directory

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Edit only `ecosystem.json` to add or update an entry. Each record contains a stable identifier, display name, description, role, GitHub repository URL, npm package names, documentation URL, family and relevant applications.

Do not add current versions, download counts or release statistics. Use HTTPS links and stable npm package names. A package belongs to one entry.

```sh
npm run docs:catalog
npm run docs:check
npm run test:catalog
npm run docs:build
```

The catalog generator validates field names, duplicates and URLs. The generated ecosystem page is checked for drift; do not edit it by hand. Deploying documentation updates the directory without releasing any library or editing other repositories. Runtime libraries and normal CLI operation never fetch the catalog.
