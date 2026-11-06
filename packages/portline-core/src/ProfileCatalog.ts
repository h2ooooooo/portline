import type {ConnectionProfile, ProfileSearchOptions, ProfileSource, SourceReference} from '@jalsoedesign/portline-abstract';
import {getProfileByPath, searchProfiles} from './query.js';

/** In-memory source for normalized profiles, also useful for importer implementations. */
export class ProfileCatalog implements ProfileSource {
    private readonly profiles: readonly ConnectionProfile[];

    constructor(public readonly source: SourceReference, profiles: readonly ConnectionProfile[]) {
        const paths = new Set<string>();
        const ids = new Set<string>();

        for (const profile of profiles) {
            if (profile.source.id !== source.id || paths.has(profile.path) || ids.has(profile.id)) {
                throw new TypeError('Profiles must belong to the source and have unique paths and IDs');
            }

            paths.add(profile.path);
            ids.add(profile.id);
        }

        this.profiles = [...profiles];
    }

    public list(): readonly ConnectionProfile[] {
        return [...this.profiles];
    }

    public get(path: string): ConnectionProfile | undefined {
        return getProfileByPath(this.profiles, path, profile => profile.path);
    }

    public search(term: string, options: ProfileSearchOptions = {}): readonly ConnectionProfile[] {
        return searchProfiles(this.profiles, term, {
            path: profile => profile.path,
            name: profile => profile.name,
            searchValues: profile => [JSON.stringify(profile.connections), profile.localDirectory?.value],
        }, options);
    }
}
