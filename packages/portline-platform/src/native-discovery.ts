import path from 'node:path';
import type {ProfileDiagnostic, SourceReference} from '@jalsoedesign/portline-abstract';
import {fileSource, selectSource, windowsProcesses} from './discovery.js';
import type {DiscoveryResult, ProcessReader, RunningApplication} from './discovery.js';
import {exists, windowsRegistry} from './storage.js';
import type {RegistryReader, RegistryStorage} from './storage.js';

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
    readonly forExecutable?: (
        executable: RunningApplication,
        registry: SourceReference,
    ) => Promise<SourceReference | undefined>;
}

export function registrySource(application: string, key: string, view: RegistryStorage['view'] = 'default'): SourceReference {
    const match = /^(HKCU|HKLM)\\(.+)$/i.exec(key);

    if (!match) {
        throw new Error('Registry source must start with HKCU\\ or HKLM\\');
    }

    if (!['32', '64', 'default'].includes(view ?? 'default')) {
        throw new Error('Registry view must be 32, 64 or default');
    }

    const storage: RegistryStorage = {
        kind: 'registry',
        hive: match[1].toUpperCase() as 'HKCU' | 'HKLM',
        key: match[2],
        view,
    };

    return {
        id: application + ':' + storage.hive + '\\' + storage.key + ':' + view,
        application,
        storage: [storage],
        location: storage.hive + '\\' + storage.key,
    };
}

export async function discoverNativeSources(
    definition: NativeDiscoveryDefinition,
    options: NativeDiscoveryOptions = {},
): Promise<DiscoveryResult> {
    const {application} = definition;
    const registry = registrySource(application, options.registry ?? definition.registryKey, options.registryView);
    const candidates: SourceReference[] = [];
    const diagnostics: ProfileDiagnostic[] = [];
    const explicit = [options.file, options.directory, options.registry].filter(value => value !== undefined);

    if (explicit.length > 1) {
        throw new Error('Select only one of file, directory or registry');
    }

    if (explicit.length) {
        const source = options.file ? fileSource(application, options.file) :
            options.directory ? fileSource(application, options.directory, 'directory') : registry;

        return selectSource([source], {sourceId: source.id});
    }

    const registryReader = options.registryReader ?? windowsRegistry;
    const platform = options.platform ?? process.platform;

    if (platform === 'win32') {
        try {
            if (await registryReader.exists(registry.storage![0] as RegistryStorage)) {
                candidates.push(registry);
            }
        } catch {
            diagnostics.push({
                code: 'registry-inspection-failed',
                severity: 'warning',
                message: 'Registry discovery was unavailable; use an explicit source if needed',
            });
        }
    }

    const runningIds: string[] = [];
    let defaultId: string | undefined;
    let unresolvedActiveStorage = false;
    let running: readonly RunningApplication[] = [];

    if (platform === 'win32') {
        try {
            running = await (options.processReader ?? windowsProcesses).list(definition.processNames);
        } catch {
            diagnostics.push({
                code: 'process-inspection-failed',
                severity: 'warning',
                message: 'Running application storage could not be inspected',
            });
        }
    }

    const executables = [
        ...running,
        ...(options.executablePath ? [{executablePath: path.resolve(options.executablePath), arguments: []}] : []),
    ];

    for (const executable of executables) {
        const source = await definition.forExecutable?.(executable, registry);

        if (!source && running.includes(executable)) {
            unresolvedActiveStorage = true;
            diagnostics.push({
                code: 'active-storage-unknown',
                severity: 'warning',
                message: 'The running application storage could not be determined; select an explicit source',
            });
        }

        if (source) {
            const enriched = {
                ...source,
                executablePath: executable.executablePath,
                applicationVersion: executable.applicationVersion,
            };

            candidates.push(enriched);

            if (options.executablePath && !running.includes(executable)) {
                defaultId = enriched.id;
            }

            if (running.includes(executable)) {
                runningIds.push(enriched.id);
            }
        }
    }

    const directories = [
        ...(options.directories ?? []),
        ...(definition.defaultDirectories ?? []),
        ...executables.map(item => path.dirname(item.executablePath)),
    ];

    for (const directory of new Set(directories)) {
        for (const filename of definition.portableNames) {
            const target = path.resolve(directory, filename);

            if (await exists(target)) {
                candidates.push(fileSource(application, target));
            }
        }
    }

    // Keep executable/version metadata when the same location was also found on disk.
    const unique = new Map<string, SourceReference>();

    for (const candidate of candidates) {
        unique.set(candidate.id, {...candidate, ...unique.get(candidate.id)});
    }

    const result = selectSource([...unique.values()], {sourceId: options.sourceId, runningIds, defaultId}, diagnostics);

    if (unresolvedActiveStorage && !options.sourceId) {
        return {...result, selectedSourceId: undefined, selectedBy: undefined};
    }

    return result;
}
