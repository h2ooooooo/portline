import {randomUUID} from 'node:crypto';
import {afterEach, describe, expect, it} from 'vitest';
import {GuardedRegistryBackend, registryTransactionProgram} from '../src/registry-write-backend.js';
import {NativeProfileWriter} from '../src/NativeProfileWriter.js';
import {registrySource} from '../src/native-discovery.js';
import {runPowerShell} from '../src/storage.js';
import type {RegistryPatch, WriterTarget} from '../src/write-types.js';

const keys: string[] = [];

afterEach(async () => {
    if (process.platform !== 'win32') {
        return;
    }

    for (const key of keys.splice(0)) {
        await runPowerShell(String.raw`
$r=[Console]::In.ReadToEnd()|ConvertFrom-Json
if($r.key -notmatch '^Software\\PortlineFixture-[a-f0-9]{32}$'){throw 'Unsafe fixture cleanup'}
[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($r.key,$false)
`, {key});
    }
});

function fixture(mode: 'guarded' | 'transactional' = 'guarded') {
    const key = 'Software\\PortlineFixture-' + randomUUID().replace(/-/g, '');

    keys.push(key);

    const source = registrySource('putty', 'HKCU\\' + key);
    const target: WriterTarget = {
        source,
        application: 'putty',
        files: [],
        registry: source.storage![0] as WriterTarget['registry'],
        registryMode: mode,
        guard: {application: 'putty', processNames: ['portline-fixture-missing.exe'], lockPaths: []},
    };

    return {target, backend: new GuardedRegistryBackend(target), key};
}

const patch = (registry: readonly RegistryPatch[]) => ({
    files: [],
    registry,
    changes: [],
    diagnostics: [],
});

describe.skipIf(process.platform !== 'win32')('explicit guarded registry mode', () => {
    it('creates, updates and deletes a disposable profile while preserving unrelated values', async () => {
        const {backend} = fixture();

        expect(await backend.inspect()).toMatchObject({application: 'closed', lock: 'unlocked'});

        const before = await backend.read();
        const backups = await backend.commit(before, patch([
            {
                path: 'session',
                set: {HostName: 'höst.example', PortNumber: 22, Extension: '保留'},
                unset: [],
            },
        ]));

        expect(backups[0]).toMatch(/registry\.dpapi$/);

        const created = await backend.read();

        expect(created.registry!.find(key => key.path === 'session')!.values)
            .toContainEqual({name: 'Extension', kind: 'String', value: '保留'});
        await backend.commit(created, patch([{path: 'session', set: {HostName: 'new.example', PortNumber: 2222}, unset: []}]));

        const updated = await backend.read();
        const values = updated.registry!.find(key => key.path === 'session')!.values;

        expect(values).toContainEqual({name: 'HostName', kind: 'String', value: 'new.example'});
        expect(values).toContainEqual({name: 'PortNumber', kind: 'DWord', value: 2222});
        expect(values).toContainEqual({name: 'Extension', kind: 'String', value: '保留'});
        await expect(backend.commit(created, patch([{path: 'session', set: {HostName: 'stale'}, unset: []}])))
            .rejects.toMatchObject({code: 'registry-source-changed'});
        await backend.commit(updated, patch([
            {
                path: 'session',
                remove: true,
                set: {},
                unset: [],
            },
        ]));
        expect((await backend.read()).registry!.some(key => key.path === 'session')).toBe(false);
    }, 30000);

    it('refuses an open application before any mutation', async () => {
        const {target, backend} = fixture();
        const open = new GuardedRegistryBackend({...target, guard: {...target.guard, processNames: ['node.exe']}});

        expect((await open.inspect()).application).toBe('open');

        const before = await backend.read();

        await expect(open.commit(before, patch([{path: 'session', set: {HostName: 'must-not-write'}, unset: []}])))
            .rejects.toMatchObject({code: 'registry-in-use'});
        expect(await backend.read()).toEqual(before);
    }, 30000);

    it('conditionally rolls back its own writes after an injected failure', async () => {
        const {target, backend} = fixture();

        await backend.commit(await backend.read(), patch([{path: 'session', set: {HostName: 'old', Extension: 'retained'}, unset: []}]));

        const before = await backend.read();
        const modifiedProgram = registryTransactionProgram.replace(
            'GuardedSet $key $operation.name $operation.after',
            "GuardedSet $key $operation.name $operation.after; throw 'synthetic failure'",
        );
        const result = JSON.parse(await runPowerShell(modifiedProgram, {
            action: 'apply',
            mode: 'guarded',
            storage: target.registry,
            guard: target.guard,
            identity: randomUUID(),
            ownerProcessId: process.pid,
            expected: before.registry,
            changes: [{path: 'session', set: {HostName: 'ours'}, unset: []}],
        }, {timeoutMs: 0}));

        expect(result.ok).toBe(false);
        expect(result.recoveryRequired).toBe(false);
        expect(result.backups).toHaveLength(1);
        expect(await backend.read()).toEqual(before);
    }, 30000);

    it('preserves a conflicting value instead of overwriting another writer during rollback', async () => {
        const {target, backend} = fixture();

        await backend.commit(await backend.read(), patch([{path: 'session', set: {HostName: 'old'}, unset: []}]));

        const before = await backend.read();
        const modifiedProgram = registryTransactionProgram.replace(
            'GuardedSet $key $operation.name $operation.after',
            "GuardedSet $key $operation.name $operation.after; $key.SetValue($operation.name, 'foreign-edit'); throw 'synthetic race'",
        );
        const result = JSON.parse(await runPowerShell(modifiedProgram, {
            action: 'apply',
            mode: 'guarded',
            storage: target.registry,
            guard: target.guard,
            identity: randomUUID(),
            ownerProcessId: process.pid,
            expected: before.registry,
            changes: [{path: 'session', set: {HostName: 'ours'}, unset: []}],
        }, {timeoutMs: 0}));

        expect(result.ok).toBe(false);
        expect(result.recoveryRequired).toBe(true);
        expect((await backend.read()).registry!.find(key => key.path === 'session')!.values)
            .toContainEqual({name: 'HostName', kind: 'String', value: 'foreign-edit'});
    }, 30000);

    it('reports native transaction errors precisely without silently selecting guarded mode', async () => {
        const {target, backend} = fixture('transactional');
        const inspection = await backend.inspect();

        if (inspection.lock === 'unknown') {
            expect(inspection.application).toBe('closed');
            expect(inspection.diagnostics.length).toBeGreaterThan(0);
            await expect(backend.commit(await backend.read(),
                patch([{path: 'session', set: {HostName: 'must-not-write'}, unset: []}]))).rejects.toHaveProperty('code');
            expect((await backend.read()).registry).toEqual([]);
        } else {
            expect(inspection.lock).toBe('unlocked');
        }

        const writer = new NativeProfileWriter({
            application: 'putty',
            source: target.source,
            backend,
            registryMode: 'transactional',
        });
        const status = await writer.inspect();

        expect(status.source.id).toBe(target.source.id);
    }, 30000);
});
