import type {ProfileSearchOptions, ProfileTree} from '@jalsoedesign/portline-abstract';

export interface ProfileQueryAdapter<TProfile> {
    path(profile: TProfile): string;
    name(profile: TProfile): string;
    searchValues(profile: TProfile): readonly unknown[];
    folderNames?(profile: TProfile): readonly string[];
}

export function searchProfiles<TProfile>(
    profiles: readonly TProfile[],
    term: string,
    adapter: ProfileQueryAdapter<TProfile>,
    options: ProfileSearchOptions = {},
): TProfile[] {
    const lowerTerm = term.toLowerCase();

    return profiles.filter(profile => {
        const values: unknown[] = [adapter.path(profile), adapter.name(profile)];

        if (options.fields === 'all') {
            values.push(...adapter.searchValues(profile));
        }

        return values.some(value => value !== undefined && String(value).toLowerCase().includes(lowerTerm));
    });
}

export function getProfileByPath<TProfile>(
    profiles: readonly TProfile[],
    path: string,
    pathFor: (profile: TProfile) => string,
): TProfile | undefined {
    return profiles.find(profile => pathFor(profile) === path);
}

export function buildProfileTree<TProfile>(
    profiles: readonly TProfile[],
    adapter: Pick<ProfileQueryAdapter<TProfile>, 'path' | 'folderNames'>,
): ProfileTree<TProfile> {
    const root: ProfileTree<TProfile> = {name: 'Root', folders: [], profiles: []};

    for (const profile of profiles) {
        const parts = adapter.folderNames?.(profile) ?? adapter.path(profile).split('/').slice(0, -1);
        let current = root;

        for (const name of parts) {
            let folder = current.folders.find(item => item.name === name);

            if (!folder) {
                folder = {name, folders: [], profiles: []};
                current.folders.push(folder);
            }

            current = folder;
        }

        current.profiles.push(profile);
    }

    return root;
}
