import chalk from 'chalk';
import {buildProfileTree} from '@jalsoedesign/portline-core';
import type {ProfileTree} from '@jalsoedesign/portline-abstract';
import type {ProfileCommandContext} from './types.js';
import {formatOutput} from './output.js';

const defaultSummaryFields = [
    {key: 'name', label: 'Name'},
    {key: 'path', label: 'Path'},
    {key: 'protocol', label: 'Protocol'},
    {key: 'host', label: 'Host'},
    {key: 'port', label: 'Port'},
    {key: 'user', label: 'Username'},
    {key: 'password', label: 'Password'},
    {key: 'keyFile', label: 'Private key'},
    {key: 'remoteDirectory', label: 'Remote'},
];

export async function sourceCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void> {
    const source = ctx.source.source;

    if (ctx.options.json) {
        formatOutput(source, ctx.options);

        return;
    }

    const display = {
        ...source,
        storage: source.storage?.map(storage => storage.kind === 'registry' ?
            `${storage.hive}\\${storage.key} (${storage.view ?? 'default'} view)` :
            `${storage.kind}: ${storage.path}`).join('; '),
    };

    formatOutput(display, ctx.options, {columns: ['Property', 'Value'], rows: Object.entries(display)});
}

async function fullProperties<TProfile>(profile: TProfile, ctx: ProfileCommandContext<TProfile>) {
    const properties = {...await ctx.source.properties(profile, ctx.options)};

    if (!ctx.options.showPassword) {
        for (const key of ctx.source.secretFields ?? ['password']) {
            properties[key] = '(hidden)';
        }
    }

    return properties;
}

export async function searchCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void> {
    const term = ctx.options.search ?? ctx.args[0];

    if (term === undefined || ctx.args.length > (ctx.options.search === undefined ? 1 : 0)) {
        throw new Error(`Specify one search term: ${ctx.executableName ?? 'portline'} search <term>`);
    }

    if (ctx.options.recurse || ctx.options.full) {
        throw new Error('--recurse and --full are list options; search displays profile details');
    }

    const matches = await ctx.source.search(term, {fields: 'all'});
    const profiles = await Promise.all(matches.map(async profile => ({
        ...await ctx.source.summary(profile, ctx.options),
    })));
    let hasHiddenPasswords = !ctx.options.showPassword && (await Promise.all(
        matches.map(profile => ctx.source.hasHiddenSecrets?.(profile) ?? false),
    )).some(Boolean);

    for (const profile of profiles) {
        if (!ctx.options.showPassword) {
            for (const key of ctx.source.secretFields ?? ['password']) {
                if (profile[key]) {
                    hasHiddenPasswords = true;
                    profile[key] = ctx.options.json ? '(hidden)' : '(hidden*)';
                } else {
                    profile[key] = ctx.options.json ? '(hidden)' : '';
                }
            }
        }
    }

    if (ctx.options.json) {
        formatOutput(profiles, ctx.options);

        return;
    }

    const noun = profiles.length === 1 ? ctx.singular ?? 'profile' : ctx.plural ?? 'profiles';

    console.log(`Found ${profiles.length} ${noun}`);

    for (const profile of profiles) {
        console.log('');
        formatOutput(profile, {...ctx.options, table: true}, {
            columns: ['Label', 'Value'],
            rows: (ctx.source.summaryFields ?? defaultSummaryFields).map(field => [field.label, profile[field.key]]),
        });
    }

    if (hasHiddenPasswords) {
        console.log(`\n*Enable passwords with ${chalk.green('--show-password')}`);
    }
}

export async function listCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void> {
    const profiles = ctx.options.search ?
        await ctx.source.search(ctx.options.search) : await ctx.source.list();

    if (ctx.options.recurse && !ctx.options.json) {
        throw new Error('--recurse option requires --json');
    }

    if (ctx.options.recurse && ctx.options.json) {
        const tree = buildProfileTree(profiles, {
            path: profile => ctx.source.path(profile),
            folderNames: ctx.source.folderNames && (profile => ctx.source.folderNames!(profile)),
        });
        const transformTree = async (folder: ProfileTree<TProfile>): Promise<Record<string, unknown>> => ({
            name: folder.name,
            folders: await Promise.all(folder.folders.map(transformTree)),
            [ctx.source.treeProfilesKey ?? 'profiles']: await Promise.all(
                folder.profiles.map(profile => fullProperties(profile, ctx)),
            ),
        });

        formatOutput(await transformTree(tree), ctx.options);

        return;
    }

    if (ctx.options.json || ctx.options.table) {
        const data = await Promise.all(profiles.map(async profile => {
            if (ctx.options.full) {
                return fullProperties(profile, ctx);
            }

            const summary = await ctx.source.summary(profile, ctx.options);

            return {
                path: summary.path,
                host: summary.host,
                protocol: summary.protocol,
                keyFile: summary.keyFile ?? '',
                remoteDirectory: summary.remoteDirectory ?? '',
            };
        }));
        const tableData = ctx.options.full ? {
            columns: ['Path', 'Property', 'Value'],
            rows: data.flatMap(properties => Object.entries(properties)
                .filter(([key]) => key !== 'path')
                .map(([key, value]) => [properties.path, key, value])),
        } : {
            columns: [
                'Path',
                'Host',
                'Protocol',
                'Private key',
                'Remote',
            ],
            rows: data.map(properties => [
                properties.path,
                properties.host,
                properties.protocol,
                properties.keyFile,
                properties.remoteDirectory,
            ]),
        };

        formatOutput(data, ctx.options, tableData);
    } else if (ctx.options.full) {
        for (const profile of profiles) {
            formatOutput(await fullProperties(profile, ctx), ctx.options);
            console.log('');
        }
    } else {
        const summaries = await Promise.all(profiles.map(async profile => {
            const summary = await ctx.source.summary(profile, ctx.options);
            const details: string[] = [];

            if (summary.keyFile) {
                details.push(`Private key: ${summary.keyFile}`);
            }

            if (summary.remoteDirectory) {
                details.push(`Remote: ${summary.remoteDirectory}`);
            }

            return details.length > 0 ? `${summary.path} (${details.join('; ')})` : summary.path;
        }));

        formatOutput(summaries, ctx.options);
    }
}

export async function getCommand<TProfile>(ctx: ProfileCommandContext<TProfile>): Promise<void> {
    let profile: TProfile | undefined;
    let propertyName: string | undefined;
    const noun = ctx.singular ?? 'profile';

    if (ctx.options.search) {
        const matches = await ctx.source.search(ctx.options.search);

        if (matches.length === 0) {
            throw new Error(`Could not find ${noun} matching "${ctx.options.search}"`);
        } else if (matches.length > 1) {
            throw new Error(`Multiple ${ctx.plural ?? 'profiles'} found matching "${ctx.options.search}". Please be more specific or use list --search.`);
        }

        profile = matches[0];
        propertyName = ctx.args[0];
    } else {
        const path = ctx.args[0];

        if (!path) {
            throw new Error(`No ${noun} path specified`);
        }

        profile = await ctx.source.get(path);

        if (profile === undefined) {
            throw new Error(`Could not find ${noun} by path "${path}"`);
        }

        propertyName = ctx.args[1];
    }

    if (propertyName) {
        let value = await ctx.source.property(profile!, propertyName, ctx.options);

        if (value === undefined) {
            throw new Error(`Property "${propertyName}" not found on ${noun}`);
        }

        if ((ctx.source.secretFields ?? ['password']).includes(propertyName) && !ctx.options.showPassword) {
            value = '(hidden)';
        }

        formatOutput(value, ctx.options);
    } else {
        const properties = await fullProperties(profile!, ctx);

        if (ctx.options.json || ctx.options.table) {
            formatOutput(properties, ctx.options, {
                columns: ['Property', 'Value'],
                rows: Object.entries(properties),
            });
        } else {
            const display = {...properties};

            for (const key of ctx.source.plainGetOmitFields ?? []) {
                delete display[key];
            }

            formatOutput(display, ctx.options);
        }
    }
}
