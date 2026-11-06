import type {ConnectionProfile, ProfileSource, ProfileWriter, ProfileWritePlan} from '@jalsoedesign/portline-abstract';

export interface ProfileSyncMapping {
    readonly sourcePath: string;
    readonly targetPath: string;
    readonly connectionId?: string;
}

/** One-way, exact-path sync. No pruning, credential resolution or implicit connection selection. */
export async function planProfileSync<TPlan extends ProfileWritePlan>(
    source: ProfileSource,
    writer: ProfileWriter<TPlan>,
    mappings: readonly ProfileSyncMapping[],
): Promise<TPlan> {
    const paths = new Set<string>();
    const profiles: ConnectionProfile[] = [];

    for (const mapping of mappings) {
        if (paths.has(mapping.targetPath)) {
            throw new Error('Multiple sync mappings address the same destination');
        }

        paths.add(mapping.targetPath);

        const profile = await source.get(mapping.sourcePath);

        if (!profile) {
            throw new Error('Source profile was not found by exact path');
        }

        let connections = profile.connections;

        if (mapping.connectionId) {
            const selected = connections.find(item => item.id === mapping.connectionId);

            if (!selected) {
                throw new Error('Selected source connection was not found');
            }

            const ids = new Set([selected.id]);
            const visit = (id: string, stack: readonly string[]) => {
                if (stack.includes(id)) {
                    throw new Error('SSH hop cycle in source profile');
                }

                const connection = connections.find(item => item.id === id);

                if (!connection) {
                    throw new Error('SSH hop is missing from the source profile');
                }

                ids.add(id);
                connection.via?.forEach(hop => visit(hop, [...stack, id]));
            };

            visit(selected.id, []);
            connections = [selected, ...connections.filter(item => item.id !== selected.id && ids.has(item.id))];
        } else if (connections.length > 1) {
            throw new Error('Select a source connection explicitly when a profile has multiple connections');
        }

        profiles.push({
            ...profile,
            path: mapping.targetPath,
            name: profile.name,
            connections,
        });
    }

    return writer.plan(profiles);
}
