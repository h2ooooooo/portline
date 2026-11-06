import {describe, expect, it, vi} from 'vitest';
import type {ConnectionProfile, CredentialReference} from '@jalsoedesign/portline-abstract';
import {assertProfileWriteAllowed, buildProfileTree, CredentialResolver, ProfileCatalog, ProfileConnectorRegistry} from '../src/index.js';

const source = {id: 'test', application: 'Example application'};
const profile: ConnectionProfile = {
    id: 'gateway',
    path: 'Production/Gateway',
    name: 'Gateway',
    source,
    diagnostics: [],
    connections: [
        {
            id: 'ssh',
            kind: 'ssh',
            protocol: 'ssh',
            endpoint: {host: 'gateway.example.invalid', port: 2222, username: 'deploy'},
            authentication: [{type: 'agent'}],
        },
    ],
};

describe('profile catalog', () => {
    it('keeps exact selection separate from name and all-field substring search', () => {
        const catalog = new ProfileCatalog(source, [profile]);

        expect(catalog.get('Production/Gateway')).toBe(profile);
        expect(catalog.get('production/gateway')).toBeUndefined();
        expect(catalog.search('GATEWAY')).toEqual([profile]);
        expect(catalog.search('2222')).toEqual([]);
        expect(catalog.search('2222', {fields: 'all'})).toEqual([profile]);
        expect(catalog.search('', {fields: 'all'})).toEqual([profile]);
        expect(catalog.list()).not.toBe(catalog.list());
    });

    it('rejects ambiguous source identities and builds trees with source-defined folder decoding', () => {
        expect(() => new ProfileCatalog(source, [profile, {...profile, id: 'other'}])).toThrow('unique');
        expect(() => new ProfileCatalog({...source, id: 'other'}, [profile])).toThrow('source');

        const tree = buildProfileTree([profile], {
            path: item => item.path,
            folderNames: () => ['Folder/with slash'],
        });

        expect(tree.folders[0].name).toBe('Folder/with slash');
        expect(tree.folders[0].profiles).toEqual([profile]);
    });
});

describe('credential resolution', () => {
    const reference: CredentialReference = {
        sourceId: source.id,
        id: profile.id,
        kind: 'password',
        state: 'available',
    };

    it('resolves only explicitly requested available credentials and does not cache secrets', async () => {
        const resolver = new CredentialResolver();
        const resolve = vi.fn().mockResolvedValue({state: 'available', value: 'synthetic-secret'});

        resolver.register(source.id, {resolve});
        expect(resolve).not.toHaveBeenCalled();
        expect(await resolver.resolve({...reference, state: 'locked'})).toEqual({state: 'locked'});
        expect(resolve).not.toHaveBeenCalled();
        expect(await resolver.resolve(reference)).toEqual({state: 'available', value: 'synthetic-secret'});
        await resolver.resolve(reference);
        expect(resolve).toHaveBeenCalledTimes(2);
        expect(() => resolver.register(source.id, {resolve})).toThrow('already');
        expect(await resolver.resolve({...reference, sourceId: 'missing'})).toEqual({state: 'unsupported'});
    });
});

describe('connector providers', () => {
    it('uses string protocols and keeps tunnel factories independent from file storage', () => {
        const registry = new ProfileConnectorRegistry<ConnectionProfile>({
            protocolFor: item => item.connections[0].protocol,
        }, 'tcp-forward');
        const fromProfile = vi.fn((_item: ConnectionProfile, options?: {localPort: number}) => ({
            localPort: options?.localPort ?? 0,
            close() {},
        }));
        const validateOptions = vi.fn();
        const protocols = ['ssh'];
        const registration = registry.register({protocols, factory: {fromProfile}, validateOptions});

        protocols.push('unsupported');
        expect(registration.fromProfile(profile, {localPort: 1234}).localPort).toBe(1234);
        expect(validateOptions).toHaveBeenCalledWith({localPort: 1234});
        expect(registry.protocols()).toEqual(['ssh']);
        expect(() => registry.register({protocols: ['ssh'], factory: {fromProfile}})).toThrow('already');
        expect(() => registry.fromProfile({...profile, connections: []})).toThrow();
    });

    it('rejects incompatible typed handles and registers providers atomically', () => {
        const registry = new ProfileConnectorRegistry<{protocol: string}>({protocolFor: item => item.protocol});
        const factory = {fromProfile: () => 'connected'};
        const registration = registry.register({protocols: ['ssh'], factory});

        expect(() => registration.fromProfile({protocol: 'ftp'})).toThrow('compatible');
        expect(() => registry.register({protocols: ['ftp', 'ssh'], factory})).toThrow('already');
        expect(registry.protocols()).toEqual(['ssh']);
        expect(() => registry.fromProfile({protocol: 'ftp'})).toThrow('compatible');
        expect(registry.register({protocols: ['ssh'], factory}, {replace: true}).fromProfile({protocol: 'ssh'}))
            .toBe('connected');
    });
});

describe('optional native writer policy', () => {
    const plan = {sourceId: source.id, expectedRevision: 'revision-1', changes: []};
    const inspection = {
        source,
        revision: 'revision-1',
        lock: 'unlocked' as const,
        application: 'closed' as const,
        diagnostics: [],
    };

    it('allows only a matching revision after the adapter establishes the target is idle and unlocked', () => {
        expect(() => assertProfileWriteAllowed(inspection, plan)).not.toThrow();
        expect(() => assertProfileWriteAllowed({...inspection, revision: 'revision-2'}, plan)).toThrow('changed');
        expect(() => assertProfileWriteAllowed({...inspection, source: {...source, id: 'another'}}, plan)).toThrow('changed');
    });

    it.each([
        {lock: 'locked', application: 'closed'},
        {lock: 'unknown', application: 'closed'},
        {lock: 'unlocked', application: 'open'},
        {lock: 'unlocked', application: 'unknown'},
    ] as const)('blocks writes when native inspection reports %j', state => {
        expect(() => assertProfileWriteAllowed({...inspection, ...state}, plan)).toThrow('locked, in use');
    });
});
