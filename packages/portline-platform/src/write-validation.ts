import {createHash} from 'node:crypto';
import type {ConnectionDefinition, ConnectionProfile} from '@jalsoedesign/portline-abstract';

export function digest(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function safeScalar(value: unknown, field: string): string {
    if (typeof value !== 'string' || /[\0\r\n\t]/.test(value) || value.length > 16384) {
        throw new Error('Invalid ' + field);
    }

    return value;
}

export function safeProfilePath(value: unknown): string {
    const result = safeScalar(value, 'profile path');

    if (!result || result.includes('\\') || result.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error('Profile paths require nonempty named components without traversal');
    }

    return result;
}

/** Whitelist the normalized shape; preview artifacts never serialize arbitrary native/raw objects. */
export function sanitizeProfile(profile: ConnectionProfile): ConnectionProfile {
    const input = profile as any;
    const profilePath = safeProfilePath(input.path);

    if (!Array.isArray(input.connections) || !input.connections.length) {
        throw new Error('A profile requires at least one connection');
    }

    const ids = new Set<string>();
    const connections: ConnectionDefinition[] = input.connections.map((item: any) => {
        const id = safeScalar(item.id, 'connection ID');

        if (ids.has(id)) {
            throw new Error('Duplicate connection ID');
        }

        ids.add(id);

        if (
            !['ssh', 'ftp', 'database'].includes(item.kind) ||
            !item.endpoint ||
            !Number.isInteger(item.endpoint.port) ||
            item.endpoint.port < 1 ||
            item.endpoint.port > 65535
        ) {
            throw new Error('Unsupported connection or invalid TCP port');
        }

        const host = safeScalar(item.endpoint.host, 'host');

        if (!host || /\s/.test(host)) {
            throw new Error('A nonempty host without whitespace is required');
        }

        if (!Array.isArray(item.authentication)) {
            throw new Error('Authentication metadata is required');
        }

        const authentication = item.authentication.map((auth: any) => {
            if (auth.type === 'private-key') {
                return {
                    type: 'private-key',
                    path: auth.path ? {
                        value: safeScalar(auth.path.value, 'private key path'),
                        baseDirectory: auth.path.baseDirectory === undefined ? undefined :
                            safeScalar(auth.path.baseDirectory, 'key base directory'),
                    } : undefined,
                    format: ['openssh', 'pem', 'ppk', 'unknown'].includes(auth.format) ? auth.format : 'unknown',
                };
            }

            if (['password', 'agent', 'interactive', 'anonymous'].includes(auth.type)) {
                // References cannot carry credential values into preview files or native writers.
                return auth.type === 'password' ? {
                    type: 'password',
                    credential: {
                        sourceId: 'omitted',
                        id: 'omitted',
                        kind: 'password',
                        state: 'not-stored',
                    },
                } : {type: auth.type};
            }

            throw new Error('Unsupported authentication cannot be copied safely');
        });
        const protocol = safeScalar(item.protocol, 'protocol');
        const common = {
            id,
            endpoint: {
                host,
                port: item.endpoint.port,
                username: item.endpoint.username === undefined ? undefined : safeScalar(item.endpoint.username, 'username'),
            },
            authentication,
            via: item.via?.map((hop: unknown) => safeScalar(hop, 'SSH hop')),
        };

        if (item.kind === 'ssh' && ['ssh', 'sftp'].includes(protocol)) {
            return {
                ...common,
                kind: 'ssh',
                protocol,
                remoteDirectory: item.remoteDirectory === undefined ? undefined :
                    safeScalar(item.remoteDirectory, 'remote directory'),
            } as ConnectionDefinition;
        }

        if (
            item.kind === 'ftp' &&
            ['ftp', 'ftps'].includes(protocol) &&
            ['none', 'explicit', 'implicit', 'optional'].includes(item.tls)
        ) {
            return {
                ...common,
                kind: 'ftp',
                protocol,
                tls: item.tls,
                remoteDirectory: item.remoteDirectory === undefined ? undefined :
                    safeScalar(item.remoteDirectory, 'remote directory'),
            } as ConnectionDefinition;
        }

        if (item.kind === 'database' && ['mysql', 'postgresql', 'mssql'].includes(protocol)) {
            return {
                ...common,
                kind: 'database',
                protocol,
                database: item.database === undefined ? undefined : safeScalar(item.database, 'database'),
            };
        }

        throw new Error('Unsupported protocol or TLS policy');
    });

    for (const connection of connections) {
        if (connection.via?.some(id => !ids.has(id))) {
            throw new Error('A referenced SSH hop is missing');
        }
    }

    if (input.diagnostics?.some((item: any) => item.severity === 'error' ||
        ['native-proxy', 'native-ssh-options', 'unsupported-match', 'native-authentication'].includes(item.code))) {
        throw new Error('Source requires native connection handling; resolve its diagnostics before syncing');
    }

    return {
        id: safeScalar(input.id ?? profilePath, 'source profile ID'),
        path: profilePath,
        name: safeScalar(input.name ?? profilePath.split('/').pop(), 'name'),
        source: {
            id: safeScalar(input.source?.id ?? 'import', 'origin source ID'),
            application: safeScalar(input.source?.application ?? 'import', 'origin application'),
        },
        connections,
        localDirectory: input.localDirectory ? {value: safeScalar(input.localDirectory.value, 'local directory')} : undefined,
        diagnostics: [],
    };
}
