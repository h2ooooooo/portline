import {describe, expect, it} from 'vitest';
import {XMLParser} from 'fast-xml-parser';
import type {ConnectionProfile} from '@jalsoedesign/portline-abstract';
import {NativeProfileWriter} from '../src/NativeProfileWriter.js';
import {fileSource, registrySource} from '../src/index.js';
import type {NativeWritePatch, ProfileWriteBackend, WriteSnapshot} from '../src/write-types.js';
import {planProfileSync, ProfileCatalog} from '@jalsoedesign/portline-core';

class MemoryBackend implements ProfileWriteBackend {
    public snapshot: WriteSnapshot;

    public application: 'closed' | 'open' | 'unknown' = 'closed';

    public lock: 'unlocked' | 'locked' | 'unknown' = 'unlocked';

    public commits = 0;

    public constructor(filename: string, contents: string) {
        this.snapshot = {files: [{path: filename, data: Buffer.from(contents).toString('base64')}]};
    }

    public async read() {
        return structuredClone(this.snapshot);
    }

    public async inspect() {
        return {application: this.application, lock: this.lock, diagnostics: []};
    }

    public async commit(expected: WriteSnapshot, patch: NativeWritePatch) {
        if (
            JSON.stringify(expected) !== JSON.stringify(this.snapshot) ||
            this.application !== 'closed' ||
            this.lock !== 'unlocked'
        ) {
            throw new Error('Changed or busy');
        }

        this.commits++;

        const files = new Map(this.snapshot.files.map(file => [file.path, file]));

        for (const file of patch.files) {
            files.set(file.path, file);
        }

        this.snapshot = {files: [...files.values()]};

        return ['fixture-backup'];
    }

    public contents(filename?: string) {
        return Buffer.from(this.snapshot.files.find(file => !filename || file.path === filename)!.data!, 'base64')
            .toString('utf8');
    }
}

function profile(profilePath = 'work'): ConnectionProfile {
    return {
        id: 'source',
        path: profilePath,
        name: 'Friendly source name',
        source: {id: 'source', application: 'fixture'},
        connections: [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'ssh',
                endpoint: {host: 'new.example', port: 2222, username: 'deploy'},
                authentication: [{type: 'private-key', path: {value: 'C:\\keys\\id.ppk'}, format: 'ppk'}],
            },
        ],
        diagnostics: [],
    };
}

describe('preview, import and guarded apply', () => {
    it('does not write during preview and strips arbitrary input/secret values', async () => {
        const source = fileSource('winscp', 'fixture.ini');
        const backend = new MemoryBackend(source.location!, '; untouched\n[Configuration]\nOption=retained\n');
        const writer = new NativeProfileWriter({application: 'winscp', source, backend});
        const input = {...profile(), password: 'never-copy', raw: {Password: 'never-copy'}} as ConnectionProfile;
        const preview = await writer.plan([input]);

        expect(backend.commits).toBe(0);
        expect(JSON.stringify(preview)).not.toContain('never-copy');
        expect(preview.changes[0].operation).toBe('create');
        await writer.apply(preview);
        expect(backend.contents()).toContain('Option=retained');
        expect(backend.contents()).toContain('[Sessions\\work]');
        expect(writer.backupPaths).toEqual(['fixture-backup']);
        await expect(writer.apply(preview)).rejects.toThrow('preview');
    });

    it.each(['open', 'unknown'] as const)('refuses application state %s and accepts previews while busy', async state => {
        const source = fileSource('winscp', 'fixture.ini');
        const backend = new MemoryBackend(source.location!, '');
        const writer = new NativeProfileWriter({application: 'winscp', source, backend});
        const preview = await writer.plan([profile()]);

        backend.application = state;
        await expect(writer.apply(preview)).rejects.toThrow('in use');
        expect(backend.commits).toBe(0);
    });

    it.each(['locked', 'unknown'] as const)('refuses lock state %s', async state => {
        const source = fileSource('winscp', 'fixture.ini');
        const backend = new MemoryBackend(source.location!, '');
        const writer = new NativeProfileWriter({application: 'winscp', source, backend});
        const preview = await writer.plan([profile()]);

        backend.lock = state;
        await expect(writer.apply(preview)).rejects.toThrow('locked');
    });

    it('rejects stale, forged and modified previews', async () => {
        const source = fileSource('winscp', 'fixture.ini');
        const backend = new MemoryBackend(source.location!, '');
        const writer = new NativeProfileWriter({application: 'winscp', source, backend});
        const preview = await writer.plan([profile()]);

        await expect(writer.apply({...preview})).rejects.toThrow('this writer');
        backend.snapshot = {files: [{path: source.location!, data: Buffer.from('external edit').toString('base64')}]};
        await expect(writer.apply(preview)).rejects.toThrow('changed');
        await expect(writer.importPlan(JSON.parse(JSON.stringify(preview)))).rejects.toThrow('changed');

        const fresh = await writer.plan([profile()]);

        (fresh.changes as any)[0].fields.push('tampered');

        await expect(writer.apply(fresh)).rejects.toThrow('modified');
        expect(backend.commits).toBe(0);
    });

    it('reconstructs saved previews without accepting serialized native bytes', async () => {
        const source = fileSource('winscp', 'fixture.ini');
        const backend = new MemoryBackend(source.location!, '');
        const writer = new NativeProfileWriter({application: 'winscp', source, backend});
        const preview = await writer.plan([profile()]);
        const imported = await writer.importPlan(JSON.parse(JSON.stringify(preview)));

        await writer.apply(imported);
        expect(backend.commits).toBe(1);
    });

    it('detects a race between inspection and backend commit', async () => {
        const source = fileSource('winscp', 'fixture.ini');
        const backend = new MemoryBackend(source.location!, '');
        const commit = backend.commit.bind(backend);

        backend.commit = async (snapshot, patch) => {
            backend.application = 'open';

            return commit(snapshot, patch);
        };

        const writer = new NativeProfileWriter({application: 'winscp', source, backend});
        const preview = await writer.plan([profile()]);

        await expect(writer.apply(preview)).rejects.toThrow('busy');
        expect(backend.contents()).toBe('');
    });
});

describe('native preservation and sync projections', () => {
    it('keeps FileZilla folders/unknown settings and clears credentials after endpoint changes', async () => {
        const source = fileSource('filezilla', 'sitemanager.xml');
        const backend = new MemoryBackend(source.location!, [
            '<?xml version="1.0"?><FileZilla3><!--keep--><Servers>',
            '<Folder>Folder<Server><Name>work</Name><Host>old.example</Host><Port>22</Port>',
            '<User>old</User><Logontype>1</Logontype><Pass encoding="base64">c2VjcmV0</Pass>',
            '<Unknown>preserved</Unknown></Server></Folder></Servers><Other>untouched</Other></FileZilla3>',
        ].join(''));
        const writer = new NativeProfileWriter({
            application: 'filezilla',
            source,
            backend,
            mode: 'update',
        });
        const preview = await writer.plan([profile('Folder/work')]);

        expect(JSON.stringify(preview)).not.toContain('c2VjcmV0');
        await writer.apply(preview);

        const xml = backend.contents();
        const parsed = new XMLParser({ignoreAttributes: false}).parse(xml);

        expect(xml).toContain('<!--keep-->');
        expect(parsed.FileZilla3.Other).toBe('untouched');
        expect(parsed.FileZilla3.Servers.Folder.Server.Unknown).toBe('preserved');
        expect(parsed.FileZilla3.Servers.Folder.Server.Host).toBe('new.example');
        expect(parsed.FileZilla3.Servers.Folder.Server.Pass).toBeUndefined();
    });

    it('updates only an existing HeidiSQL tunnel and preserves database/native fields', async () => {
        const source = fileSource('heidisql', 'portable_settings.txt');
        const backend = new MemoryBackend(source.location!, [
            'Servers\\work\\Host\t1\tdb.internal',
            'Servers\\work\\User\t1\tdbuser',
            'Servers\\work\\NetType\t3\t0',
            'Servers\\work\\Password\t1\tencoded-database-secret',
            'Servers\\work\\Extension\t1\tpreserved',
        ].join('\r\n'));
        const writer = new NativeProfileWriter({
            application: 'heidisql',
            source,
            backend,
            mode: 'update',
        });
        const preview = await writer.plan([profile()]);

        await writer.apply(preview);
        expect(backend.contents()).toContain('Host\t1\tdb.internal');
        expect(backend.contents()).toContain('Password\t1\tencoded-database-secret');
        expect(backend.contents()).toContain('Extension\t1\tpreserved');
        expect(backend.contents()).toContain('SSHtunnelHost\t1\tnew.example');
        expect(backend.contents()).toContain('SSHtunnelActive\t3\t1');
    });

    it('edits registry exports without touching unrelated values or sections', async () => {
        const source = fileSource('putty', 'putty.reg');
        const contents = String.raw`Windows Registry Editor Version 5.00
[HKEY_CURRENT_USER\Software\SimonTatham\PuTTY\Sessions\work]
"HostName"="old"
"Font"="Consolas"
"Unknown"=hex:01,02
[HKEY_CURRENT_USER\Software\Elsewhere]
"Value"="unchanged"
`;
        const backend = new MemoryBackend(source.location!, contents);
        const writer = new NativeProfileWriter({
            application: 'putty',
            source,
            backend,
            mode: 'update',
        });

        await writer.apply(await writer.plan([profile()]));
        expect(backend.contents()).toContain('"Font"="Consolas"');
        expect(backend.contents()).toContain('"Unknown"=hex:01,02');
        expect(backend.contents()).toContain('"Value"="unchanged"');
        expect(backend.contents()).toContain('"HostName"="new.example"');
    });

    it('writes only the chosen JetBrains file and preserves shared SSH references elsewhere', async () => {
        const source = fileSource('jetbrains', 'ide-config', 'directory');
        const filename = source.location! + '/options/webServers.xml';
        const nativePath = filename.replace(/\//g, process.platform === 'win32' ? '\\' : '/');
        const backend = new MemoryBackend(nativePath,
            '<application><component name="WebServers"><option name="servers">' +
            '<webServer id="one" name="Old"><fileTransfer accessType="SFTP" sshConfigId="shared"><advanced keep="true"/></fileTransfer></webServer>' +
            '<webServer id="two" name="Keep"><fileTransfer accessType="SFTP" sshConfigId="shared"/></webServer>' +
            '</option></component><component name="Other"><option value="retained"/></component></application>');

        backend.snapshot = {
            files: [
                ...backend.snapshot.files,
                {
                    path: nativePath.replace('webServers.xml', 'sshConfigs.xml'),
                    data: Buffer.from('<application><component name="SshConfigs"><configs><sshConfig id="shared" host="old"/></configs></component></application>').toString('base64'),
                },
            ],
        };

        const oldSsh = backend.snapshot.files[1].data;
        const writer = new NativeProfileWriter({
            application: 'jetbrains',
            source,
            backend,
            mode: 'update',
        });
        const preview = await writer.plan([profile('global/deployments/one')]);

        await writer.apply(preview);
        expect(backend.snapshot.files[1].data).toBe(oldSsh);
        expect(backend.contents(nativePath)).toContain('keep="true"');
        expect(backend.contents(nativePath)).toContain('sshConfigId="shared"');

        const parsed = new XMLParser({ignoreAttributes: false}).parse(backend.contents(nativePath));
        const servers = parsed.application.component[0].option.webServer;

        expect(servers[0].fileTransfer['@_host']).toBe('new.example');
        expect(servers[0].fileTransfer['@_sshConfigId']).toBeUndefined();
        expect(servers[1].fileTransfer['@_sshConfigId']).toBe('shared');
    });

    it('supports create/update/delete for managed OpenSSH aliases and refuses shared native aliases', async () => {
        const source = fileSource('openssh', 'config');
        const backend = new MemoryBackend(source.location!, '# untouched\nHost existing other\n    HostName old\n');
        const input = profile();
        const auth = {type: 'private-key' as const, path: {value: 'C:\\keys\\id_ed25519'}, format: 'openssh' as const};
        const imported = {...input, connections: [{...input.connections[0], authentication: [auth]}]};
        const writer = new NativeProfileWriter({application: 'openssh', source, backend});

        await writer.apply(await writer.plan([imported]));
        expect(backend.contents()).toContain('# untouched\nHost existing other');
        expect(backend.contents()).toContain('HostName "new.example"');

        const update = new NativeProfileWriter({
            application: 'openssh',
            source,
            backend,
            mode: 'update',
        });

        await update.apply(await update.plan([imported]));
        await update.apply(await update.planChanges([{operation: 'delete', path: 'work'}]));
        expect(backend.contents()).not.toContain('Portline profile');
        await expect(writer.plan([{...imported, path: 'existing'}])).rejects.toThrow('unmanaged');
    });

    it('requires explicit tunnel selection and rejects lossy/unsupported cross-app connections', async () => {
        const input = profile();
        const database = {
            id: 'database',
            kind: 'database' as const,
            protocol: 'mysql',
            endpoint: {host: 'database', port: 3306},
            authentication: [],
            via: ['ssh'],
        };
        const multi = {...input, connections: [database, ...input.connections]};
        const catalog = new ProfileCatalog(input.source, [multi]);
        const source = registrySource('putty', 'HKCU\\Software\\PortlineFixture');
        const backend = new MemoryBackend('unused', '');

        backend.snapshot = {files: [], registry: []};

        const writer = new NativeProfileWriter({application: 'putty', source, backend});

        await expect(planProfileSync(catalog, writer, [{sourcePath: 'work', targetPath: 'target'}]))
            .rejects.toThrow('explicitly');

        const preview = await planProfileSync(catalog, writer, [
            {
                sourcePath: 'work',
                targetPath: 'target',
                connectionId: 'ssh',
            },
        ]);

        expect(preview.changes[0].operation).toBe('create');
        expect(preview.mutations[0].profile?.connections[0].endpoint.host).toBe('new.example');
        expect(backend.commits).toBe(0);
    });
});

it('binds guarded registry policy to the reviewed preview and refuses policy substitution', async () => {
    const source = registrySource('putty', 'HKCU\\Software\\PortlineFixture');
    const backend = new MemoryBackend('unused', '');

    backend.snapshot = {files: [], registry: []};

    const guarded = new NativeProfileWriter({
        application: 'putty',
        source,
        backend,
        registryMode: 'guarded',
    });
    const preview = await guarded.plan([profile()]);

    expect(preview.registryMode).toBe('guarded');
    expect(preview.diagnostics.some(item => item.code === 'non-atomic-registry-write')).toBe(true);

    const strict = new NativeProfileWriter({application: 'putty', source, backend});

    await expect(strict.importPlan(JSON.parse(JSON.stringify(preview)))).rejects.toThrow('policy');

    const imported = await guarded.importPlan(JSON.parse(JSON.stringify(preview)));

    await guarded.apply(imported);
    expect(backend.commits).toBe(1);
});
