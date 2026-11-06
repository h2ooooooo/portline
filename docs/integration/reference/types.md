<!-- Generated from public package declarations by scripts/generate-api-docs.mjs. -->
# TypeScript reference

These signatures come from the public package entry points and their re-exports. Build the libraries and run `npm run docs:api` to update them. Use the API guide for behavior and examples.

## @jalsoedesign/portline-abstract

### index.d.ts

```ts
export type Awaitable<T> = T | Promise<T>;
export type ProfileStorage = {
    readonly kind: 'file';
    readonly path: string;
    readonly format?: string;
} | {
    readonly kind: 'directory';
    readonly path: string;
} | {
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
export type CredentialResult = {
    readonly state: 'available';
    readonly value: string;
} | {
    readonly state: Exclude<CredentialState, 'available'>;
};
export interface CredentialProvider {
    resolve(reference: CredentialReference): Awaitable<CredentialResult>;
}
export interface ProfilePath {
    readonly value: string;
    readonly baseDirectory?: string;
    readonly format?: 'native' | 'windows' | 'posix';
}
export type AuthenticationMethod = {
    readonly type: 'password';
    readonly credential: CredentialReference;
} | {
    readonly type: 'private-key';
    readonly path?: ProfilePath;
    readonly format?: 'openssh' | 'pem' | 'ppk' | 'unknown';
    readonly passphrase?: CredentialReference;
} | {
    readonly type: 'agent';
    readonly agent?: string;
} | {
    readonly type: 'interactive';
} | {
    readonly type: 'anonymous';
} | {
    readonly type: 'unsupported';
    readonly nativeType: string;
};
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
export type ConnectionDefinition = ConnectionBase & ({
    readonly kind: 'ssh';
    readonly protocol: 'ssh' | 'sftp';
    readonly remoteDirectory?: string;
} | {
    readonly kind: 'ftp';
    readonly protocol: 'ftp' | 'ftps';
    readonly tls: 'none' | 'explicit' | 'implicit' | 'optional';
    readonly remoteDirectory?: string;
} | {
    readonly kind: 'database';
    readonly protocol: string;
    readonly database?: string;
} | {
    readonly kind: 'unsupported';
    readonly protocol: string;
});
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
export declare abstract class ProfileConnectorFactory<TProfile, TConnector, TOptions = unknown> {
    abstract fromProfile(profile: TProfile, options?: TOptions): TConnector;
}
export interface ConnectorProvider<TProfile, TConnector, TOptions, TProtocol = string> {
    readonly protocols: readonly TProtocol[];
    readonly factory: {
        fromProfile(profile: TProfile, options?: TOptions): TConnector;
    };
    readonly validateOptions?: (options: unknown) => void;
}
export interface ConnectorRegistration<TProfile, TConnector, TOptions> {
    readonly fromProfile: (profile: TProfile, options?: TOptions) => TConnector;
}
```

## @jalsoedesign/portline-cli

### index.d.ts

```ts
export * from './types.js';
export * from './output.js';
export * from './commands.js';
export * from './cli.js';
export * from './normalized.js';
export * from './writing.js';
```

### types.d.ts

```ts
import type { Awaitable, ProfileSource } from '@jalsoedesign/portline-abstract';
export interface ProfileCliOptions {
    json?: boolean;
    table?: boolean;
    file?: string;
    help?: boolean;
    search?: string;
    recurse?: boolean;
    full?: boolean;
    showPassword?: boolean;
    [name: string]: string | boolean | undefined;
}
/** Native property shapes and path decoding belong to the source adapter. */
export interface ProfileCliSource<TProfile> extends ProfileSource<TProfile> {
    summary(profile: TProfile, options: ProfileCliOptions): Awaitable<Record<string, any>>;
    properties(profile: TProfile, options: ProfileCliOptions): Awaitable<Record<string, any>>;
    property(profile: TProfile, name: string, options: ProfileCliOptions): Awaitable<unknown>;
    path(profile: TProfile): string;
    folderNames?(profile: TProfile): readonly string[];
    readonly treeProfilesKey?: string;
    readonly secretFields?: readonly string[];
    hasHiddenSecrets?(profile: TProfile): Awaitable<boolean>;
    readonly plainGetOmitFields?: readonly string[];
    readonly summaryFields?: readonly {
        readonly key: string;
        readonly label: string;
    }[];
}
export interface ProfileCommandContext<TProfile> {
    source: ProfileCliSource<TProfile>;
    args: string[];
    options: ProfileCliOptions;
    executableName?: string;
    singular?: string;
    plural?: string;
}
export interface ProfileCliOption {
    readonly flag: string;
    readonly key: string;
    readonly takesValue?: boolean;
    readonly description: string;
}
export interface ProfileCliDefinition<TProfile> {
    readonly name: string;
    readonly loadSource: (options: ProfileCliOptions) => Awaitable<ProfileCliSource<TProfile>>;
    readonly singular?: string;
    readonly plural?: string;
    readonly help?: string;
    readonly sourceOptions?: readonly ProfileCliOption[];
    readonly commands?: Readonly<Record<string, (args: string[]) => Awaitable<void>>>;
    readonly ignoreUnknownOptions?: boolean;
}
```

### output.d.ts

```ts
import type { ProfileCliOptions } from './types.js';
export declare function formatOutput(data: any, options: ProfileCliOptions, tableData?: {
    columns: string[];
    rows: (string | number | boolean | undefined)[][];
}): void;
```

### commands.d.ts

```ts
import type { ProfileCommandContext } from './types.js';
export declare function sourceCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void>;
export declare function searchCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void>;
export declare function listCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void>;
export declare function getCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void>;
```

### cli.d.ts

```ts
import type { ProfileCliDefinition, ProfileCliOptions } from './types.js';
export declare function parseProfileArgs(args: readonly string[], definition?: Pick<ProfileCliDefinition<unknown>, 'sourceOptions' | 'ignoreUnknownOptions'>): {
    options: ProfileCliOptions;
    positional: string[];
};
/** Runs without exiting the process so other applications can embed or test it. */
export declare function createProfileCli<TProfile>(definition: ProfileCliDefinition<TProfile>): {
    run(args?: string[]): Promise<number>;
};
```

### normalized.d.ts

```ts
import type { ConnectionProfile, CredentialProvider, ProfileSource } from '@jalsoedesign/portline-abstract';
import type { ProfileCliSource } from './types.js';
/** Common presentation only; native settings never enter CLI serialization. */
export declare function createNormalizedCliSource(source: ProfileSource & Partial<CredentialProvider>): ProfileCliSource<ConnectionProfile>;
```

### writing.d.ts

```ts
import type { SourceReference } from '@jalsoedesign/portline-abstract';
import type { NativeProfileWriter, WritableApplication } from '@jalsoedesign/portline-platform';
import type { ProfileCliOption, ProfileCliOptions } from './types.js';
export interface ProfileWriteCliDefinition {
    readonly application: WritableApplication;
    readonly sourceOptions?: readonly ProfileCliOption[];
    readonly importSource?: (name: string) => Promise<any>;
    readonly writer: (options: ProfileCliOptions) => Promise<NativeProfileWriter>;
}
export declare const profileWriteOptions: readonly ProfileCliOption[];
/** Each destination embeds this workflow; read commands and legacy output are unchanged. */
export declare function createProfileWriteCommands(definition: ProfileWriteCliDefinition): {
    write: (args: string[]) => Promise<void>;
    sync: (args: string[]) => Promise<void>;
    apply: (args: string[]) => Promise<void>;
    'write-status': (args: string[]) => Promise<void>;
};
/** Writer factories use an explicit, single storage target; never infer it from a saved preview. */
export interface ProfileWriterFactoryOptions {
    readonly source: SourceReference;
    readonly mode?: 'create' | 'update' | 'upsert';
    readonly allowLossy?: boolean;
    readonly registryMode?: 'transactional' | 'guarded';
}
```

## @jalsoedesign/portline-core

### index.d.ts

```ts
export * from './query.js';
export * from './ProfileCatalog.js';
export * from './CredentialResolver.js';
export * from './ConnectorRegistry.js';
export * from './write-policy.js';
export * from './sync.js';
```

### query.d.ts

```ts
import type { ProfileSearchOptions, ProfileTree } from '@jalsoedesign/portline-abstract';
export interface ProfileQueryAdapter<TProfile> {
    path(profile: TProfile): string;
    name(profile: TProfile): string;
    searchValues(profile: TProfile): readonly unknown[];
    folderNames?(profile: TProfile): readonly string[];
}
export declare function searchProfiles<TProfile>(profiles: readonly TProfile[], term: string, adapter: ProfileQueryAdapter<TProfile>, options?: ProfileSearchOptions): TProfile[];
export declare function getProfileByPath<TProfile>(profiles: readonly TProfile[], path: string, pathFor: (profile: TProfile) => string): TProfile | undefined;
export declare function buildProfileTree<TProfile>(profiles: readonly TProfile[], adapter: Pick<ProfileQueryAdapter<TProfile>, 'path' | 'folderNames'>): ProfileTree<TProfile>;
```

### ProfileCatalog.d.ts

```ts
import type { ConnectionProfile, ProfileSearchOptions, ProfileSource, SourceReference } from '@jalsoedesign/portline-abstract';
/** In-memory source for normalized profiles, also useful for importer implementations. */
export declare class ProfileCatalog implements ProfileSource {
    readonly source: SourceReference;
    private readonly profiles;
    constructor(source: SourceReference, profiles: readonly ConnectionProfile[]);
    list(): readonly ConnectionProfile[];
    get(path: string): ConnectionProfile | undefined;
    search(term: string, options?: ProfileSearchOptions): readonly ConnectionProfile[];
}
```

### CredentialResolver.d.ts

```ts
import type { CredentialProvider, CredentialReference, CredentialResult } from '@jalsoedesign/portline-abstract';
/** Secret retrieval is explicit and uncached; listing profiles never invokes a provider. */
export declare class CredentialResolver implements CredentialProvider {
    private readonly providers;
    register(sourceId: string, provider: CredentialProvider): void;
    resolve(reference: CredentialReference): Promise<CredentialResult>;
}
```

### ConnectorRegistry.d.ts

```ts
import type { ConnectorCapability, ConnectorProvider, ConnectorRegistration } from '@jalsoedesign/portline-abstract';
export interface ConnectorRegistryOptions<TProfile, TProtocol> {
    protocolFor(profile: TProfile): TProtocol;
    unsupported?(protocol: TProtocol, registered: boolean): Error;
}
/** Registries are scoped to a capability; register separate factories for SFTP and tunneling. */
export declare class ProfileConnectorRegistry<TProfile, TProtocol = string> {
    private readonly options;
    readonly capability?: ConnectorCapability | undefined;
    private readonly providers;
    constructor(options: ConnectorRegistryOptions<TProfile, TProtocol>, capability?: ConnectorCapability | undefined);
    register<TConnector, TOptions>(provider: ConnectorProvider<TProfile, TConnector, TOptions, TProtocol>, options?: {
        replace?: boolean;
    }): ConnectorRegistration<TProfile, TConnector, TOptions>;
    /** Use the registration handle to retain provider-specific result and option types. */
    fromProfile(profile: TProfile, options?: unknown): unknown;
    protocols(): readonly TProtocol[];
    private unsupported;
}
```

### write-policy.d.ts

```ts
import type { ProfileWriteInspection, ProfileWritePlan } from '@jalsoedesign/portline-abstract';
/** Native adapters call this after a fresh inspection; it does not acquire a lock or perform a write. */
export declare function assertProfileWriteAllowed(inspection: ProfileWriteInspection, plan: ProfileWritePlan): void;
```

### sync.d.ts

```ts
import type { ProfileSource, ProfileWriter, ProfileWritePlan } from '@jalsoedesign/portline-abstract';
export interface ProfileSyncMapping {
    readonly sourcePath: string;
    readonly targetPath: string;
    readonly connectionId?: string;
}
/** One-way, exact-path sync. No pruning, credential resolution or implicit connection selection. */
export declare function planProfileSync<TPlan extends ProfileWritePlan>(source: ProfileSource, writer: ProfileWriter<TPlan>, mappings: readonly ProfileSyncMapping[]): Promise<TPlan>;
```

## @jalsoedesign/portline-platform

### index.d.ts

```ts
export * from './storage.js';
export * from './discovery.js';
export * from './profiles.js';
export * from './native-discovery.js';
export * from './write-types.js';
export * from './NativeProfileWriter.js';
export * from './registry-write-status.js';
```

### storage.d.ts

```ts
import type { ProfileStorage } from '@jalsoedesign/portline-abstract';
export type NativeValue = string | number | string[] | number[];
export type NativeSettings = Readonly<Record<string, NativeValue>>;
export interface NativeSession {
    readonly name: string;
    readonly settings: NativeSettings;
}
export type RegistryStorage = Extract<ProfileStorage, {
    kind: 'registry';
}>;
export interface RegistryReader {
    exists(storage: RegistryStorage): Promise<boolean>;
    read(storage: RegistryStorage): Promise<readonly NativeSession[]>;
}
/** Fixed helper code and JSON data use separate channels. Large helpers never enter the command line. */
export declare function runPowerShell(program: string, input: unknown, options?: {
    timeoutMs?: number;
}): Promise<string>;
export declare const windowsRegistry: RegistryReader;
export declare function exists(filename: string): Promise<boolean>;
export declare function readText(filename: string): Promise<string>;
export declare function directoryFiles(directory: string): Promise<string[]>;
export declare function decodeName(value: string): string;
export declare function parseIni(text: string): NativeSession[];
export declare function parseRegistryExport(text: string, root: string): NativeSession[];
```

### discovery.d.ts

```ts
import type { ProfileDiagnostic, SourceReference } from '@jalsoedesign/portline-abstract';
export interface RunningApplication {
    readonly executablePath: string;
    readonly applicationVersion?: string;
    readonly arguments: readonly string[];
}
export interface ProcessReader {
    list(names: readonly string[]): Promise<readonly RunningApplication[]>;
}
export declare const windowsProcesses: ProcessReader;
/** Windows quoting for paths/storage switches; never executes the parsed arguments. */
export declare function splitWindowsArguments(commandLine: string): string[];
export interface DiscoveryResult {
    readonly candidates: readonly SourceReference[];
    readonly selectedSourceId?: string;
    readonly selectedBy?: 'explicit' | 'running-application' | 'application-default' | 'only-candidate';
    readonly diagnostics: readonly ProfileDiagnostic[];
}
export declare function selectSource(candidates: readonly SourceReference[], options?: {
    sourceId?: string;
    runningIds?: readonly string[];
    defaultId?: string;
}, diagnostics?: readonly ProfileDiagnostic[]): DiscoveryResult;
export declare function requireSource(result: DiscoveryResult): SourceReference;
export declare function fileSource(application: string, filename: string, kind?: 'file' | 'directory'): SourceReference;
```

### profiles.d.ts

```ts
import type { AuthenticationMethod, ConnectionDefinition, ConnectionProfile, CredentialProvider, CredentialReference, CredentialResult, SourceReference } from '@jalsoedesign/portline-abstract';
import { ProfileCatalog } from '@jalsoedesign/portline-core';
import type { NativeSession, NativeSettings } from './storage.js';
export type SecretLoader = (reference: CredentialReference) => Promise<CredentialResult>;
/** Raw application settings are opt-in and are never included in list/search/JSON. */
export declare class NativeProfileSource extends ProfileCatalog implements CredentialProvider {
    #private;
    constructor(source: SourceReference, profiles: readonly ConnectionProfile[], sessions?: readonly NativeSession[], loadSecret?: SecretLoader);
    getNativeSettings(name: string): NativeSettings | undefined;
    resolve(reference: CredentialReference): Promise<CredentialResult>;
}
export declare function credentialOf(auth: AuthenticationMethod): CredentialReference | undefined;
export declare function credential(source: SourceReference, id: string, state: CredentialReference['state'], kind?: CredentialReference['kind']): CredentialReference;
export declare function privateKey(filename: string | undefined): AuthenticationMethod[];
export declare function nativeProfile(source: SourceReference, name: string, connections: readonly ConnectionDefinition[]): ConnectionProfile;
export declare function text(settings: NativeSettings, name: string, fallback?: string): string;
export declare function port(value: string, fallback: number): number;
```

### native-discovery.d.ts

```ts
import type { SourceReference } from '@jalsoedesign/portline-abstract';
import type { DiscoveryResult, ProcessReader, RunningApplication } from './discovery.js';
import type { RegistryReader, RegistryStorage } from './storage.js';
export interface NativeDiscoveryOptions {
    readonly file?: string;
    readonly directory?: string;
    readonly registry?: string;
    readonly registryView?: '32' | '64' | 'default';
    readonly sourceId?: string;
    readonly executablePath?: string;
    readonly directories?: readonly string[];
    readonly platform?: NodeJS.Platform;
    readonly registryReader?: RegistryReader;
    readonly processReader?: ProcessReader;
}
export interface NativeDiscoveryDefinition {
    readonly application: string;
    readonly registryKey: string;
    readonly processNames: readonly string[];
    readonly portableNames: readonly string[];
    readonly defaultDirectories?: readonly string[];
    readonly forExecutable?: (executable: RunningApplication, registry: SourceReference) => Promise<SourceReference | undefined>;
}
export declare function registrySource(application: string, key: string, view?: RegistryStorage['view']): SourceReference;
export declare function discoverNativeSources(definition: NativeDiscoveryDefinition, options?: NativeDiscoveryOptions): Promise<DiscoveryResult>;
```

### write-types.d.ts

```ts
import type { ConnectionProfile, ProfileDiagnostic, ProfileWriteInspection, ProfileWritePlan, SourceReference } from '@jalsoedesign/portline-abstract';
import type { RegistryWriteMode } from './registry-write-status.js';
import type { RegistryStorage } from './storage.js';
export type WritableApplication = 'filezilla' | 'putty' | 'kitty' | 'heidisql' | 'winscp' | 'openssh' | 'jetbrains';
export interface NativeWriteOptions {
    readonly application: WritableApplication;
    readonly source: SourceReference;
    readonly mode?: 'create' | 'update' | 'upsert';
    readonly allowLossy?: boolean;
    /** Default transactional. Guarded is an explicit non-atomic opt-in. */
    readonly registryMode?: RegistryWriteMode;
    /** JetBrains: global IDE config or project .idea directory, never guessed. */
    readonly scope?: 'global' | 'project';
    /** Dependency injection for tests/hosts providing their own guarded transaction implementation. */
    readonly backend?: ProfileWriteBackend;
}
export interface ProfileMutation {
    readonly operation: 'create' | 'update' | 'upsert' | 'delete';
    readonly path: string;
    readonly profile?: ConnectionProfile;
}
export interface NativeWritePreview extends ProfileWritePlan {
    readonly schemaVersion: 1;
    readonly application: WritableApplication;
    readonly scope?: 'global' | 'project';
    readonly mode: 'create' | 'update' | 'upsert';
    readonly allowLossy: boolean;
    readonly registryMode?: RegistryWriteMode;
    readonly inspection: ProfileWriteInspection;
    readonly diagnostics: readonly ProfileDiagnostic[];
    readonly mutations: readonly ProfileMutation[];
    readonly digest: string;
}
export interface FileImage {
    readonly path: string;
    readonly data: string | null;
}
export interface RegistryValueImage {
    readonly name: string;
    readonly kind: string;
    readonly value: string | number | readonly number[] | readonly string[];
}
export interface RegistryKeyImage {
    readonly path: string;
    readonly values: readonly RegistryValueImage[];
}
export interface WriteSnapshot {
    readonly files: readonly FileImage[];
    readonly registry?: readonly RegistryKeyImage[];
}
export interface FileReplacement {
    readonly path: string;
    readonly data: string | null;
}
export interface RegistryPatch {
    readonly path: string;
    readonly remove?: boolean;
    readonly set: Readonly<Record<string, string | number>>;
    readonly unset: readonly string[];
}
export interface NativeWritePatch {
    readonly files: readonly FileReplacement[];
    readonly registry: readonly RegistryPatch[];
    readonly changes: ProfileWritePlan['changes'];
    readonly diagnostics: readonly ProfileDiagnostic[];
}
export interface WriteGuard {
    readonly application: WritableApplication;
    readonly processNames: readonly string[];
    readonly lockPaths: readonly string[];
}
export interface ProfileWriteBackend {
    read(): Promise<WriteSnapshot>;
    inspect(snapshot: WriteSnapshot): Promise<Pick<ProfileWriteInspection, 'application' | 'lock' | 'diagnostics'>>;
    /** Must acquire locks, compare the snapshot and recheck the application before committing. */
    commit(snapshot: WriteSnapshot, patch: NativeWritePatch): Promise<readonly string[]>;
}
export interface WriterTarget {
    readonly source: SourceReference;
    readonly application: WritableApplication;
    readonly registry?: RegistryStorage;
    readonly registryMode?: RegistryWriteMode;
    readonly files: readonly string[];
    readonly directory?: string;
    readonly guard: WriteGuard;
}
```

### NativeProfileWriter.d.ts

```ts
import type { ConnectionProfile, ProfileWriteInspection, ProfileWriter } from '@jalsoedesign/portline-abstract';
import type { NativeWriteOptions, NativeWritePreview, ProfileMutation } from './write-types.js';
/** Previews are redacted intents; native bytes are private and never accepted back from JSON. */
export declare class NativeProfileWriter implements ProfileWriter<NativeWritePreview> {
    #private;
    constructor(options: NativeWriteOptions);
    get backupPaths(): readonly string[];
    private setup;
    inspect(): Promise<ProfileWriteInspection>;
    plan(profiles: readonly ConnectionProfile[]): Promise<NativeWritePreview>;
    planChanges(mutations: readonly ProfileMutation[]): Promise<NativeWritePreview>;
    /** Rebuild a serialized preview from its sanitized intent and compare it with the reviewed preview. */
    importPlan(document: NativeWritePreview): Promise<NativeWritePreview>;
    apply(plan: NativeWritePreview): Promise<void>;
}
```

### registry-write-status.d.ts

```ts
import type { ProfileDiagnostic } from '@jalsoedesign/portline-abstract';
export type RegistryWriteMode = 'transactional' | 'guarded';
export interface RegistryFailure {
    readonly code?: string;
    readonly nativeCode?: number;
    readonly operation?: string;
}
export declare function registryDiagnostic(failure?: RegistryFailure): ProfileDiagnostic & RegistryFailure;
export declare const guardedRegistryWarning: ProfileDiagnostic;
export declare class RegistryWriteError extends Error {
    readonly code: string;
    readonly nativeCode?: number;
    readonly operation?: string;
    readonly backupPaths: readonly string[];
    readonly recoveryRequired: boolean;
    constructor(result: {
        error?: RegistryFailure;
        backups?: readonly string[];
        recoveryRequired?: boolean;
    });
}
```

