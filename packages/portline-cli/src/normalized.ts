import type {
    ConnectionProfile, CredentialProvider, CredentialReference, ProfileSource,
} from '@jalsoedesign/portline-abstract';
import type {ProfileCliOptions, ProfileCliSource} from './types.js';

/** Common presentation only; native settings never enter CLI serialization. */
export function createNormalizedCliSource(
    source: ProfileSource & Partial<CredentialProvider>,
): ProfileCliSource<ConnectionProfile> {
    async function properties(profile: ConnectionProfile, options: ProfileCliOptions) {
        const connection = profile.connections[0];
        const keyFiles = profile.connections.flatMap(item => item.authentication)
            .filter(auth => auth.type === 'private-key').map(auth => auth.path?.value).filter(Boolean);
        const passwordAuth = connection?.authentication.find(auth => auth.type === 'password');
        const reference: CredentialReference | undefined = passwordAuth?.credential;
        let credentialState = reference?.state ?? 'not-stored';
        let password = reference?.state === 'available' ? '(hidden)' : '';
        const key = connection?.authentication.find(auth => auth.type === 'private-key');
        const phrase = key?.passphrase;
        let passphrase = phrase?.state === 'available' ? '(hidden)' : '';
        const credentials = [];

        for (const item of profile.connections) {
            for (const auth of item.authentication) {
                const ref = auth.type === 'password' ? auth.credential :
                    auth.type === 'private-key' ? auth.passphrase : undefined;

                if (ref) {
                    const result = options.showPassword && ref.state === 'available' ? await source.resolve?.(ref) : undefined;

                    credentials.push({
                        connectionId: item.id,
                        kind: ref.kind,
                        state: result?.state ?? ref.state,
                        ...(result?.state === 'available' ? {value: result.value} : {}),
                    });

                    if (ref === reference && result) {
                        credentialState = result.state;
                        password = result.state === 'available' ? result.value : '(' + result.state + ')';
                    }

                    if (ref === phrase && result) {
                        passphrase = result.state === 'available' ? result.value : '(' + result.state + ')';
                    }
                }
            }
        }

        return {
            name: profile.name,
            path: profile.path,
            protocol: connection?.protocol ?? '',
            host: connection?.endpoint.host ?? '',
            port: connection?.endpoint.port,
            user: connection?.endpoint.username ?? '',
            password,
            passphrase,
            credentialState,
            credentials,
            authentication: credentials.map(item => item.connectionId + '/' + item.kind + ': ' + item.state +
                (!options.showPassword && item.state === 'available' ? ' (hidden*)' : '')).join('; '),
            keyFile: keyFiles.join('; '),
            remoteDirectory: connection && 'remoteDirectory' in connection ? connection.remoteDirectory ?? '' : '',
            connections: profile.connections,
            diagnostics: profile.diagnostics,
            source: profile.source,
        };
    }

    return {
        source: source.source,
        secretFields: ['password', 'passphrase'],
        hasHiddenSecrets: profile => profile.connections.some(connection => connection.authentication.some(auth =>
            auth.type === 'password' ? auth.credential.state === 'available' :
                auth.type === 'private-key' && auth.passphrase?.state === 'available')),
        list: () => source.list(),
        get: path => source.get(path),
        search: (term, options) => source.search(term, options),
        path: profile => profile.path,
        summary: properties,
        properties,
        property: async (profile, name, options) => {
            const values = await properties(profile, options);

            return Object.prototype.hasOwnProperty.call(values, name) ? values[name as keyof typeof values] : undefined;
        },
        summaryFields: [
            {key: 'name', label: 'Name'},
            {key: 'path', label: 'Path'},
            {key: 'protocol', label: 'Protocol'},
            {key: 'host', label: 'Host'},
            {key: 'port', label: 'Port'},
            {key: 'user', label: 'Username'},
            {key: 'password', label: 'Password'},
            {key: 'passphrase', label: 'Passphrase'},
            {key: 'credentialState', label: 'Credential state'},
            {key: 'authentication', label: 'Authentication'},
            {key: 'keyFile', label: 'Private key'},
            {key: 'remoteDirectory', label: 'Remote'},
        ],
    };
}
