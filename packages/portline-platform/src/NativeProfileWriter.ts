import path from 'node:path';
import {exists} from './storage.js';
import {assertProfileWriteAllowed} from '@jalsoedesign/portline-core';
import type {ConnectionProfile, ProfileWriteInspection, ProfileWriter} from '@jalsoedesign/portline-abstract';
import {GuardedFileBackend} from './file-write-backend.js';
import {guardedRegistryWarning, RegistryWriteError} from './registry-write-status.js';
import {GuardedRegistryBackend} from './registry-write-backend.js';
import {renderNativeWrite} from './native-write-codecs.js';
import {digest, safeProfilePath, safeScalar, sanitizeProfile} from './write-validation.js';
import type {
    NativeWriteOptions, NativeWritePatch, NativeWritePreview, ProfileMutation, ProfileWriteBackend,
    WritableApplication, WriteSnapshot, WriterTarget,
} from './write-types.js';

const processNames: Record<WritableApplication, readonly string[]> = {
    filezilla: ['filezilla.exe', 'filezilla pro.exe', 'filezillapro.exe'],
    putty: ['putty.exe', 'plink.exe', 'psftp.exe', 'pscp.exe'],
    kitty: [
        'kitty.exe',
        'klink.exe',
        'kftp.exe',
        'kscp.exe',
        'putty.exe',
        'plink.exe',
    ],
    heidisql: ['heidisql.exe'],
    winscp: ['winscp.exe', 'winscp.com'],
    openssh: ['ssh.exe', 'sftp.exe', 'scp.exe'],
    jetbrains: [
        'idea.exe',
        'idea64.exe',
        'phpstorm.exe',
        'phpstorm64.exe',
        'webstorm.exe',
        'webstorm64.exe',
        'pycharm.exe',
        'pycharm64.exe',
        'clion.exe',
        'clion64.exe',
        'rider.exe',
        'rider64.exe',
        'datagrip.exe',
        'datagrip64.exe',
        'goland.exe',
        'goland64.exe',
        'rubymine.exe',
        'rubymine64.exe',
        'java.exe',
        'javaw.exe',
    ],
};

interface PrivatePlan {
    readonly snapshot: WriteSnapshot;
    readonly patch: NativeWritePatch;
    readonly digest: string;
}

/** Previews are redacted intents; native bytes are private and never accepted back from JSON. */
export class NativeProfileWriter implements ProfileWriter<NativeWritePreview> {
    readonly #plans = new WeakMap<object, PrivatePlan>();

    #target?: WriterTarget;

    #backend?: ProfileWriteBackend;

    #backups: readonly string[] = [];

    readonly #options: NativeWriteOptions;

    public constructor(options: NativeWriteOptions) {
        if (
            !Object.prototype.hasOwnProperty.call(processNames, options.application) ||
            options.mode !== undefined &&
            !['create', 'update', 'upsert'].includes(options.mode) ||
            options.scope !== undefined &&
            !['global', 'project'].includes(options.scope) ||
            options.registryMode !== undefined &&
            !['transactional', 'guarded'].includes(options.registryMode) ||
            options.allowLossy !== undefined &&
            typeof options.allowLossy !== 'boolean'
        ) {
            throw new Error('Invalid writer application or policy');
        }

        const source = options.source;
        const storage = source.storage?.map(item => {
            if (item.kind === 'registry') {
                return {
                    kind: item.kind,
                    hive: item.hive,
                    key: safeScalar(item.key, 'registry key'),
                    view: item.view,
                };
            }

            if (item.kind === 'file') {
                return {kind: item.kind, path: safeScalar(item.path, 'file path'), format: item.format === undefined ? undefined : safeScalar(item.format, 'storage format')};
            }

            if (item.kind === 'directory') {
                return {kind: item.kind, path: safeScalar(item.path, 'directory path')};
            }

            throw new Error('Unsupported target storage');
        });

        this.#options = {
            application: options.application,
            mode: options.mode,
            scope: options.application === 'jetbrains' ? options.scope ?? 'global' : undefined,
            allowLossy: options.allowLossy,
            registryMode: options.registryMode ?? 'transactional',
            source: {
                id: safeScalar(source.id, 'source ID'),
                application: safeScalar(source.application, 'application'),
                location: source.location === undefined ? undefined : safeScalar(source.location, 'source location'),
                scope: source.scope === undefined ? undefined : safeScalar(source.scope, 'source scope'),
                applicationVersion: source.applicationVersion === undefined ? undefined : safeScalar(source.applicationVersion, 'application version'),
                executablePath: source.executablePath === undefined ? undefined : safeScalar(source.executablePath, 'executable path'),
                storage,
            },
        };
        this.#backend = options.backend;
    }

    public get backupPaths(): readonly string[] {
        return [...this.#backups];
    }

    private async setup() {
        if (this.#target) {
            return {target: this.#target, backend: this.#backend!};
        }

        const options = this.#options;
        const storage = options.source.storage;

        if (!storage || storage.length !== 1) {
            throw new Error('A writer requires one explicitly selected native storage location');
        }

        const selected = storage[0];

        if (options.registryMode === 'guarded' && selected.kind !== 'registry') {
            throw new Error('Guarded registry mode requires a registry destination');
        }

        const application = options.application;
        const files: string[] = [];
        let directory: string | undefined;

        if (selected.kind === 'registry') {
            if (!['putty', 'kitty', 'heidisql', 'winscp'].includes(application)) {
                throw new Error('Application does not support registry profile writes');
            }

            if (
                !['HKCU', 'HKLM'].includes(selected.hive) ||
                !['default', '32', '64'].includes(selected.view ?? 'default') ||
                !selected.key ||
                /(^|\\)\.\.?($|\\)/.test(selected.key)
            ) {
                throw new Error('Invalid registry target');
            }
        } else if (selected.kind === 'directory') {
            if (application === 'kitty') {
                directory = await exists(path.join(selected.path, 'kitty.ini')) ||
                    await exists(path.join(selected.path, 'Sessions')) ?
                    path.resolve(selected.path, 'Sessions') : path.resolve(selected.path);
            } else if (application === 'jetbrains') {
                const folder = options.scope === 'project' ? path.resolve(selected.path) :
                    path.resolve(selected.path, 'options');

                files.push(path.join(folder, 'webServers.xml'), path.join(folder, 'sshConfigs.xml'));
            } else {
                throw new Error('Only KiTTY and JetBrains directory storage is writable');
            }
        } else {
            if (application === 'jetbrains') {
                throw new Error('Select a JetBrains configuration or .idea directory');
            }

            files.push(path.resolve(selected.path));
        }

        const root = selected.kind === 'registry' ? undefined :
            selected.kind === 'directory' ? path.resolve(selected.path) : path.dirname(path.resolve(selected.path));
        const locks = root ? [
            path.join(root, '.lock'),
            path.join(root, 'port.lock'),
            path.join(root, '.portline-write.lock'),
            ...files.flatMap(filename => [filename + '.lock', filename + '.lck']),
        ] : [];
        const executable = options.source.executablePath ?
            [path.basename(options.source.executablePath).toLowerCase()] : [];
        const target: WriterTarget = {
            application,
            source: options.source,
            files,
            directory,
            registry: selected.kind === 'registry' ? selected : undefined,
            registryMode: options.registryMode,
            guard: {application, processNames: [...processNames[application], ...executable], lockPaths: locks},
        };

        this.#target = target;
        this.#backend ??= selected.kind === 'registry' ?
            new GuardedRegistryBackend(target) : new GuardedFileBackend(target);

        return {target, backend: this.#backend};
    }

    public async inspect(): Promise<ProfileWriteInspection> {
        const {backend} = await this.setup();
        const snapshot = await backend.read();

        return {
            source: structuredClone(this.#options.source),
            revision: digest(snapshot),
            ...await backend.inspect(snapshot),
        };
    }

    public async plan(profiles: readonly ConnectionProfile[]): Promise<NativeWritePreview> {
        return this.planChanges(profiles.map(profile => ({
            operation: this.#options.mode ?? 'create',
            path: profile.path,
            profile,
        })));
    }

    public async planChanges(mutations: readonly ProfileMutation[]): Promise<NativeWritePreview> {
        if (!Array.isArray(mutations) || mutations.length > 1000) {
            throw new Error('A preview supports at most 1000 explicit mutations');
        }

        const paths = new Set<string>();
        const sanitized = mutations.map(mutation => {
            if (!['create', 'update', 'upsert', 'delete'].includes(mutation.operation)) {
                throw new Error('Invalid profile operation');
            }

            const profilePath = safeProfilePath(mutation.path);
            const comparison = profilePath.toLowerCase();

            if (paths.has(comparison)) {
                throw new Error('Destination paths collide');
            }

            paths.add(comparison);

            const profile = mutation.operation === 'delete' ? undefined : sanitizeProfile(mutation.profile!);

            if (profile && profile.path !== profilePath) {
                throw new Error('Mutation path and profile path must match');
            }

            return {operation: mutation.operation, path: profilePath, ...(profile ? {profile} : {})};
        });
        const {backend, target} = await this.setup();
        const snapshot = await backend.read();
        const inspection = {
            source: structuredClone(this.#options.source),
            revision: digest(snapshot),
            ...await backend.inspect(snapshot),
        };
        const patch = renderNativeWrite(target, snapshot, sanitized, this.#options);
        const preview = {
            schemaVersion: 1 as const,
            sourceId: this.#options.source.id,
            application: this.#options.application,
            scope: this.#options.scope,
            mode: this.#options.mode ?? 'create',
            allowLossy: this.#options.allowLossy ?? false,
            registryMode: this.#options.registryMode,
            expectedRevision: inspection.revision,
            inspection,
            changes: patch.changes,
            diagnostics: [...patch.diagnostics, ...(this.#options.registryMode === 'guarded' ? [guardedRegistryWarning] : [])],
            mutations: sanitized,
        };
        const plan: NativeWritePreview = {...preview, digest: digest(preview)};

        this.#plans.set(plan, {snapshot, patch, digest: plan.digest});

        return plan;
    }

    /** Rebuild a serialized preview from its sanitized intent and compare it with the reviewed preview. */
    public async importPlan(document: NativeWritePreview): Promise<NativeWritePreview> {
        if (
            document.schemaVersion !== 1 ||
            document.sourceId !== this.#options.source.id ||
            document.application !== this.#options.application ||
            document.scope !== this.#options.scope ||
            document.mode !== (this.#options.mode ?? 'create') ||
            (document.registryMode ?? 'transactional') !== this.#options.registryMode ||
            document.allowLossy !== (this.#options.allowLossy ?? false)
        ) {
            throw new Error('Preview does not match the explicitly selected writer and policy');
        }

        const {digest: saved, ...contents} = document;

        if (digest(contents) !== saved) {
            throw new Error('Preview was edited; create a new preview');
        }

        const fresh = await this.planChanges(document.mutations);

        if (
            fresh.expectedRevision !== document.expectedRevision ||
            digest(fresh.changes) !== digest(document.changes) ||
            digest(fresh.diagnostics) !== digest(document.diagnostics)
        ) {
            throw new Error('Destination or write projection changed; create a new preview');
        }

        return fresh;
    }

    public async apply(plan: NativeWritePreview): Promise<void> {
        const privatePlan = this.#plans.get(plan);

        if (!privatePlan || privatePlan.digest !== plan.digest) {
            throw new Error('Use a preview from this writer or import a saved preview first');
        }

        const {digest: saved, ...contents} = plan;

        if (digest(contents) !== saved) {
            throw new Error('Preview was modified after planning');
        }

        const {backend} = await this.setup();

        const inspection = await this.inspect();

        try {
            assertProfileWriteAllowed(inspection, plan);
        } catch (error) {
            const native = inspection.diagnostics.find(item => item.code.startsWith('registry-'));

            if (native && inspection.revision === plan.expectedRevision && inspection.source.id === plan.sourceId) {
                throw new RegistryWriteError({error: native});
            }

            throw error;
        }

        // A second apply must replan, even if a previous attempt failed.
        this.#plans.delete(plan);

        if (privatePlan.patch.files.length === 0 && privatePlan.patch.registry.length === 0) {
            return;
        }

        this.#backups = [];

        try {
            this.#backups = await backend.commit(privatePlan.snapshot, privatePlan.patch);
        } catch (error: any) {
            this.#backups = error.backupPaths ?? [];

            throw error;
        }
    }
}
