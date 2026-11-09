import {describe, expect, it, vi} from 'vitest';
import type {ConnectionProfile} from '@jalsoedesign/portline-abstract';
import {createDocklineBridge} from '../src/index.js';

function profile(): ConnectionProfile {
    return {
        id: 'selected',
        path: 'selected',
        name: 'Selected',
        source: {id: 'fixture', application: 'Fixture'},
        diagnostics: [],
        connections: [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'sftp',
                endpoint: {host: 'ssh.test', port: 22, username: 'user'},
                authentication: [
                    {type: 'private-key', path: {value: 'first.key', baseDirectory: process.cwd()}},
                    {type: 'private-key', path: {value: 'second.key', baseDirectory: process.cwd()}},
                ],
            },
        ],
    };
}

describe('execution preparation safeguards', () => {
    it('refuses several native identities unless the caller explicitly selects runtime authentication', async () => {
        const bridge = createDocklineBridge();

        await expect(bridge.toConfig(profile(), {hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}))
            .rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});

        const config = await bridge.toConfig(profile(), {agent: 'pageant', hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'});

        expect(config).toMatchObject({agent: 'pageant'});
        expect('privateKeyPath' in config && config.privateKeyPath).toBeUndefined();
    });

    it('aborts a pending credential lookup without starting a prompt or loading a client', async () => {
        const saved = profile();
        const selected = {
            ...saved,
            connections: [
                {
                    ...saved.connections[0],
                    authentication: [
                        {
                            type: 'password' as const,
                            credential: {
                                sourceId: 'fixture',
                                id: 'selected',
                                kind: 'password' as const,
                                state: 'available' as const,
                            },
                        },
                    ],
                },
            ],
        };
        const controller = new AbortController();
        const resolve = vi.fn(() => new Promise<never>(() => {}));
        const promptPassword = vi.fn();
        const loadPackage = vi.fn();
        const bridge = createDocklineBridge({credentials: {resolve}, loadPackage});
        const operation = bridge.createFileAdapter(selected,
            {hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', abortSignal: controller.signal, promptPassword});

        await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
        controller.abort();
        await expect(operation).rejects.toMatchObject({name: 'AbortError'});
        expect(promptPassword).not.toHaveBeenCalled();
        expect(loadPackage).not.toHaveBeenCalled();
    });
});
