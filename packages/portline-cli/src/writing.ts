import path from 'node:path';
import {open, readFile, stat} from 'node:fs/promises';
import {planProfileSync} from '@jalsoedesign/portline-core';
import type {ConnectionProfile, ProfileSource, SourceReference} from '@jalsoedesign/portline-abstract';
import type {NativeProfileWriter, NativeWritePreview, WritableApplication} from '@jalsoedesign/portline-platform';
import {parseProfileArgs} from './cli.js';
import type {ProfileCliOption, ProfileCliOptions} from './types.js';

export interface ProfileWriteCliDefinition {
    readonly application: WritableApplication;
    readonly sourceOptions?: readonly ProfileCliOption[];
    readonly importSource?: (name: string) => Promise<any>;
    readonly writer: (options: ProfileCliOptions) => Promise<NativeProfileWriter>;
}
export const profileWriteOptions: readonly ProfileCliOption[] = [
    {
        flag: '--registry-mode',
        key: 'registryMode',
        takesValue: true,
        description: 'transactional (default) or explicit non-atomic guarded registry mode',
    },
    {
        flag: '--input',
        key: 'input',
        takesValue: true,
        description: 'Normalized profile/mutations JSON',
    },
    {
        flag: '--preview',
        key: 'preview',
        takesValue: true,
        description: 'Save a new preview JSON file (never applies it)',
    },
    {
        flag: '--plan',
        key: 'plan',
        takesValue: true,
        description: 'Saved preview for explicit apply',
    },
    {
        flag: '--mode',
        key: 'mode',
        takesValue: true,
        description: 'create (default), update or upsert',
    },
    {flag: '--allow-lossy', key: 'allowLossy', description: 'Acknowledge listed directory/metadata omissions'},
    {
        flag: '--from',
        key: 'from',
        takesValue: true,
        description: 'Source application for one-way sync',
    },
    {
        flag: '--from-file',
        key: 'fromFile',
        takesValue: true,
        description: 'Source native configuration file',
    },
    {
        flag: '--from-directory',
        key: 'fromDirectory',
        takesValue: true,
        description: 'Source portable directory',
    },
    {
        flag: '--from-registry',
        key: 'fromRegistry',
        takesValue: true,
        description: 'Source session registry key',
    },
    {
        flag: '--from-config',
        key: 'fromConfig',
        takesValue: true,
        description: 'Source JetBrains IDE config',
    },
    {
        flag: '--from-project',
        key: 'fromProject',
        takesValue: true,
        description: 'Source JetBrains project',
    },
    {
        flag: '--profile',
        key: 'profile',
        takesValue: true,
        description: 'Exact source profile path',
    },
    {
        flag: '--target-path',
        key: 'targetPath',
        takesValue: true,
        description: 'Exact destination profile path',
    },
    {
        flag: '--connection',
        key: 'connection',
        takesValue: true,
        description: 'Selected source connection ID',
    },
    {
        flag: '--scope',
        key: 'scope',
        takesValue: true,
        description: 'JetBrains destination global or project scope',
    },
];

async function jsonFile(filename: unknown): Promise<any> {
    if (typeof filename !== 'string') {
        throw new Error('Specify the required JSON input file');
    }

    const info = await stat(filename);

    if (info.size > 16 * 1024 * 1024) {
        throw new Error('JSON input exceeds 16 MiB');
    }

    try {
        return JSON.parse(await readFile(filename, 'utf8'));
    } catch {
        throw new Error('Invalid profile or preview JSON');
    }
}

const adapters = {
    putty: ['@jalsoedesign/putty-core', 'PuttyProfileSource'],
    kitty: ['@jalsoedesign/putty-core', 'PuttyProfileSource'],
    heidisql: ['@jalsoedesign/heidisql-core', 'HeidiSqlProfileSource'],
    winscp: ['@jalsoedesign/winscp-core', 'WinScpProfileSource'],
    openssh: ['@jalsoedesign/openssh-core', 'OpenSshProfileSource'],
    jetbrains: ['@jalsoedesign/jsbrains-portline', 'JetBrainsProfileSource'],
    filezilla: ['@jalsoedesign/filezilla-core', 'FileZillaProfileSource'],
} as const;

async function sourceFor(
    options: ProfileCliOptions,
    importer: (name: string) => Promise<any> = name => import(name),
): Promise<ProfileSource> {
    const name = String(options.from);

    if (!Object.prototype.hasOwnProperty.call(adapters, name)) {
        throw new Error('Select --from filezilla|putty|kitty|heidisql|winscp|openssh|jetbrains');
    }

    const [moduleName, className] = adapters[name as keyof typeof adapters];
    let adapter: any;

    try {
        // Only the fixed package allowlist is imported. No plugins or packages are installed automatically.
        adapter = await importer(moduleName);
    } catch {
        throw new Error('Install the source adapter ' + moduleName + ' alongside the destination CLI');
    }

    if (name === 'filezilla') {
        return adapter[className].fromFile(options.fromFile ?? adapter.getDefaultSiteManagerPath());
    }

    return adapter[className].open({
        file: options.fromFile,
        directory: options.fromDirectory,
        registry: options.fromRegistry,
        configPath: options.fromConfig,
        projectPath: options.fromProject,
        variant: name === 'kitty' ? 'kitty' : name === 'putty' ? 'putty' : undefined,
    });
}

/** Each destination embeds this workflow; read commands and legacy output are unchanged. */
export function createProfileWriteCommands(definition: ProfileWriteCliDefinition) {
    const execute = (command: 'write' | 'sync' | 'apply' | 'write-status') => async (args: string[]) => {
        const {options, positional} = parseProfileArgs(args, {
            sourceOptions: [...definition.sourceOptions ?? [], ...profileWriteOptions],
        });

        if (options.help) {
            console.log([
                'write-status [destination options]: inspect process, lock and registry capability diagnostics',
                'Registry policy: --registry-mode transactional|guarded (repeat with apply; no automatic fallback)',
                'write --input profiles.json --preview new-plan.json [destination options]',
                'sync --from <application> --profile <path> --target-path <path> --preview new-plan.json',
                'apply --plan new-plan.json [the same explicit destination and policy options]',
                'Previews never apply writes. Applications must be closed; unknown state and native locks block apply.',
                'Modes: --mode create|update|upsert. Stored secrets are never copied. No force/lock bypass is provided.',
            ].join('\n'));

            return;
        }

        if (positional.length || options.mode && !['create', 'update', 'upsert'].includes(String(options.mode))) {
            throw new Error('Invalid write arguments or mode');
        }

        if (options.scope && definition.application !== 'jetbrains') {
            throw new Error('Scope selection applies only to JetBrains destinations');
        }

        if (options.registryMode && !['transactional', 'guarded'].includes(String(options.registryMode))) {
            throw new Error('Registry mode must be transactional or guarded');
        }

        const writer = await definition.writer(options);

        if (command === 'write-status') {
            console.log(JSON.stringify(await writer.inspect(), null, 2));

            return;
        }

        let preview: NativeWritePreview;

        if (command === 'apply') {
            preview = await writer.importPlan(await jsonFile(options.plan) as NativeWritePreview);
            await writer.apply(preview);
            console.log(JSON.stringify({
                applied: true,
                sourceId: preview.sourceId,
                changes: preview.changes,
                backups: writer.backupPaths,
            }, null, 2));

            return;
        }

        if (command === 'sync') {
            if (typeof options.profile !== 'string' || typeof options.targetPath !== 'string') {
                throw new Error('Sync requires --profile and --target-path');
            }

            preview = await planProfileSync(await sourceFor(options, definition.importSource), writer, [
                {
                    sourcePath: options.profile,
                    targetPath: options.targetPath,
                    connectionId: typeof options.connection === 'string' ? options.connection : undefined,
                },
            ]);
        } else {
            const input = await jsonFile(options.input);

            preview = input && Array.isArray(input.mutations) ? await writer.planChanges(input.mutations) :
                await writer.plan((Array.isArray(input) ? input : input.profiles ?? [input]) as ConnectionProfile[]);
        }

        if (typeof options.preview === 'string') {
            const file = await open(path.resolve(options.preview), 'wx', 0o600);

            try {
                await file.writeFile(JSON.stringify(preview, null, 2) + '\n');
                await file.sync();
            } finally {
                await file.close();
            }
        }

        console.log(JSON.stringify(preview, null, 2));
    };

    return {
        write: execute('write'),
        sync: execute('sync'),
        apply: execute('apply'),
        'write-status': execute('write-status'),
    };
}

/** Writer factories use an explicit, single storage target; never infer it from a saved preview. */
export interface ProfileWriterFactoryOptions {
    readonly source: SourceReference;
    readonly mode?: 'create' | 'update' | 'upsert';
    readonly allowLossy?: boolean;
    readonly registryMode?: 'transactional' | 'guarded';
}
