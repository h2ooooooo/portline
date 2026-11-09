// execution.mjs

import {createDocklineBridge} from '@jalsoedesign/portline-dockline';

const profile = {
    id: 'demo',
    path: 'Demo',
    name: 'Demo',
    source: {id: 'demo-source', application: 'Synthetic fixture'},
    diagnostics: [],
    connections: [{
        id: 'primary',
        kind: 'ssh',
        protocol: 'sftp',
        endpoint: {host: 'example.test', port: 22, username: 'demo'},
        remoteDirectory: '/reports',
        authentication: [{
            type: 'password',
            credential: {sourceId: 'demo-source', id: 'demo-password', kind: 'password', state: 'available'},
        }],
    }],
};
let requests = 0;
const source = {
    source: profile.source,
    list: () => [profile],
    get: selectedPath => selectedPath === profile.path ? profile : undefined,
    search: term => profile.name.includes(term) ? [profile] : [],
    resolve(reference) {
        if (reference.sourceId !== profile.source.id || reference.id !== 'demo-password') {
            return {state: 'unavailable'};
        }

        requests++;

        return {state: 'available', value: 'synthetic-demo-password'};
    },
};
const bridge = createDocklineBridge({source});
const options = {hostFingerprint: 'SHA256:' + 'A'.repeat(43)};

console.log('Credential requests before mapping: ' + requests);

const files = await bridge.toConfig('Demo', options);
const ssh = await bridge.toSshConfig('Demo', options);

console.log('File protocol: ' + files.protocol);
console.log('File root: ' + files.root);
console.log('SSH endpoint: ' + ssh.host + ':' + ssh.port);
console.log('Credential requests after mapping: ' + requests);
console.log('No client loaded, no connection opened; secret values omitted.');
