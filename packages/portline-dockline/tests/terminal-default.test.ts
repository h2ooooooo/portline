import {expect, it} from 'vitest';
import {createDocklineBridge} from '../src/index.js';
import type {ConnectionProfile} from '@jalsoedesign/portline-abstract';

it('prepares default terminal approval without requiring a fingerprint in advance', async () => {
    const input = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    const output = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

    Object.defineProperty(process.stdin, 'isTTY', {value: true, configurable: true});
    Object.defineProperty(process.stderr, 'isTTY', {value: true, configurable: true});

    try {
        const profile: ConnectionProfile = {
            id: 'site',
            path: 'Site',
            name: 'Site',
            source: {id: 'fixture', application: 'Fixture'},
            diagnostics: [],
            connections: [
                {
                    id: 'primary',
                    kind: 'ssh',
                    protocol: 'sftp',
                    endpoint: {host: 'example.test', port: 22},
                    authentication: [{type: 'prompt-password'}],
                },
            ],
        };
        const config = await createDocklineBridge().toConfig(profile, {password: 'fixture'});

        if (config.protocol !== 'sftp') {
            throw new Error('Expected SFTP');
        }

        expect(config.requireTrustPolicy).toBe(true);
        expect(typeof config.acceptTrustPolicy).toBe('function');
    } finally {
        if (input) {
            Object.defineProperty(process.stdin, 'isTTY', input);
        } else {
            Reflect.deleteProperty(process.stdin, 'isTTY');
        }

        if (output) {
            Object.defineProperty(process.stderr, 'isTTY', output);
        } else {
            Reflect.deleteProperty(process.stderr, 'isTTY');
        }
    }
});
