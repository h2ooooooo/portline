import {expect, it, vi} from 'vitest';
import type {ConnectionProfile, CredentialReference} from '@jalsoedesign/portline-abstract';
import {ProfileCatalog} from '@jalsoedesign/portline-core';
import {createNormalizedCliSource} from '../src/normalized.js';

it('keeps metadata secret-free and resolves each selected credential only with the reveal flag', async () => {
    const source = {id: 'source', application: 'fixture'};
    const password: CredentialReference = {
        sourceId: source.id,
        id: 'database',
        kind: 'password',
        state: 'available',
    };
    const phrase: CredentialReference = {
        sourceId: source.id,
        id: 'ssh',
        kind: 'passphrase',
        state: 'available',
    };
    const profile: ConnectionProfile = {
        id: 'work',
        name: 'Work',
        path: 'work',
        source,
        diagnostics: [],
        connections: [
            {
                id: 'database',
                kind: 'database',
                protocol: 'mysql',
                endpoint: {host: 'db', port: 3306},
                authentication: [{type: 'password', credential: password}],
                via: ['ssh'],
            },
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'ssh',
                endpoint: {host: 'gateway', port: 22},
                authentication: [
                    {
                        type: 'private-key',
                        path: {value: 'C:\\keys\\id.ppk'},
                        passphrase: phrase,
                    },
                ],
            },
        ],
    };
    const catalog = new ProfileCatalog(source, [profile]);
    const resolve = vi.fn(async () => ({state: 'available' as const, value: 'fixture-secret'}));
    const cli = createNormalizedCliSource(Object.assign(catalog, {resolve}));
    const hidden = await cli.properties(profile, {});

    expect(resolve).not.toHaveBeenCalled();
    expect(JSON.stringify(hidden)).not.toContain('fixture-secret');
    expect(hidden.keyFile).toBe('C:\\keys\\id.ppk');

    const revealed = await cli.properties(profile, {showPassword: true});

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(revealed.password).toBe('fixture-secret');
    expect(revealed.credentials).toContainEqual({
        connectionId: 'ssh',
        kind: 'passphrase',
        state: 'available',
        value: 'fixture-secret',
    });
    expect(JSON.stringify(revealed.connections)).not.toContain('fixture-secret');
});
