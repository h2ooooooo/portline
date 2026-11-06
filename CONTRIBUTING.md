# Contributing

Use the coding conventions in CODING_STYLE.md. Run npm run check before proposing shared library changes.

## Add or update an ecosystem entry

Edit only ecosystem.json, then run:

~~~sh
npm run docs:build
npm run docs:check
npm run test:catalog
~~~

Each entry has an identifier, display name, short description, role, GitHub repository URL, npm package names, documentation URL, family and relevant applications. Use HTTPS links and stable npm package URLs. Do not add versions, download counts, release dates or registry snapshots. A package belongs to one entry.

The generator validates fields, duplicate identifiers/packages and URLs. docs/ecosystem.md is generated and checked for drift; do not edit it. The VitePress site is generated in ignored docs/.vitepress/dist/. Deploying a catalog change requires only the Portline documentation workflow, not an npm release or changes to other repositories.

[View the canonical directory](https://h2ooooooo.github.io/portline/ecosystem). Package imports and normal CLI operation never fetch catalog data.
