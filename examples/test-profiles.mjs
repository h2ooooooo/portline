import assert from 'node:assert/strict';
import {ProfileCatalog} from '@jalsoedesign/portline-core';
import {createProfileCli, createNormalizedCliSource} from '@jalsoedesign/portline-cli';

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

console.log('$ demo-profiles list --json');
assert.equal(await cli.run(['list', '--json']), 0);
console.log('$ demo-profiles get Demo host --json');
assert.equal(await cli.run(['get', 'Demo', 'host', '--json']), 0);
assert.equal(catalog.search('127.0.0.1', {fields: 'all'}).length, 1);
console.log('PASS: shared catalog, query and embedded CLI. No server connection.');
