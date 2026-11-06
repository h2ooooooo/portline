import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {afterEach, describe, expect, it} from 'vitest';
import {GuardedFileBackend} from '../src/file-write-backend.js';
import {GuardedRegistryBackend} from '../src/registry-write-backend.js';
import {fileSource, registrySource, runPowerShell} from '../src/index.js';
import type {NativeWritePatch, WriterTarget} from '../src/write-types.js';

const directories: string[] = [];

afterEach(async () => {
    for (const directory of directories.splice(0)) {
        if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('portline-writes-')) {
            throw new Error('Refusing cleanup outside the fixture directory');
        }

        await rm(directory, {recursive: true, force: true});
    }
});

async function fixture() {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'portline-writes-'));

    directories.push(directory);

    return directory;
}

function target(filename: string): WriterTarget {
    return {
        source: fileSource('filezilla', filename),
        application: 'filezilla',
        files: [filename],
        guard: {application: 'filezilla', processNames: ['portline-fixture-not-running.exe'], lockPaths: []},
    };
}

function patch(filename: string, contents: string): NativeWritePatch {
    return {
        files: [{path: filename, data: Buffer.from(contents).toString('base64')}],
        registry: [],
        changes: [],
        diagnostics: [],
    };
}

describe.skipIf(process.platform !== 'win32')('real Windows guarded commits (synthetic storage only)', () => {
    it('takes an exclusive file handle, writes and retains a recovery backup', async () => {
        const directory = await fixture();
        const filename = path.join(directory, 'settings.xml');

        await writeFile(filename, '<old secret="fixture"/>');

        const backend = new GuardedFileBackend(target(filename));
        const snapshot = await backend.read();

        expect(await backend.inspect(snapshot)).toMatchObject({application: 'closed', lock: 'unlocked'});

        const backups = await backend.commit(snapshot, patch(filename, '<new/>'));

        expect(await readFile(filename, 'utf8')).toBe('<new/>');
        expect(backups.length).toBeGreaterThan(0);
        expect(await readFile(backups[0], 'utf8')).toBe('<old secret="fixture"/>');
    }, 30000);

    it('rechecks file revisions and refuses an open application or native marker', async () => {
        const directory = await fixture();
        const filename = path.join(directory, 'settings.xml');

        await writeFile(filename, 'old');

        const destination = target(filename);
        const backend = new GuardedFileBackend(destination);
        const snapshot = await backend.read();

        await writeFile(filename, 'external');

        await expect(backend.commit(snapshot, patch(filename, 'new'))).rejects.toThrow('refused');

        const active = new GuardedFileBackend({
            ...destination,
            guard: {
                ...destination.guard,
                processNames: ['node.exe'],
            },
        });

        expect((await active.inspect(await active.read())).application).toBe('open');
        await expect(active.commit(await active.read(), patch(filename, 'new'))).rejects.toThrow('refused');

        const marker = filename + '.lock';

        await writeFile(marker, 'native lock');

        const locked = new GuardedFileBackend({...destination, guard: {...destination.guard, lockPaths: [marker]}});

        await expect(locked.commit(await locked.read(), patch(filename, 'new'))).rejects.toThrow('refused');
        expect(await readFile(filename, 'utf8')).toBe('external');
    }, 30000);

    it('rolls back earlier file writes if a later replacement fails', async () => {
        const directory = await fixture();
        const one = path.join(directory, 'one.xml');
        const two = path.join(directory, 'two.xml');

        await writeFile(one, 'one-before');
        await writeFile(two, 'two-before');

        const backend = new GuardedFileBackend({...target(one), files: [one, two]});
        const snapshot = await backend.read();

        await expect(backend.commit(snapshot, {
            ...patch(one, 'one-after'),
            files: [...patch(one, 'one-after').files, {path: two, data: 'invalid base64!'}],
        })).rejects.toThrow();
        expect(await readFile(one, 'utf8')).toBe('one-before');
        expect(await readFile(two, 'utf8')).toBe('two-before');
    }, 30000);

    it('does not overwrite a file held by another process', async () => {
        const directory = await fixture();
        const filename = path.join(directory, 'settings.xml');

        await writeFile(filename, 'old');

        const backend = new GuardedFileBackend(target(filename));
        const snapshot = await backend.read();
        const program = [
            '$ErrorActionPreference = "Stop"',
            '$path = [Console]::In.ReadLine() | ConvertFrom-Json',
            '$stream = [IO.File]::Open($path, "Open", "ReadWrite", "None")',
            'try { [Console]::WriteLine("ready"); [Console]::Out.Flush(); [Console]::In.ReadLine() | Out-Null } finally { $stream.Dispose() }',
        ].join('\n');
        const child = spawn('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-EncodedCommand',
            Buffer.from(program, 'utf16le').toString('base64'),
        ], {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});

        try {
            const ready = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Fixture lock helper timed out')), 10000);

                child.on('error', reject);
                child.stdout.on('data', chunk => {
                    if (String(chunk).includes('ready')) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
                child.stderr.on('data', () => {});
            });

            child.stdin.write(JSON.stringify(filename) + '\n');
            await ready;
            await expect(backend.commit(snapshot, patch(filename, 'new'))).rejects.toThrow('refused');
        } finally {
            child.stdin.end('\n');
            await new Promise(resolve => child.once('close', resolve));
        }

        expect(await readFile(filename, 'utf8')).toBe('old');
    }, 30000);

    it('creates nested session files and deletes with the exclusive handle held', async () => {
        const directory = await fixture();
        const filename = path.join(directory, 'Sessions', 'folder', 'work');
        const destination: WriterTarget = {
            ...target(filename),
            files: [],
            directory: path.join(directory, 'Sessions'),
        };
        const backend = new GuardedFileBackend(destination);
        const before = await backend.read();

        await backend.commit(before, patch(filename, 'HostName\\fixture.example\\'));
        expect(await readFile(filename, 'utf8')).toContain('fixture.example');
        await backend.commit(await backend.read(), {
            files: [{path: filename, data: null}],
            registry: [],
            changes: [],
            diagnostics: [],
        });
        await expect(readFile(filename)).rejects.toMatchObject({code: 'ENOENT'});
    }, 30000);

    it('uses registry transactions or refuses an unsupported host without changes', async context => {
        const key = 'Software\\PortlineFixture-' + randomUUID().replace(/-/g, '');
        const source = registrySource('putty', 'HKCU\\' + key);
        const storage = source.storage![0] as NonNullable<WriterTarget['registry']>;
        const destination: WriterTarget = {
            ...target('unused'),
            source,
            registry: storage,
            files: [],
        };
        const backend = new GuardedRegistryBackend(destination);

        try {
            const snapshot = await backend.read();

            expect(snapshot.registry).toEqual([]);

            const availability = await backend.inspect();

            if (availability.lock === 'unknown') {
                await expect(backend.commit(snapshot, {
                    files: [],
                    registry: [
                        {
                            path: 'session',
                            set: {HostName: 'must-not-write'},
                            unset: [],
                        },
                    ],
                    changes: [],
                    diagnostics: [],
                })).rejects.toThrow('refused');
                expect(await backend.read()).toEqual(snapshot);
                context.skip();

                return;
            }

            const created = await backend.commit(snapshot, {
                files: [],
                registry: [
                    {
                        path: 'session',
                        set: {HostName: 'old.example', Extension: 'retained', PortNumber: 22},
                        unset: [],
                    },
                ],
                changes: [],
                diagnostics: [],
            });

            expect(created[0]).toMatch(/registry\.dpapi$/);

            const current = await backend.read();

            await backend.commit(current, {
                files: [],
                registry: [{path: 'session', set: {HostName: 'new.example'}, unset: []}],
                changes: [],
                diagnostics: [],
            });

            const updated = await backend.read();
            const session = updated.registry!.find(item => item.path === 'session')!;

            expect(session.values).toContainEqual({name: 'HostName', kind: 'String', value: 'new.example'});
            expect(session.values).toContainEqual({name: 'Extension', kind: 'String', value: 'retained'});
            expect(session.values).toContainEqual({name: 'PortNumber', kind: 'DWord', value: 22});
            await expect(backend.commit(current, {
                files: [],
                registry: [{path: 'session', set: {HostName: 'stale'}, unset: []}],
                changes: [],
                diagnostics: [],
            })).rejects.toThrow('refused');
        } finally {
            await runPowerShell(String.raw`
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($request.key -notmatch '^Software\\PortlineFixture-[a-f0-9]{32}$') { throw 'Unsafe cleanup path' }
$root = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Default)
try { $root.DeleteSubKeyTree($request.key, $false) } finally { $root.Dispose() }
`, {key});
        }
    }, 60000);
});
