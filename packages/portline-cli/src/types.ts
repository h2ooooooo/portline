import type {Awaitable, ProfileSource} from '@jalsoedesign/portline-abstract';

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
    readonly summaryFields?: readonly {readonly key: string; readonly label: string}[];
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
