// sync-preview.js
import {planProfileSync} from '@jalsoedesign/portline-core';
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

const destination = {id: 'preview-only', application: 'demo'};
let projected = [];

// This in-memory writer demonstrates planning and deliberately refuses apply.
const writer = {
    inspect() {
        return {
            source: destination,
            revision: 'demo-revision',
            lock: 'unlocked',
            application: 'closed',
            diagnostics: [],
        };
    },
    plan(profiles) {
        projected = profiles;

        return {
            sourceId: destination.id,
            expectedRevision: 'demo-revision',
            changes: profiles.map(profile => ({
                profileId: profile.id,
                operation: 'create',
                fields: ['path', 'connections'],
            })),
        };
    },
    apply() {
        throw new Error('This example cannot write native settings');
    },
};

// Select profile Demo in the source and plan its SSH connection at Imported/Demo.
const preview = await planProfileSync(catalog, writer, [{
    sourcePath: 'Demo',
    connectionId: 'ssh',
    targetPath: 'Imported/Demo',
}]);

console.log('Source profile: Demo');
console.log('Destination profile: ' + projected[0]?.path);
console.log('Planned changes: ' + preview.changes.length);
console.log('Native settings written: no');
