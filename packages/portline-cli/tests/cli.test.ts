import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProfileSource} from '@jalsoedesign/portline-abstract';
import {createProfileCli, parseProfileArgs, type ProfileCliSource} from '../src/index.js';

interface ExampleProfile {
    path: string;
    name: string;
    host: string;
    password?: string;
    passphrase?: string;
    keyFile?: string;
}

const profiles: ExampleProfile[] = [
    {
        path: 'Project/SSH',
        name: 'SSH',
        host: 'gateway.example.invalid',
        password: 'synthetic-password',
        passphrase: 'synthetic-passphrase',
        keyFile: 'C:\\keys\\deployment.ppk',
    },
];

function exampleSource(): ProfileCliSource<ExampleProfile> {
    const source: ProfileSource<ExampleProfile> = {
        source: {id: 'example', application: 'Example'},
        list: async () => profiles,
        get: async path => profiles.find(profile => profile.path === path),
        search: async (term, options) => profiles.filter(profile =>
            (options?.fields === 'all' ? Object.values(profile) : [profile.path, profile.name])
                .some(value => String(value).toLowerCase().includes(term.toLowerCase())),
        ),
    };

    return {
        ...source,
        path: profile => profile.path,
        summary: async profile => ({...profile, protocol: 'ssh', remoteDirectory: '/srv/project'}),
        properties: async profile => ({...profile, protocol: 'ssh', nativeOption: true}),
        property: async (profile, name) => profile[name as keyof ExampleProfile],
        secretFields: ['password', 'passphrase'],
        summaryFields: [{key: 'host', label: 'SSH gateway'}, {key: 'keyFile', label: 'Identity file'}],
    };
}

describe('reusable profile CLI', () => {
    let lines: string[];
    let errors: string[];

    beforeEach(() => {
        lines = [];
        errors = [];
        vi.spyOn(console, 'log').mockImplementation(value => lines.push(String(value)));
        vi.spyOn(console, 'error').mockImplementation(value => errors.push(String(value)));
    });

    afterEach(() => vi.restoreAllMocks());

    it('searches an asynchronous non-FileZilla source with custom fields and one password footer', async () => {
        const cli = createProfileCli({name: 'example-js', loadSource: exampleSource});

        expect(await cli.run(['search', 'GATEWAY'])).toBe(0);

        const output = lines.join('\n');

        expect(output).toContain('Found 1 profile');
        expect(output).toContain('SSH gateway');
        expect(output).toContain('C:\\keys\\deployment.ppk');
        expect(output.match(/\*Enable passwords with/g)).toHaveLength(1);
        expect(output).not.toContain('synthetic-password');
        expect(output).not.toContain('synthetic-passphrase');
    });

    it('masks all configured secrets in JSON and reveals only on request without mutating the source', async () => {
        const cli = createProfileCli({name: 'example-js', loadSource: exampleSource});

        await cli.run(['--search', 'gateway', '--json']);
        expect(JSON.parse(lines.pop()!)[0]).toMatchObject({password: '(hidden)', passphrase: '(hidden)'});
        await cli.run(['search', 'gateway', '--json', '--show-password']);
        expect(JSON.parse(lines.pop()!)[0]).toMatchObject({
            password: 'synthetic-password',
            passphrase: 'synthetic-passphrase',
        });
        expect(profiles[0].password).toBe('synthetic-password');
    });

    it('lists compact metadata and recursive full records using generic profile trees', async () => {
        const cli = createProfileCli({name: 'example-js', loadSource: exampleSource});

        await cli.run(['list', '--json']);
        expect(JSON.parse(lines.pop()!)[0]).toMatchObject({
            path: 'Project/SSH',
            keyFile: 'C:\\keys\\deployment.ppk',
            remoteDirectory: '/srv/project',
        });
        await cli.run(['list', '--json', '--recurse']);

        const tree = JSON.parse(lines.pop()!);

        expect(tree.folders[0].name).toBe('Project');
        expect(tree.folders[0].profiles[0]).toMatchObject({password: '(hidden)', nativeOption: true});
    });

    it('keeps exact selection and JSON scalar output and reports errors without exiting', async () => {
        const cli = createProfileCli({name: 'example-js', loadSource: exampleSource});

        expect(await cli.run(['get', 'Project/SSH', 'host', '--json'])).toBe(0);
        expect(JSON.parse(lines.pop()!)).toBe('gateway.example.invalid');
        expect(await cli.run(['get', 'project/ssh', '--json'])).toBe(1);
        expect(JSON.parse(errors.pop()!).error).toContain('Could not find profile by path');
        expect(await cli.run(['search', '--json'])).toBe(1);
        expect(JSON.parse(errors.pop()!).error).toContain('example-js search <term>');
    });

    it('supports application flags and commands and does not load configuration for help', async () => {
        const loadSource = vi.fn(exampleSource);
        const tunnel = vi.fn();
        const cli = createProfileCli({
            name: 'example-js',
            loadSource,
            sourceOptions: [
                {
                    flag: '--project',
                    key: 'project',
                    takesValue: true,
                    description: 'Project directory',
                },
            ],
            commands: {tunnel},
        });

        expect(await cli.run(['--help'])).toBe(0);
        expect(loadSource).not.toHaveBeenCalled();
        expect(lines.join('\n')).toContain('--project');
        expect(await cli.run(['tunnel', '--local-port', '3307'])).toBe(0);
        expect(tunnel).toHaveBeenCalledWith(['--local-port', '3307']);
        expect(loadSource).not.toHaveBeenCalled();
        await cli.run(['list', '--project', 'project-directory', '--json']);
        expect(loadSource).toHaveBeenCalledWith({project: 'project-directory', json: true});
        expect(await cli.run(['list', '--project'])).toBe(1);
        expect(errors.pop()).toContain('--project requires a value');
    });

    it('allows legacy permissive flags while new CLIs reject unknown flags by default', () => {
        expect(() => parseProfileArgs(['list', '--typo'])).toThrow('Unknown option');
        expect(parseProfileArgs(['list', '--typo'], {ignoreUnknownOptions: true}).positional).toEqual(['list']);
    });

    it('reports the selected source without exposing profile credentials', async () => {
        const cli = createProfileCli({name: 'example-js', loadSource: exampleSource});

        expect(await cli.run(['source', '--json'])).toBe(0);
        expect(JSON.parse(lines.pop()!)).toEqual({id: 'example', application: 'Example'});
    });
});
