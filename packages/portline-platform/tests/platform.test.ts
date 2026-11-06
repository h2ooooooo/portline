import {describe, expect, it, vi} from 'vitest';
import {NativeProfileSource, credential, discoverNativeSources, fileSource, nativeProfile, parseIni, parseRegistryExport, requireSource, selectSource, splitWindowsArguments} from '../src/index.js';

describe('native storage and selection', () => {
    it('preserves INI extensions and treats names as data', () => {
        const sections = parseIni('[Sessions\\__proto__]\nHostName=example\nCustom=a=b\nPassword=private');

        expect(sections[1].settings.Custom).toBe('a=b');
        expect(sections[1].settings.Password).toBe('private');
        expect(Object.getPrototypeOf(sections[1].settings)).toBeNull();
    });

    it('reads typed registry exports with escaped paths and continuation bytes', () => {
        const sessions = parseRegistryExport(String.raw`Windows Registry Editor Version 5.00
[HKEY_CURRENT_USER\Software\Test\Sessions\work%20host]
"HostName"="example"
"PortNumber"=dword:00000016
"PublicKeyFile"="C:\\keys\\test.ppk"
"Extra"=hex:01,02,\
  03
`, 'HKCU\\Software\\Test\\Sessions');

        expect(sessions[0].settings).toMatchObject({
            HostName: 'example',
            PortNumber: 22,
            PublicKeyFile: 'C:\\keys\\test.ppk',
            Extra: [1, 2, 3],
        });
    });

    it('does not choose ambiguously or merge registry and portable sources', () => {
        const a = fileSource('test', 'one');
        const b = fileSource('test', 'two');

        expect(() => requireSource(selectSource([a, b]))).toThrow('Multiple sources');
        expect(selectSource([a, b], {runningIds: [b.id]}).selectedSourceId).toBe(b.id);
        expect(selectSource([a, b], {runningIds: [a.id, b.id]}).selectedSourceId).toBeUndefined();
        expect(() => selectSource([a], {sourceId: 'missing'})).toThrow();
    });

    it('parses Windows quoting without interpreting storage switches as commands', () => {
        expect(splitWindowsArguments('"C:\\Program Files\\WinSCP.exe" /ini="C:\\test folder\\WinSCP.ini"')).toEqual([
            'C:\\Program Files\\WinSCP.exe',
            '/ini=C:\\test folder\\WinSCP.ini',
        ]);
    });

    it('resolves only references actually belonging to profiles and keeps raw settings opt-in', async () => {
        const source = fileSource('test', 'one');
        const reference = credential(source, 'tunnel', 'available');
        const loader = vi.fn(async () => ({state: 'available' as const, value: 'private-value'}));
        const profile = nativeProfile(source, 'work', [
            {
                id: 'ssh',
                kind: 'ssh',
                protocol: 'ssh',
                endpoint: {host: 'example', port: 22},
                authentication: [{type: 'password', credential: reference}],
            },
        ]);
        const catalog = new NativeProfileSource(source, [profile], [
            {
                name: 'work',
                settings: {Password: 'private-value', Extension: 'retained'},
            },
        ], loader);

        expect(JSON.stringify(catalog.list())).not.toContain('private-value');
        expect(catalog.getNativeSettings('work')?.Extension).toBe('retained');
        expect(await catalog.resolve({...reference, id: 'forged'})).toEqual({state: 'unavailable'});
        expect(loader).not.toHaveBeenCalled();
        expect(await catalog.resolve(reference)).toEqual({state: 'available', value: 'private-value'});
    });
});

it('leaves unknown active storage unselected and explicit files bypass inspection', async () => {
    const processes = vi.fn(async () => [{executablePath: 'C:/fixture/app.exe', arguments: []}]);
    const definition = {
        application: 'fixture',
        registryKey: 'HKCU\\Software\\PortlineFixture',
        processNames: ['app.exe'],
        portableNames: [],
        forExecutable: async () => undefined,
    };
    const options = {
        platform: 'win32' as const,
        registryReader: {exists: async () => true, read: async () => []},
        processReader: {list: processes},
    };
    const result = await discoverNativeSources(definition, options);

    expect(result.candidates).toHaveLength(1);
    expect(result.selectedSourceId).toBeUndefined();
    expect(result.diagnostics[0].code).toBe('active-storage-unknown');
    processes.mockClear();

    const explicit = await discoverNativeSources(definition, {...options, file: 'fixture.ini'});

    expect(explicit.selectedBy).toBe('explicit');
    expect(processes).not.toHaveBeenCalled();
});
