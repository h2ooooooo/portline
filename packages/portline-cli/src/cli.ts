import type {ProfileCliDefinition, ProfileCliOptions, ProfileCommandContext} from './types.js';
import {getCommand, listCommand, searchCommand, sourceCommand} from './commands.js';

export function parseProfileArgs(
    args: readonly string[],
    definition: Pick<ProfileCliDefinition<unknown>, 'sourceOptions' | 'ignoreUnknownOptions'> = {},
) {
    const options: ProfileCliOptions = {};
    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const sourceOption = definition.sourceOptions?.find(option => option.flag === arg);

        if (sourceOption) {
            if (sourceOption.takesValue) {
                if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
                    throw new Error(`${arg} requires a value`);
                }

                options[sourceOption.key] = args[++i];
            } else {
                options[sourceOption.key] = true;
            }
        } else if (arg === '--json') {
            options.json = true;
        } else if (arg === '--table') {
            options.table = true;
        } else if (arg === '--full') {
            options.full = true;
        } else if (arg === '--recurse') {
            options.recurse = true;
        } else if (arg === '--show-password') {
            options.showPassword = true;
        } else if (arg === '--file') {
            if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
                throw new Error('--file requires a value');
            }

            options.file = args[++i];
        } else if (arg === '--search') {
            if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
                throw new Error('--search requires a term');
            }

            options.search = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--color' || arg === '--no-color') {
            // Executable bootstraps apply color preferences before importing Chalk.
        } else if (arg.startsWith('--')) {
            if (!definition.ignoreUnknownOptions) {
                throw new Error(`Unknown option "${arg}"`);
            }
        } else {
            positional.push(arg);
        }
    }

    return {options, positional};
}

/** Runs without exiting the process so other applications can embed or test it. */
export function createProfileCli<TProfile>(definition: ProfileCliDefinition<TProfile>) {
    const help = definition.help ?? [
        `Usage: ${definition.name} <command> [options] [args]`,
        '',
        'Commands: search <term>, list, get <path> [property], source' +
        Object.keys(definition.commands ?? {}).map(command => ', ' + command).join(''),
        'Options: --json, --table, --full, --recurse, --search <term>, --show-password, --help',
        ...(definition.sourceOptions ?? []).map(option => `${option.flag}: ${option.description}`),
    ].join('\n');

    return {
        async run(args: string[] = process.argv.slice(2)): Promise<number> {
            const hasExtension = definition.commands &&
                Object.prototype.hasOwnProperty.call(definition.commands, args[0]);
            const extension = hasExtension ? definition.commands![args[0]] : undefined;

            if (extension) {
                try {
                    await extension(args.slice(1));

                    return 0;
                } catch (error: any) {
                    const registry = error.name === 'RegistryWriteError' ? {
                        code: error.code,
                        nativeCode: error.nativeCode,
                        operation: error.operation,
                        recoveryRequired: error.recoveryRequired,
                        backups: error.backupPaths,
                    } : {};
                    const recovery = Array.isArray(error.backupPaths) && error.backupPaths.length ?
                        '\nRecovery backups: ' + error.backupPaths.join(', ') : '';

                    console.error(args.includes('--json') ?
                        JSON.stringify({error: error.message, ...registry}) : 'Error: ' + error.message + recovery);

                    return 1;
                }
            }

            let parsed: ReturnType<typeof parseProfileArgs>;

            try {
                parsed = parseProfileArgs(args, definition);
            } catch (error: any) {
                console.error(args.includes('--json') ?
                    JSON.stringify({error: error.message}) : `Error: ${error.message}`);

                return 1;
            }

            const {options, positional} = parsed;

            if (options.help || (positional.length === 0 && options.search === undefined)) {
                console.log(help);

                return 0;
            }

            const command = positional[0] ?? 'search';
            const commands: Record<string, (ctx: ProfileCommandContext<TProfile>) => Promise<void>> = {
                list: listCommand,
                get: getCommand,
                search: searchCommand,
                source: sourceCommand,
            };
            const handler = Object.prototype.hasOwnProperty.call(commands, command) ? commands[command] : undefined;

            if (!handler) {
                console.error(`Error: Unknown command "${command}"`);
                console.log(help);

                return 1;
            }

            try {
                await handler({
                    source: await definition.loadSource(options),
                    args: positional.slice(1),
                    options,
                    executableName: definition.name,
                    singular: definition.singular,
                    plural: definition.plural,
                });

                return 0;
            } catch (error: any) {
                console.error(options.json ? JSON.stringify({error: error.message}) : `Error: ${error.message}`);

                return 1;
            }
        },
    };
}
