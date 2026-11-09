import {describe, expect, it} from 'vitest';
import type {ConnectionProfile} from '@jalsoedesign/portline-abstract';
import {sanitizeProfile} from '../src/write-validation.js';

function profile(): ConnectionProfile {
    return {
        id: 'site',
        path: 'site',
        name: 'Site',
        source: {id: 'fixture', application: 'Fixture'},
        diagnostics: [],
        connections: [
            {
                id: 'primary',
                kind: 'ssh',
                protocol: 'sftp',
                endpoint: {host: 'ssh.test', port: 22},
                authentication: [
                    {
                        type: 'prompt-password',
                        credential: {
                            sourceId: 'fixture',
                            id: 'private-reference',
                            kind: 'password',
                            state: 'available',
                        },
                    },
                ],
            },
        ],
    };
}

describe('native writer execution metadata boundaries', () => {
    it('accepts password prompt metadata while stripping credential references', () => {
        const safe = sanitizeProfile(profile());

        expect(safe.connections[0].authentication).toEqual([{type: 'prompt-password'}]);
        expect(JSON.stringify(safe)).not.toContain('private-reference');
    });

    it.each([
        {unsupportedOptions: ['ProxyCommand']},
        {passive: true},
        {passive: false},
        {filenameEncoding: {charset: 'windows-1252'}},
        {trust: {fingerprints: ['SHA256:pin']}},
    ])('refuses execution settings that native codecs cannot preserve: %o', extra => {
        const saved = profile();
        const input = {...saved, connections: [{...saved.connections[0], ...extra}]};

        expect(() => sanitizeProfile(input)).toThrow('Execution-specific settings cannot be copied safely');
    });
});
