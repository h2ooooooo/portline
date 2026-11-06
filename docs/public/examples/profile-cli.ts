// profile-cli.ts
import {createProfileCli, createNormalizedCliSource} from '@jalsoedesign/portline-cli';
import {ProfileCatalog} from '@jalsoedesign/portline-core';

const source = {id: 'demo', application: 'demo'};
const catalog = new ProfileCatalog(source, [
    {
        id: 'demo',
        name: 'Demo',
        path: 'Demo',
        source,
        diagnostics: [],
        connections: [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'ssh',
                endpoint: {host: '127.0.0.1', port: 22, username: 'fixture'},
                authentication: [],
            },
        ],
    },
]);

const cli = createProfileCli({
    name: 'demo-profiles',
    loadSource: () => createNormalizedCliSource(catalog),
});

process.exitCode = await cli.run(process.argv.slice(2));
