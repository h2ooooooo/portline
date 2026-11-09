import {createTerminalTrustProvider} from './terminal-trust.js';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import type {Awaitable, ConnectionDefinition, ConnectionProfile, CredentialProvider, CredentialReference, ProfilePath, ProfileSource} from '@jalsoedesign/portline-abstract';
import type {ConnectorConnectionOptions, ConnectorOperationOptions, SftpKeyboardInteractive, TransferAdapter, TransferConfig} from '@jalsoedesign/dockline-abstract' with {'resolution-mode': 'import'};
import type {Dockline} from '@jalsoedesign/dockline-core' with {'resolution-mode': 'import'};

export type BridgeErrorCode = 'PROFILE_NOT_FOUND' | 'CONNECTION_SELECTION_REQUIRED' | 'UNSUPPORTED_PROFILE' | 'MISSING_CREDENTIAL' | 'MISSING_TRUST' | 'MISSING_HANDLER' | 'INVALID_PROFILE';

export class ProfileExecutionError extends Error {
    public constructor(public readonly code: BridgeErrorCode, message: string) {
        super(message);
        this.name = 'ProfileExecutionError';
    }
}

export interface TrustChallenge {
    readonly host: string;
    readonly port: number;
    readonly fingerprint: string;
    readonly profile: ConnectionProfile;
    readonly connection: ConnectionDefinition;
    readonly publicKey?: Buffer;
    readonly abortSignal?: AbortSignal;
}

export type TrustProvider = (challenge: TrustChallenge) => Awaitable<boolean>;

export interface PasswordChallenge {
    readonly profile: ConnectionProfile;
    readonly connection: ConnectionDefinition;
    readonly kind: 'password' | 'passphrase';
}

export interface DocklineBridgeOptions {
    readonly source?: ProfileSource & Partial<CredentialProvider>;
    readonly credentials?: CredentialProvider;
    readonly trust?: TrustProvider;
    /** Override loading for embedded runtimes; no protocol package is loaded during metadata reads. */
    readonly loadPackage?: (packageName: string) => Awaitable<unknown>;
}

export interface ExecutionOptions extends ConnectorOperationOptions, ConnectorConnectionOptions {
    connectionId?: string;
    password?: string;
    passphrase?: string;
    privateKey?: string | Buffer;
    privateKeyPath?: string;
    agent?: string;
    keyboardInteractive?: SftpKeyboardInteractive;
    promptPassword?: (challenge: PasswordChallenge) => Awaitable<string>;
    hostFingerprint?: string;
    trust?: TrustProvider;
    /** Required when the saved FTP TLS mode is ambiguous; required TLS cannot be downgraded. */
    tls?: 'none' | 'explicit' | 'implicit';
    secureOptions?: import('node:tls').ConnectionOptions;
    filenameEncoding?: {charset: string};
    readyTimeout?: number;
}

export interface SshConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    passphrase?: string;
    privateKeyPath?: string;
    agent?: string;
    keyboardInteractive?: boolean;
    hostFingerprint?: string;
    readyTimeout?: number;
}

export interface SshExecOptions {
    timeout?: string | number;
    sudo?: boolean | string;
    allowFailure?: boolean;
}

export interface SshExecResult {
    code: number;
    stdout: string;
    stderr: string;
}

export interface SshSession {
    exec(program: string, args?: string[], options?: SshExecOptions): Promise<SshExecResult>;
    shell(command: string, options?: SshExecOptions): Promise<SshExecResult>;
    asUser<T>(user: string, callback: (session: SshSession) => Promise<T>): Promise<T>;
}

interface FileClientModule {
    createConnector(config: TransferConfig): TransferAdapter;
}

interface DocklineModule {
    Dockline: {withConnection<T>(config: TransferConfig, callback: (remote: Dockline) => Promise<T>): Promise<T>};
}

interface SshClientModule {
    SshClient: new (config: SshConfig, services: {
        signal?: AbortSignal;
        keyboardInteractive?: SftpKeyboardInteractive;
        trust(host: string, port: number, fingerprint: string): Promise<boolean>;
        ask(question: {message: string; type: 'password' | 'input'}): Promise<string>;
    }) => {withConnection<T>(callback: (session: SshSession) => Promise<T>): Promise<T>};
}

type ProfileInput = ConnectionProfile | string;
type Selected = {profile: ConnectionProfile; connection: ConnectionDefinition};

function refuse(message: string): never {
    throw new ProfileExecutionError('UNSUPPORTED_PROFILE', message);
}

async function waitFor<T>(value: Awaitable<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) {
        return value;
    }

    signal.throwIfAborted();

    return new Promise<T>((resolve, reject) => {
        const abort = () => reject(signal.reason);

        signal.addEventListener('abort', abort, {once: true});
        Promise.resolve(value).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
}

function nativePath(value: ProfilePath): string {
    if (
        value.format &&
        value.format !== 'native' &&
        ((value.format === 'windows') !== (process.platform === 'win32'))
    ) {
        refuse('The saved private-key path uses another operating system; supply privateKeyPath explicitly.');
    }

    if (path.isAbsolute(value.value)) {
        return value.value;
    }

    if (!value.baseDirectory) {
        refuse('The saved private-key path is relative without a base directory; supply privateKeyPath explicitly.');
    }

    return path.resolve(value.baseDirectory, value.value);
}

/** Shared normalized profile execution. Native readers supply metadata; Dockline owns sessions and operations. */
export class DocklineBridge {
    private readonly terminalTrust = createTerminalTrustProvider();

    public constructor(private readonly options: DocklineBridgeOptions = {}) {}

    private async select(input: ProfileInput, options: ExecutionOptions, capability: 'files' | 'ssh'): Promise<Selected> {
        options.abortSignal?.throwIfAborted();

        const profile = typeof input === 'string' ?
            await waitFor(this.options.source?.get(input), options.abortSignal) : input;

        options.abortSignal?.throwIfAborted();

        if (!profile) {
            throw new ProfileExecutionError('PROFILE_NOT_FOUND', 'The selected profile was not found in this source.');
        }

        if (profile.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
            refuse('The profile contains an error diagnostic; correct the native settings before execution.');
        }

        const candidates = profile.connections.filter(connection => capability === 'ssh' ?
            connection.kind === 'ssh' : connection.kind === 'ssh' || connection.kind === 'ftp');
        const connection = options.connectionId ?
            candidates.find(candidate => candidate.id === options.connectionId) :
            candidates.length === 1 ? candidates[0] : undefined;

        if (!connection) {
            throw new ProfileExecutionError(candidates.length > 1 && !options.connectionId ?
                'CONNECTION_SELECTION_REQUIRED' : 'UNSUPPORTED_PROFILE',
            candidates.length > 1 && !options.connectionId ?
                'Select connectionId explicitly because this profile has several compatible connections.' :
                'The selected profile connection does not support the requested capability.');
        }

        if (connection.unsupportedOptions?.length) {
            refuse(`The saved connection requires unsupported settings: ${connection.unsupportedOptions.join(', ')}.`);
        }

        if (
            (connection.kind === 'ftp' &&
                !['ftp', 'ftps'].includes(connection.protocol)) ||
                (connection.kind === 'ssh' &&
                    !['ssh', 'sftp'].includes(connection.protocol))
        ) {
            refuse('The saved connection protocol is inconsistent with its capability.');
        }

        if (connection.via?.length) {
            refuse('SSH hops are not supported by this bridge; configure a forwarding handler explicitly.');
        }

        if (
            !connection.endpoint.host ||
            !Number.isSafeInteger(connection.endpoint.port) ||
            connection.endpoint.port < 1 ||
            connection.endpoint.port > 65535
        ) {
            throw new ProfileExecutionError('INVALID_PROFILE', 'The saved endpoint needs a host and a valid port.');
        }

        if (!connection.authentication.length || connection.authentication.some(auth => auth.type === 'unsupported')) {
            refuse('The saved authentication mode is unsupported; choose a supported native authentication mode.');
        }

        return {profile, connection};
    }

    private async secret(
        reference: CredentialReference | undefined, signal?: AbortSignal,
    ): Promise<string | undefined> {
        if (!reference || reference.state === 'unsupported') {
            return undefined;
        }

        const provider = this.options.credentials ?? this.options.source;

        if (!provider?.resolve) {
            return undefined;
        }

        signal?.throwIfAborted();

        const result = await waitFor(provider.resolve(reference), signal);

        return result.state === 'available' ? result.value : undefined;
    }

    private async authentication(selected: Selected, options: ExecutionOptions): Promise<{
        password?: string;
        passphrase?: string;
        privateKey?: string | Buffer;
        privateKeyPath?: string;
        agent?: string;
        keyboardInteractive?: SftpKeyboardInteractive;
    }> {
        const {profile, connection} = selected;
        const result = {
            password: options.password,
            passphrase: options.passphrase,
            privateKey: options.privateKey,
            privateKeyPath: options.privateKeyPath,
            agent: options.agent,
            keyboardInteractive: options.keyboardInteractive,
        };

        const alternativeAuth = connection.authentication.some(auth =>
            auth.type === 'password' || auth.type === 'prompt-password' ||
            auth.type === 'private-key' || auth.type === 'agent');

        if (
            connection.authentication.some(auth => auth.type === 'interactive') &&
            !alternativeAuth &&
            result.keyboardInteractive === undefined
        ) {
            throw new ProfileExecutionError('MISSING_CREDENTIAL',
                'The saved authentication mode requires a keyboardInteractive handler.');
        }

        const runtimeAuth = options.privateKey !== undefined || options.privateKeyPath !== undefined ||
            options.agent !== undefined || options.password !== undefined || options.keyboardInteractive !== undefined;
        const nativeKeys = connection.authentication.filter(auth => auth.type === 'private-key');

        if (nativeKeys.length > 1 && !runtimeAuth) {
            refuse('Several saved private keys require an explicit privateKeyPath, agent or other runtime authentication selection.');
        }

        for (const auth of connection.authentication) {
            if (auth.type === 'anonymous') {
                if (connection.kind !== 'ftp') {
                    refuse('Anonymous authentication is supported only for FTP.');
                }

                result.password ??= '';
            } else if (auth.type === 'password' || auth.type === 'prompt-password') {
                result.password ??= await this.secret(auth.credential, options.abortSignal);
            } else if (auth.type === 'private-key' && !runtimeAuth) {
                if (!result.privateKey && !result.privateKeyPath && auth.path) {
                    result.privateKeyPath = nativePath(auth.path);
                }

                if (!options.privateKey && !options.privateKeyPath) {
                    result.passphrase ??= await this.secret(auth.passphrase, options.abortSignal);
                }
            } else if (auth.type === 'agent') {
                result.agent ??= auth.agent;
            }
        }

        if (
            result.password === undefined &&
            !result.privateKey &&
            !result.privateKeyPath &&
            !result.agent &&
            result.keyboardInteractive === undefined &&
            !options.credentialProvider
        ) {
            if (options.promptPassword) {
                options.abortSignal?.throwIfAborted();
                result.password = await waitFor(options.promptPassword({profile, connection, kind: 'password'}), options.abortSignal);
            } else {
                throw new ProfileExecutionError('MISSING_CREDENTIAL',
                    'Supply credentials, password, privateKeyPath, agent, promptPassword or keyboardInteractive for this profile.');
            }
        }

        options.abortSignal?.throwIfAborted();

        return result;
    }

    private validFingerprint(value: unknown): value is string {
        if (typeof value !== 'string' || !/^SHA256:[A-Za-z0-9+/]{43}$/.test(value)) {
            return false;
        }

        return Buffer.from(value.slice(7), 'base64').toString('base64').replace(/=+$/, '') === value.slice(7);
    }

    private verifier(selected: Selected, options: ExecutionOptions): TrustProvider {
        const {profile, connection} = selected;
        const savedPins = connection.kind === 'ssh' ? connection.trust?.fingerprints : undefined;

        if (
            (options.hostFingerprint !== undefined &&
                !this.validFingerprint(options.hostFingerprint)) ||
                (savedPins !== undefined &&
                    (!Array.isArray(savedPins) ||
                        !savedPins.every(value => this.validFingerprint(value))))
        ) {
            throw new ProfileExecutionError('INVALID_PROFILE',
                'SSH trust pins must be exact canonical SHA256 fingerprints in an array; hostFingerprint must be one canonical fingerprint.');
        }

        const pins = options.hostFingerprint ? [options.hostFingerprint] : savedPins;

        if (pins?.length) {
            return challenge => challenge.host === connection.endpoint.host &&
                challenge.port === connection.endpoint.port && pins.includes(challenge.fingerprint);
        }

        const trust = options.trust ?? this.options.trust ?? this.terminalTrust;

        if (!trust) {
            throw new ProfileExecutionError('MISSING_TRUST',
                'No interactive terminal is available. Supply hostFingerprint or an explicit trust callback before connecting to SSH/SFTP.');
        }

        return async challenge => challenge.host === connection.endpoint.host &&
            challenge.port === connection.endpoint.port && await trust({...challenge, profile, connection}) === true;
    }

    public async toConfig(input: ProfileInput, options: ExecutionOptions = {}): Promise<TransferConfig> {
        const selected = await this.select(input, options, 'files');
        const {profile, connection} = selected;
        const authentication = await this.authentication(selected, options);
        const {
            connectionId: _id, promptPassword: _prompt, trust: _trust, hostFingerprint: _pin,
            tls: _tls, ...runtime
        } = options;
        const common = {
            ...runtime,
            ...authentication,
            host: connection.endpoint.host,
            port: connection.endpoint.port,
            username: connection.authentication.some(auth => auth.type === 'anonymous') ?
                'anonymous' : connection.endpoint.username ?? '',
            root: 'remoteDirectory' in connection ? connection.remoteDirectory ?? '' : '',
            siteId: profile.id,
            filenameEncoding: options.filenameEncoding ?? connection.filenameEncoding,
        };

        if (connection.kind === 'ftp') {
            if (
                !['none', 'explicit', 'implicit', 'optional'].includes(connection.tls) ||
                (options.tls !== undefined &&
                    !['none', 'explicit', 'implicit'].includes(options.tls)) ||
                    (connection.protocol === 'ftps' &&
                        connection.tls === 'none')
            ) {
                refuse('The saved FTP TLS mode or runtime TLS option is invalid.');
            }

            if (
                connection.authentication.some(auth => auth.type === 'private-key' || auth.type === 'agent' ||
                    auth.type === 'interactive') ||
                    options.privateKey ||
                    options.privateKeyPath ||
                    options.agent ||
                    options.keyboardInteractive !== undefined
            ) {
                refuse('FTP requires password or anonymous authentication.');
            }

            if (options.tls && connection.tls !== 'optional' && options.tls !== connection.tls) {
                refuse('A runtime TLS option cannot change the saved required FTP TLS mode.');
            }

            const tls = options.tls ?? connection.tls;

            if (tls === 'optional') {
                refuse('The saved FTP TLS mode is ambiguous; supply tls: explicit, implicit or none deliberately.');
            }

            return {
                ...common,
                protocol: tls === 'implicit' ? 'ftps-implicit' : tls === 'explicit' ? 'ftps' : 'ftp',
                passive: connection.passive,
            };
        }

        const verify = this.verifier(selected, options);
        const pinned = Boolean(options.hostFingerprint ||
            (connection.kind === 'ssh' && connection.trust?.fingerprints?.length));

        return {
            ...common,
            protocol: 'sftp',
            requireTrustPolicy: true,
            hasTrustPolicy: pinned ? challenge => verify({...challenge, ...selected}) : () => false,
            acceptTrustPolicy: pinned ? () => false : challenge => verify({...challenge, ...selected}),
        };
    }

    public async toSshConfig(input: ProfileInput, options: ExecutionOptions = {}): Promise<SshConfig> {
        const selected = await this.select(input, options, 'ssh');
        const authentication = await this.authentication(selected, options);

        this.verifier(selected, options);

        if (authentication.privateKey) {
            refuse('SSH execution currently requires privateKeyPath; in-memory private keys are supported for SFTP.');
        }

        if (options.credentialProvider) {
            refuse('SSH execution requires a Portline credentials provider or promptPassword instead of a transport credentialProvider.');
        }

        return {
            host: selected.connection.endpoint.host,
            port: selected.connection.endpoint.port,
            username: selected.connection.endpoint.username ?? '',
            password: authentication.password,
            passphrase: authentication.passphrase,
            privateKeyPath: authentication.privateKeyPath,
            agent: authentication.agent,
            keyboardInteractive: authentication.keyboardInteractive !== undefined,
            hostFingerprint: options.hostFingerprint,
            readyTimeout: options.readyTimeout,
        };
    }

    private async load(packageName: string): Promise<unknown> {
        if (this.options.loadPackage) {
            return this.options.loadPackage(packageName);
        }

        const require = createRequire(__filename);
        let resolved: string;

        try {
            resolved = require.resolve(packageName);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
                throw error;
            }

            const manifest = require('../package.json') as {peerDependencies: Record<string, string>};
            const range = manifest.peerDependencies[packageName];
            const specification = range?.includes('-') ? `${packageName}@${range.replace(/^\^/, '')}` : packageName;

            throw new ProfileExecutionError('MISSING_HANDLER',
                `Install ${packageName} to execute this capability: npm install ${specification}`);
        }

        return import(pathToFileURL(resolved).href);
    }

    public async createFileAdapter(input: ProfileInput, options: ExecutionOptions = {}): Promise<TransferAdapter> {
        const config = await this.toConfig(input, options);
        const client = await this.load(config.protocol === 'sftp' ?
            '@jalsoedesign/dockline-sftp-client' : '@jalsoedesign/dockline-ftp-client') as FileClientModule;

        options.abortSignal?.throwIfAborted();

        return client.createConnector(config);
    }

    public async withFiles<T>(input: ProfileInput, callback: (remote: Dockline) => Promise<T>,
        options: ExecutionOptions = {}): Promise<T> {
        const config = await this.toConfig(input, options);

        await this.load(config.protocol === 'sftp' ?
            '@jalsoedesign/dockline-sftp-client' : '@jalsoedesign/dockline-ftp-client');

        const core = await this.load('@jalsoedesign/dockline-core') as DocklineModule;

        options.abortSignal?.throwIfAborted();

        return core.Dockline.withConnection(config, callback);
    }

    public async withSsh<T>(input: ProfileInput, callback: (session: SshSession) => Promise<T>,
        options: ExecutionOptions = {}): Promise<T> {
        const timeout = options.timeoutMs ?? options.timeout;
        const signals = [options.abortSignal, timeout ? AbortSignal.timeout(timeout) : undefined]
            .filter((signal): signal is AbortSignal => signal !== undefined);
        const signal = signals.length ? AbortSignal.any(signals) : undefined;
        const scopedOptions = {...options, abortSignal: signal};
        const selected = await this.select(input, scopedOptions, 'ssh');
        const config = await this.toSshConfig(selected.profile, {
            ...scopedOptions,
            connectionId: selected.connection.id,
        });
        const verify = this.verifier(selected, scopedOptions);
        const ssh = await this.load('@jalsoedesign/dockline-ssh-client') as SshClientModule;

        signal?.throwIfAborted();

        const client = new ssh.SshClient(config, {
            signal,
            keyboardInteractive: options.keyboardInteractive,
            trust: async (host, port, fingerprint) => verify({
                host,
                port,
                fingerprint,
                abortSignal: signal,
                ...selected,
            }),
            ask: async question => {
                if (typeof options.keyboardInteractive === 'string') {
                    return options.keyboardInteractive;
                }

                throw new ProfileExecutionError('MISSING_CREDENTIAL', 'Supply a keyboardInteractive handler.');
            },
        });

        return client.withConnection(callback);
    }
}

export function createDocklineBridge(options: DocklineBridgeOptions = {}): DocklineBridge {
    return new DocklineBridge(options);
}
