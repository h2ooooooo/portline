import {describe, expect, it} from 'vitest';
import type {ConnectionProfile} from '@jalsoedesign/portline-abstract';
import {createDocklineBridge} from '../src/index.js';

const pin = 'SHA256:' + 'A'.repeat(43);

function profile(pins: unknown): ConnectionProfile {
    return {
        id: 'site',
        name: 'Site',
        path: 'site',
        source: {id: 'fixture', application: 'Fixture'},
        diagnostics: [],
        connections: [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'sftp',
                endpoint: {host: 'ssh.test', port: 22},
                authentication: [{type: 'prompt-password'}],
                trust: {fingerprints: pins as string[]},
            },
        ],
    };
}

describe('untyped trust pin inputs', () => {
    it.each([
        pin,
        [123],
        ['SHA256:short'],
        ['SHA256:' + 'B'.repeat(43)],
        {},
    ])('refuses malformed or noncanonical saved pins instead of substring matching: %o', async pins => {
        await expect(createDocklineBridge().toConfig(profile(pins), {password: 'p'}))
            .rejects.toMatchObject({code: 'INVALID_PROFILE'});
    });

    it('requires one canonical runtime fingerprint and accepts a canonical saved list', async () => {
        await expect(createDocklineBridge().toSshConfig(profile([pin]), {password: 'p', hostFingerprint: 'SHA256:short'}))
            .rejects.toMatchObject({code: 'INVALID_PROFILE'});
        expect((await createDocklineBridge().toConfig(profile([pin]), {password: 'p'})).protocol).toBe('sftp');
    });
});
