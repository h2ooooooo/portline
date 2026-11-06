import type {
    AuthenticationMethod, ConnectionDefinition, ConnectionProfile, CredentialProvider,
    CredentialReference, CredentialResult, SourceReference,
} from '@jalsoedesign/portline-abstract';
import {ProfileCatalog} from '@jalsoedesign/portline-core';
import type {NativeSession, NativeSettings} from './storage.js';

export type SecretLoader = (reference: CredentialReference) => Promise<CredentialResult>;

/** Raw application settings are opt-in and are never included in list/search/JSON. */
export class NativeProfileSource extends ProfileCatalog implements CredentialProvider {
    readonly #sessions: ReadonlyMap<string, NativeSettings>;

    readonly #loadSecret?: SecretLoader;

    public constructor(
        source: SourceReference,
        profiles: readonly ConnectionProfile[],
        sessions: readonly NativeSession[] = [],
        loadSecret?: SecretLoader,
    ) {
        super(source, profiles);
        this.#sessions = new Map(sessions.map(session => [session.name, structuredClone(session.settings)]));
        this.#loadSecret = loadSecret;
    }

    public getNativeSettings(name: string): NativeSettings | undefined {
        const settings = this.#sessions.get(name);

        return settings && structuredClone(settings);
    }

    public async resolve(reference: CredentialReference): Promise<CredentialResult> {
        if (reference.sourceId !== this.source.id) {
            return {state: 'unsupported'};
        }

        if (reference.state !== 'available') {
            return {state: reference.state};
        }

        const known = this.list().some(profile => profile.connections.some(connection =>
            connection.authentication.some(auth => {
                const actual = credentialOf(auth);

                return actual?.sourceId === reference.sourceId && actual.id === reference.id &&
                    actual.kind === reference.kind && actual.state === reference.state;
            })));

        if (!known) {
            return {state: 'unavailable'};
        }

        return this.#loadSecret?.(reference) ?? {state: 'unsupported'};
    }
}

export function credentialOf(auth: AuthenticationMethod): CredentialReference | undefined {
    if (auth.type === 'password') {
        return auth.credential;
    }

    if (auth.type === 'private-key') {
        return auth.passphrase;
    }

    return undefined;
}

export function credential(
    source: SourceReference,
    id: string,
    state: CredentialReference['state'],
    kind: CredentialReference['kind'] = 'password',
): CredentialReference {
    return {
        sourceId: source.id,
        id,
        state,
        kind,
    };
}

export function privateKey(filename: string | undefined): AuthenticationMethod[] {
    if (!filename) {
        return [];
    }

    return [
        {
            type: 'private-key',
            path: {value: filename, format: 'native'},
            format: /\.ppk$/i.test(filename) ? 'ppk' : 'unknown',
        },
    ];
}

export function nativeProfile(
    source: SourceReference,
    name: string,
    connections: readonly ConnectionDefinition[],
): ConnectionProfile {
    return {
        id: name,
        name: name.split(/[\\/]/).pop() || name,
        path: name.replace(/\\/g, '/'),
        source,
        connections,
        diagnostics: [],
    };
}

export function text(settings: NativeSettings, name: string, fallback = ''): string {
    const key = Object.keys(settings).find(item => item.toLowerCase() === name.toLowerCase());

    return key === undefined ? fallback : String(settings[key]);
}

export function port(value: string, fallback: number): number {
    const result = value ? Number(value) : fallback;

    if (!Number.isInteger(result) || result < 1 || result > 65535) {
        throw new Error('Invalid connection port');
    }

    return result;
}
