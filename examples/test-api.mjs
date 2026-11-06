import assert from 'node:assert/strict';
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
const selected = catalog.get('Demo');
const matches = catalog.search('127.0.0.1', {fields: 'all'});

assert.equal(selected.connections[0].endpoint.host, '127.0.0.1');
assert.equal(matches.length, 1);
console.log('Profiles:', catalog.list().length);
console.log('Selected:', selected.path);
console.log('Host:', selected.connections[0].endpoint.host);
console.log('Matches:', matches.length);
console.log('Metadata only; no remote connection.');
