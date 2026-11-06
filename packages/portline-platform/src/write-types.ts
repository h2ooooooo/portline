import type {ConnectionProfile, ProfileDiagnostic, ProfileWriteInspection, ProfileWritePlan, SourceReference} from '@jalsoedesign/portline-abstract';
import type {RegistryWriteMode} from './registry-write-status.js';
import type {RegistryStorage} from './storage.js';

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
