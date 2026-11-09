# Portline Core

Application-independent profile queries, catalogs, credential orchestration, connector registration and sync planning.

- `searchProfiles`, `getProfileByPath` and `buildProfileTree` query a source without requiring its native application model.
- `ProfileCatalog` provides exact-path selection and metadata search.
- `CredentialResolver` dispatches explicit requests to source-specific providers without caching returned secrets.
- `ProfileConnectorRegistry` dispatches registered factories and retains provider-specific options/results. It supplies no built-in transport mapping.
- `planProfileSync` selects connections and their dependencies for a writer; it does not resolve secrets or execute SSH hops.

Native discovery and transport execution are outside this package. The optional [Portline Dockline bridge](https://h2ooooooo.github.io/portline/integration/execution) maps supported normalized profiles from any reader to file-transfer or SSH sessions. Application readers still interpret native settings; Dockline implements transports.

See the [API guide](https://h2ooooooo.github.io/portline/integration/reference/api), [credential providers](https://h2ooooooo.github.io/portline/integration/credentials) and [ecosystem directory](https://h2ooooooo.github.io/portline/ecosystem).
