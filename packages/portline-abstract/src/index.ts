export type Awaitable<T> = T | Promise<T>;

export type ProfileStorage =
    | {readonly kind: 'file'; readonly path: string; readonly format?: string} |
    {readonly kind: 'directory'; readonly path: string} |
    {
        readonly kind: 'registry';
        readonly hive: 'HKCU' | 'HKLM';
        readonly key: string;
        readonly view?: '32' | '64' | 'default';
    };

export interface SourceReference {
    readonly id: string;
    readonly application: string;
    readonly location?: string;
    readonly scope?: string;
    readonly storage?: readonly ProfileStorage[];
    readonly applicationVersion?: string;
    readonly executablePath?: string;
}

/** Discovery reports candidates rather than guessing which installation the user intends. */
export interface ProfileSourceDiscovery {
    discover(): Awaitable<{
        readonly candidates: readonly SourceReference[];
        readonly selectedSourceId?: string;
        readonly selectedBy?: 'explicit' | 'running-application' | 'application-default' | 'only-candidate';
        readonly diagnostics: readonly ProfileDiagnostic[];
    }>;
}

/** Optional writer contract. Readers do not need to implement native settings writes. */
export interface ProfileWriteInspection {
    readonly source: SourceReference;
    readonly revision: string;
    readonly lock: 'unlocked' | 'locked' | 'unknown';
    readonly application: 'closed' | 'open' | 'unknown';
    readonly diagnostics: readonly ProfileDiagnostic[];
}

export interface ProfileWritePlan {
    readonly sourceId: string;
    readonly expectedRevision: string;
    readonly changes: readonly {
        readonly profileId: string;
        readonly operation: 'create' | 'update' | 'delete';
        readonly fields: readonly string[];
    }[];
}

export interface ProfileWriter<TPlan extends ProfileWritePlan = ProfileWritePlan> {
    inspect(): Awaitable<ProfileWriteInspection>;
    plan(profiles: readonly ConnectionProfile[]): Awaitable<TPlan>;
    /** Reinspect native locks, application state and expectedRevision immediately before writing. */
    apply(plan: TPlan): Awaitable<void>;
}

export type CredentialState = 'available' | 'not-stored' | 'locked' | 'unavailable' | 'unsupported';

/** References describe credentials; profiles never contain secret values. */
export interface CredentialReference {
    readonly sourceId: string;
    readonly id: string;
    readonly kind: 'password' | 'passphrase' | 'proxy-password';
    readonly state: CredentialState;
}

export type CredentialResult =
    | {readonly state: 'available'; readonly value: string} |
    {readonly state: Exclude<CredentialState, 'available'>};

export interface CredentialProvider {
    resolve(reference: CredentialReference): Awaitable<CredentialResult>;
}

export interface ProfilePath {
    readonly value: string;
    readonly baseDirectory?: string;
    readonly format?: 'native' | 'windows' | 'posix';
}

export type AuthenticationMethod =
    | {readonly type: 'password'; readonly credential: CredentialReference} |
    {
        readonly type: 'private-key';
        readonly path?: ProfilePath;
        readonly format?: 'openssh' | 'pem' | 'ppk' | 'unknown';
        readonly passphrase?: CredentialReference;
    } |
    {readonly type: 'agent'; readonly agent?: string} |
    {readonly type: 'interactive'} |
    {readonly type: 'anonymous'} |
    {readonly type: 'unsupported'; readonly nativeType: string};

export interface ConnectionEndpoint {
    readonly host: string;
    readonly port: number;
    readonly username?: string;
}

export interface ConnectionBase {
    readonly id: string;
    readonly endpoint: ConnectionEndpoint;
    readonly authentication: readonly AuthenticationMethod[];
    /** Ordered SSH hops, referenced by connection ID within this profile. */
    readonly via?: readonly string[];
}

export type ConnectionDefinition = ConnectionBase & (
    | {readonly kind: 'ssh'; readonly protocol: 'ssh' | 'sftp'; readonly remoteDirectory?: string} |
    {
        readonly kind: 'ftp';
        readonly protocol: 'ftp' | 'ftps';
        readonly tls: 'none' | 'explicit' | 'implicit' | 'optional';
        readonly remoteDirectory?: string;
    } |
    {readonly kind: 'database'; readonly protocol: string; readonly database?: string} |
    {readonly kind: 'unsupported'; readonly protocol: string}
);

export interface ProfileDiagnostic {
    readonly code: string;
    readonly severity: 'warning' | 'error';
    readonly message: string;
    readonly field?: string;
}

export interface ConnectionProfile {
    readonly id: string;
    readonly path: string;
    readonly name: string;
    readonly source: SourceReference;
    readonly connections: readonly ConnectionDefinition[];
    readonly localDirectory?: ProfilePath;
    readonly diagnostics: readonly ProfileDiagnostic[];
}

export interface ProfileSearchOptions {
    readonly fields?: 'name' | 'all';
}

/** Sources may expose native profiles while providing a separate normalized projection. */
export interface ProfileSource<TProfile = ConnectionProfile> {
    readonly source: SourceReference;
    list(): Awaitable<readonly TProfile[]>;
    get(path: string): Awaitable<TProfile | undefined>;
    search(term: string, options?: ProfileSearchOptions): Awaitable<readonly TProfile[]>;
}

export interface ProfileTree<TProfile> {
    name: string;
    folders: ProfileTree<TProfile>[];
    profiles: TProfile[];
}

export type ConnectorCapability = 'file-transfer' | 'ssh-exec' | 'tcp-forward' | 'database';

/** Connector results are deliberately unconstrained: a tunnel is not a storage adapter. */
export abstract class ProfileConnectorFactory<TProfile, TConnector, TOptions = unknown> {
    public abstract fromProfile(profile: TProfile, options?: TOptions): TConnector;
}

export interface ConnectorProvider<TProfile, TConnector, TOptions, TProtocol = string> {
    readonly protocols: readonly TProtocol[];
    readonly factory: {fromProfile(profile: TProfile, options?: TOptions): TConnector};
    readonly validateOptions?: (options: unknown) => void;
}

export interface ConnectorRegistration<TProfile, TConnector, TOptions> {
    readonly fromProfile: (profile: TProfile, options?: TOptions) => TConnector;
}
