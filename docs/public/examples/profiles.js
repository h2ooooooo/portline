// profiles.js
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
const connection = selected?.connections[0];

if (!selected || !connection) {
    throw new Error('The demo profile must contain a connection');
}

const matches = catalog.search('127.0.0.1', {fields: 'all'});

console.log('Profiles: ' + catalog.list().length);
console.log('Selected: ' + selected.path);
console.log('Host: ' + connection.endpoint.host);
console.log('Matches: ' + matches.length);
console.log('Metadata only: no settings read and no connection opened.');
