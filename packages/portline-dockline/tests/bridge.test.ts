import {describe, expect, it, vi} from 'vitest';
import type {ConnectionDefinition, ConnectionProfile, CredentialReference} from '@jalsoedesign/portline-abstract';
import {createDocklineBridge, ProfileExecutionError} from '../src/index.js';

const reference: CredentialReference = {
    sourceId: 'fixture',
    id: 'site',
    kind: 'password',
    state: 'available',
};
const password = {type: 'password', credential: reference} as const;

function profile(connection: Partial<ConnectionDefinition> = {}): ConnectionProfile {
    return {
        id: 'site',
        name: 'Saved site',
        path: 'folder/site',
        source: {id: 'fixture', application: 'Fixture'},
        diagnostics: [],
        connections: [
            {
                id: 'primary',
                kind: 'ftp',
                protocol: 'ftps',
                tls: 'explicit',
                endpoint: {host: 'example.test', port: 21, username: 'user'},
                authentication: [password],
                ...connection,
            } as ConnectionDefinition,
        ],
    };
}

function ssh(connection: Partial<ConnectionDefinition> = {}): ConnectionProfile {
    return profile({
        kind: 'ssh',
        protocol: 'sftp',
        endpoint: {host: 'ssh.test', port: 22, username: 'deploy'},
        ...connection,
    });
}

describe('normalized execution bridge', () => {
    it('constructs without loading readers, secrets or clients', () => {
        const loadPackage = vi.fn();
        const bridge = createDocklineBridge({loadPackage});

        expect(bridge).toBeDefined();
        expect(loadPackage).not.toHaveBeenCalled();
    });

    it('maps saved FTP TLS, root, passive mode and encoding without opening a session', async () => {
        const loadPackage = vi.fn();
        const config = await createDocklineBridge({loadPackage}).toConfig(profile({
            remoteDirectory: '/saved',
            passive: true,
            filenameEncoding: {charset: 'windows-1252'},
        }), {password: 'runtime', timeoutMs: 500, maxTransientRetries: 2});

        expect(config).toMatchObject({
            protocol: 'ftps',
            host: 'example.test',
            port: 21,
            username: 'user',
            password: 'runtime',
            root: '/saved',
            passive: true,
            filenameEncoding: {charset: 'windows-1252'},
            timeoutMs: 500,
            maxTransientRetries: 2,
        });
        expect(loadPackage).not.toHaveBeenCalled();
    });

    it('resolves only the selected profile secret explicitly and does not cache it', async () => {
        const saved = profile();
        const resolve = vi.fn().mockResolvedValue({state: 'available', value: 'secret'});
        const source = {
            source: saved.source,
            list: () => [saved],
            search: () => [saved],
            get: (selected: string) => selected === saved.path ? saved : undefined,
            resolve,
        };
        const bridge = createDocklineBridge({source});

        expect(resolve).not.toHaveBeenCalled();
        expect((await bridge.toConfig(saved.path)).password).toBe('secret');
        await bridge.toConfig(saved.path);
        expect(resolve).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(saved)).not.toContain('secret');
        await expect(bridge.toConfig('missing')).rejects.toMatchObject({code: 'PROFILE_NOT_FOUND'});
    });

    it('honors explicit credential overrides without resolving stored values', async () => {
        const resolve = vi.fn();
        const config = await createDocklineBridge({credentials: {resolve}}).toConfig(profile(), {password: ''});

        expect(config.password).toBe('');
        expect(resolve).not.toHaveBeenCalled();
    });

    it('requires deliberate TLS choice for ambiguous settings and rejects downgrade or invalid JS values', async () => {
        const bridge = createDocklineBridge();
        const ambiguous = profile({protocol: 'ftp', tls: 'optional'});

        await expect(bridge.toConfig(ambiguous, {password: 'p'})).rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
        expect((await bridge.toConfig(ambiguous, {password: 'p', tls: 'implicit'})).protocol).toBe('ftps-implicit');
        await expect(bridge.toConfig(profile(), {password: 'p', tls: 'none'})).rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
        await expect(bridge.toConfig(ambiguous, {password: 'p', tls: 'bogus' as 'none'}))
            .rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
        await expect(bridge.toConfig(profile({tls: 'none'}), {password: 'p'}))
            .rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
    });

    it('requires explicit selection when several compatible connections exist', async () => {
        const saved = profile();
        const multi = {...saved, connections: [...saved.connections, {...saved.connections[0], id: 'second'}]};
        const bridge = createDocklineBridge();

        await expect(bridge.toConfig(multi, {password: 'p'})).rejects.toMatchObject({code: 'CONNECTION_SELECTION_REQUIRED'});
        expect((await bridge.toConfig(multi, {password: 'p', connectionId: 'second'})).host).toBe('example.test');
        await expect(bridge.toConfig(multi, {password: 'p', connectionId: 'unknown'}))
            .rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
    });

    it.each([
        {unsupportedOptions: ['ProxyCommand']},
        {via: ['jump']},
        {authentication: [{type: 'unsupported', nativeType: 'account'}]},
    ])('refuses unsupported native settings before resolving credentials: %o', async connection => {
        const resolve = vi.fn();
        const bridge = createDocklineBridge({credentials: {resolve}});

        await expect(bridge.toConfig(profile(connection as Partial<ConnectionDefinition>), {password: 'p'}))
            .rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
        expect(resolve).not.toHaveBeenCalled();
    });

    it('refuses error diagnostics and invalid endpoints', async () => {
        const bridge = createDocklineBridge();
        const saved = profile();

        await expect(bridge.toConfig({...saved, diagnostics: [{code: 'BROKEN', severity: 'error', message: 'Broken'}]},
            {password: 'p'})).rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
        await expect(bridge.toConfig(profile({endpoint: {host: '', port: 0}}), {password: 'p'}))
            .rejects.toMatchObject({code: 'INVALID_PROFILE'});
    });

    it('distinguishes password prompting from keyboard-interactive authentication', async () => {
        const bridge = createDocklineBridge();
        const ask = ssh({authentication: [{type: 'prompt-password'}]});
        const interactive = ssh({authentication: [{type: 'interactive'}]});

        expect((await bridge.toConfig(ask, {promptPassword: () => 'answer', hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'})).password)
            .toBe('answer');
        await expect(bridge.toConfig(interactive, {password: 'wrong-mode', hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}))
            .rejects.toMatchObject({code: 'MISSING_CREDENTIAL'});

        const config = await bridge.toConfig(interactive, {keyboardInteractive: 'answer', hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'});

        expect(config.protocol === 'sftp' && config.keyboardInteractive).toBe('answer');
    });

    it('allows usable agent authentication when an alternative saved password is unavailable', async () => {
        const resolve = vi.fn().mockResolvedValue({state: 'not-stored'});
        const saved = ssh({authentication: [password, {type: 'agent', agent: 'pageant'}, {type: 'interactive'}]});
        const config = await createDocklineBridge({credentials: {resolve}}).toConfig(saved, {hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'});

        expect(config).toMatchObject({protocol: 'sftp', agent: 'pageant'});
        expect(config.password).toBeUndefined();
    });

    it('does not apply a native key passphrase to an overridden private key', async () => {
        const resolve = vi.fn().mockResolvedValue({state: 'available', value: 'native-secret'});
        const saved = ssh({authentication: [{type: 'private-key', path: {value: 'C:/saved.ppk'}, passphrase: reference}]});
        const config = await createDocklineBridge({credentials: {resolve}}).toConfig(saved,
            {privateKeyPath: 'C:/different.key', hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'});

        expect(config).toMatchObject({privateKeyPath: 'C:/different.key'});
        expect('passphrase' in config && config.passphrase).toBeUndefined();
        expect(resolve).not.toHaveBeenCalled();
    });

    it('requires SSH trust and pins the exact endpoint independently of runtime permissive callbacks', async () => {
        const bridge = createDocklineBridge();

        await expect(bridge.toConfig(ssh(), {password: 'p'})).rejects.toMatchObject({code: 'MISSING_TRUST'});

        const config = await bridge.toConfig(ssh(), {password: 'p', hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'});

        expect(config.protocol).toBe('sftp');

        if (config.protocol !== 'sftp') {
            throw new Error('Expected SFTP config');
        }

        const challenge = {
            host: 'ssh.test',
            port: 22,
            fingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            keyType: 'ssh-ed25519',
            publicKey: Buffer.alloc(0),
            changed: false,
            abortSignal: new AbortController().signal,
        };

        expect(config.requireTrustPolicy).toBe(true);
        expect(await config.hasTrustPolicy!(challenge)).toBe(true);
        expect(await config.hasTrustPolicy!({...challenge, host: 'other.test'})).toBe(false);
        expect(await config.hasTrustPolicy!({...challenge, fingerprint: 'SHA256:changed'})).toBe(false);
        expect(await config.acceptTrustPolicy!(challenge)).toBe(false);
    });

    it('passes full trust challenges to an explicit application policy without storing decisions', async () => {
        const trust = vi.fn().mockReturnValue(true);
        const saved = ssh();
        const config = await createDocklineBridge({trust}).toConfig(saved, {password: 'p'});

        if (config.protocol !== 'sftp') {
            throw new Error('Expected SFTP config');
        }

        const challenge = {
            host: 'ssh.test',
            port: 22,
            fingerprint: 'SHA256:key',
            keyType: 'ssh-ed25519',
            publicKey: Buffer.alloc(0),
            changed: false,
            abortSignal: new AbortController().signal,
        };

        expect(await config.hasTrustPolicy!(challenge)).toBe(false);
        expect(await config.acceptTrustPolicy!(challenge)).toBe(true);
        expect(trust).toHaveBeenCalledWith({...challenge, profile: saved, connection: saved.connections[0]});
    });

    it('loads only the selected file client and returns its disconnected adapter', async () => {
        const adapter = {connect: vi.fn(), disconnect: vi.fn()};
        const createConnector = vi.fn().mockReturnValue(adapter);
        const loadPackage = vi.fn().mockResolvedValue({createConnector});
        const result = await createDocklineBridge({loadPackage}).createFileAdapter(profile(), {password: 'p'});

        expect(result).toBe(adapter);
        expect(loadPackage).toHaveBeenCalledExactlyOnceWith('@jalsoedesign/dockline-ftp-client');
        expect(adapter.connect).not.toHaveBeenCalled();
    });

    it('delegates scoped files and callback failure cleanup to Dockline', async () => {
        const failure = new Error('callback failed');
        const withConnection = vi.fn(async (_config, callback) => callback({uploadFile: vi.fn()}));
        const loadPackage = vi.fn(async name => name.endsWith('core') ? {Dockline: {withConnection}} : {});
        const bridge = createDocklineBridge({loadPackage});

        await expect(bridge.withFiles(profile(), async () => {
            throw failure;
        }, {password: 'p'})).rejects.toBe(failure);
        expect(loadPackage.mock.calls.map(call => call[0])).toEqual(['@jalsoedesign/dockline-ftp-client', '@jalsoedesign/dockline-core']);
        expect(withConnection).toHaveBeenCalledOnce();
    });

    it('selects SSH explicitly on an SFTP endpoint and preserves its interactive handler', async () => {
        const keyboardInteractive = vi.fn().mockResolvedValue(['answer']);
        const withConnection = vi.fn(async callback => callback({exec: async () => ({code: 0, stdout: 'ok', stderr: ''})}));
        const constructor = vi.fn();

        class Client {
            constructor(config: unknown, services: unknown) {
                constructor(config, services);
            }

            withConnection = withConnection;
        }

        const loadPackage = vi.fn().mockResolvedValue({SshClient: Client});
        const saved = ssh({authentication: [{type: 'interactive'}]});
        const result = await createDocklineBridge({loadPackage}).withSsh(saved,
            async session => session.exec('whoami'), {hostFingerprint: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', keyboardInteractive});

        expect(result.stdout).toBe('ok');
        expect(loadPackage).toHaveBeenCalledExactlyOnceWith('@jalsoedesign/dockline-ssh-client');
        expect(constructor.mock.calls[0][1]).toMatchObject({keyboardInteractive});
        await expect(createDocklineBridge().toSshConfig(profile(), {password: 'p'}))
            .rejects.toMatchObject({code: 'UNSUPPORTED_PROFILE'});
    });

    it('preserves installed client load failures and cancellation before loading', async () => {
        const failure = new Error('installed package broken');
        const loadPackage = vi.fn().mockRejectedValue(failure);
        const bridge = createDocklineBridge({loadPackage});

        await expect(bridge.createFileAdapter(profile(), {password: 'p'})).rejects.toBe(failure);
        loadPackage.mockClear();

        const controller = new AbortController();

        controller.abort();
        await expect(bridge.createFileAdapter(profile(), {password: 'p', abortSignal: controller.signal}))
            .rejects.toMatchObject({name: 'AbortError'});
        expect(loadPackage).not.toHaveBeenCalled();
        expect(new ProfileExecutionError('MISSING_HANDLER', 'install')).toBeInstanceOf(Error);
    });
});
