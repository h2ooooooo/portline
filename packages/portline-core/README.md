# Portline Core

Application-independent profile queries, catalogs, credential orchestration and connector registration.

- `searchProfiles`, `getProfileByPath` and `buildProfileTree` operate on source adapters without requiring a native application model.
- `ProfileCatalog` provides exact selection and metadata search for normalized profiles.
- `CredentialResolver` dispatches explicit credential requests to source-specific providers without caching secrets.
- `ProfileConnectorRegistry` supports arbitrary connector results and source-defined protocol keys. Typed registration handles retain provider-specific options and result types. Use separate registries for file transfer, execution, tunneling and database capabilities.

No native setting discovery or transport execution lives here. File transfer stays with Dockline; authentication format handling and application host-key import remain in their respective adapters/providers.

See [the architecture and migration notes](../../docs/connection-profiles.md).

[Related libraries and applications](https://h2ooooooo.github.io/portline/ecosystem).
