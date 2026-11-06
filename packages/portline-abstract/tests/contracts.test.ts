import {describe, expect, it} from 'vitest';
import {ProfileConnectorFactory, type ConnectionProfile} from '../src/index.js';

describe('source-independent contracts', () => {
    it('supports a database profile with independent SSH-hop authentication', () => {
        const profile: ConnectionProfile = {
            id: 'database',
            path: 'Production/Database',
            name: 'Database',
            source: {id: 'synthetic', application: 'Example application'},
            diagnostics: [],
            connections: [
                {
                    id: 'database',
                    kind: 'database',
                    protocol: 'mysql',
                    endpoint: {host: 'db.internal', port: 3306, username: 'database-user'},
                    authentication: [],
                    via: ['gateway'],
                },
                {
                    id: 'gateway',
                    kind: 'ssh',
                    protocol: 'ssh',
                    endpoint: {host: 'gateway.example.invalid', port: 22, username: 'ssh-user'},
                    authentication: [{type: 'agent'}],
                },
            ],
        };

        class TunnelFactory extends ProfileConnectorFactory<ConnectionProfile, {close(): void}> {
            public fromProfile(_profile: ConnectionProfile) {
                return {close() {}};
            }
        }

        expect(new TunnelFactory().fromProfile(profile)).toHaveProperty('close');
        expect(profile.connections[0].via).toEqual(['gateway']);
        expect(profile.connections[1].endpoint.username).toBe('ssh-user');
    });
});
