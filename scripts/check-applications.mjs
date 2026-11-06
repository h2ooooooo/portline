import assert from 'node:assert/strict';
import {copyFile, mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {argument, artifactPackages} from './package-artifacts.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;

if (!npmCli) {
    throw new Error('Run using npm run check:applications');
}

const directory = await mkdtemp(path.join(os.tmpdir(), 'portline packed consumer '));
const artifacts = path.join(directory, 'artifacts');
const consumer = path.join(directory, 'consumer');
const packages = [];

await mkdir(artifacts);
await mkdir(consumer);

function run(args, cwd) {
    const result = spawnSync(process.execPath, args, {cwd, encoding: 'utf8', windowsHide: true});

    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'Packed consumer command failed');
    }

    return result.stdout;
}

const ownOutput = JSON.parse(run([
    npmCli,
    'pack',
    '--workspaces',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    artifacts,
], repository));

packages.push(...(Array.isArray(ownOutput) ? ownOutput : Object.values(ownOutput)));

for (const item of await artifactPackages(argument('--artifacts'))) {
    if (packages.some(candidate => candidate.name === item.name)) {
        continue;
    }

    await copyFile(item.file, path.join(artifacts, item.filename));
    packages.push(item);
}

await writeFile(path.join(consumer, 'package.json'), JSON.stringify({
    name: 'portline-isolated-consumer',
    private: true,
    type: 'module',
    dependencies: Object.fromEntries(packages.map(item => [
        item.name,
        'file:' +
        path.join(artifacts, item.filename).split(path.sep).join('/'),
    ])),
    devDependencies: {typescript: '6.0.3', '@types/node': '22.20.2'},
}, null, 4));

run([
    npmCli,
    'install',
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
], consumer);

for (const item of packages) {
    await readFile(path.join(consumer, 'node_modules', item.name, 'LICENSE'));
    await readFile(path.join(consumer, 'node_modules', item.name, 'README.md'));
}

const smoke = [
    "import assert from 'node:assert/strict';",
    "import {PuttyProfileSource} from '@jalsoedesign/putty-core';",
    "import {HeidiSqlProfileSource} from '@jalsoedesign/heidisql-core';",
    "import {OpenSshProfileSource} from '@jalsoedesign/openssh-core';",
    "import {WinScpProfileSource} from '@jalsoedesign/winscp-core';",
    "import {JetBrainsProfileSource} from '@jalsoedesign/jsbrains-portline';",
    "import {JetBrains} from '@jalsoedesign/jsbrains';",
    "import {createNormalizedCliSource} from '@jalsoedesign/portline-cli';",
    "const source = {id: 'fixture', application: 'putty'};",
    "const catalog = PuttyProfileSource.fromSessions(source, [{name: 'test', settings: {HostName: 'example', PublicKeyFile: 'id.ppk'}}]);",
    "assert.equal(catalog.list()[0].connections[0].endpoint.host, 'example');",
    "assert.equal((await createNormalizedCliSource(catalog).summary(catalog.list()[0], {})).keyFile, 'id.ppk');",
    "for (const reader of [HeidiSqlProfileSource, OpenSshProfileSource, WinScpProfileSource, JetBrainsProfileSource]) { assert.equal(typeof reader.open, 'function'); }",
    "assert.equal(typeof JetBrains.detect, 'function');",
    "console.log('All packed reader imports and shared CLI adapter passed');",
].join('\n');

await writeFile(path.join(consumer, 'smoke.mjs'), smoke);
console.log(run(['smoke.mjs'], consumer).trim());

await writeFile(path.join(consumer, 'types.mts'), [
    "import {PuttyProfileSource} from '@jalsoedesign/putty-core';",
    "import {HeidiSqlProfileSource} from '@jalsoedesign/heidisql-core';",
    "import {OpenSshProfileSource} from '@jalsoedesign/openssh-core';",
    "import {WinScpProfileSource} from '@jalsoedesign/winscp-core';",
    "import {JetBrainsProfileSource} from '@jalsoedesign/jsbrains-portline';",
    "import type {ProfileSource, ConnectionProfile} from '@jalsoedesign/portline-abstract';",
    'function accept(source: ProfileSource<ConnectionProfile>) { return source.list(); }',
    'function check(p: PuttyProfileSource, h: HeidiSqlProfileSource, o: OpenSshProfileSource, w: WinScpProfileSource, j: JetBrainsProfileSource) {',
    '    [p, h, o, w, j].forEach(accept);',
    '}',
    'void check;',
].join('\n'));

run([
    'node_modules/typescript/bin/tsc',
    '--noEmit',
    '--strict',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--skipLibCheck',
    'types.mts',
], consumer);

for (const binary of [
    'filezilla-js',
    'putty-js',
    'heidisql-js',
    'openssh-js',
    'winscp-js',
    'jsbrains-profiles',
]) {
    const help = run([
        npmCli,
        'exec',
        '--offline',
        '--no',
        '--',
        binary,
        '--help',
    ], consumer);

    assert.ok(help.includes('search') && help.includes('list') && help.includes('source'), binary);
    console.log(binary + ': packed executable passed');
}

const legacy = JSON.parse(run([
    npmCli,
    'exec',
    '--offline',
    '--no',
    '--',
    'jsbrains',
    '--version',
    '--json',
], consumer));

assert.equal(legacy.data.name, '@jalsoedesign/jsbrains-cli');

const lock = JSON.parse(await readFile(path.join(consumer, 'package-lock.json'), 'utf8'));

assert.ok(!Object.values(lock.packages).some(item => item.link), 'Consumer must not use workspace links');
console.log(packages.length + ' tarballs: isolated imports, declarations and seven executable checks passed');
console.log('Evidence: ' + directory);

const integrationDirectory = path.join(consumer, 'sync-fixtures');

await mkdir(integrationDirectory);

const sourceFile = path.join(integrationDirectory, 'portable_settings.txt');
const targetFile = path.join(integrationDirectory, 'WinSCP.ini');
const previewFile = path.join(integrationDirectory, 'preview.json');

await writeFile(sourceFile, [
    'Servers\\work\\Host\t1\tdb.internal',
    'Servers\\work\\User\t1\tdbuser',
    'Servers\\work\\NetType\t3\t2',
    'Servers\\work\\SSHtunnelHost\t1\tgateway.example',
    'Servers\\work\\SSHtunnelUser\t1\tdeploy',
    'Servers\\work\\SSHtunnelPrivateKey\t1\tC:\\keys\\deployment.ppk',
    'Servers\\work\\SSHtunnelPassword\t1\t71781',
].join('\r\n'));
await writeFile(targetFile, '; preserved native setting\n[Configuration]\nNativeOption=retained\n');

const winscpCli = path.join(consumer, 'node_modules', '@jalsoedesign', 'winscp-cli', 'bin', 'cli.js');
const preview = JSON.parse(run([
    winscpCli,
    'sync',
    '--from',
    'heidisql',
    '--from-file',
    sourceFile,
    '--profile',
    'work',
    '--connection',
    'ssh',
    '--target-path',
    'Imported',
    '--file',
    targetFile,
    '--preview',
    previewFile,
    '--json',
], consumer));

assert.equal(preview.changes[0].operation, 'create');
assert.equal(preview.mutations[0].profile.connections[0].endpoint.host, 'gateway.example');
assert.ok(!JSON.stringify(preview).includes('71781'));
assert.ok(!(await readFile(targetFile, 'utf8')).includes('HostName'));

const apply = spawnSync(process.execPath, [
    winscpCli,
    'apply',
    '--file',
    targetFile,
    '--plan',
    previewFile,
    '--json',
],
{cwd: consumer, encoding: 'utf8', windowsHide: true});

if (
    process.platform === 'win32' &&
    preview.inspection.application === 'closed' &&
    preview.inspection.lock === 'unlocked'
) {
    assert.equal(apply.status, 0, apply.stderr);

    const applied = JSON.parse(apply.stdout);

    assert.equal(applied.applied, true);
    assert.ok(applied.backups.length > 0);

    const result = JSON.parse(run([
        winscpCli,
        'get',
        'Imported',
        '--file',
        targetFile,
        '--json',
    ], consumer));

    assert.equal(result.host, 'gateway.example');
    assert.equal(result.keyFile, 'C:\\keys\\deployment.ppk');
    assert.ok((await readFile(targetFile, 'utf8')).includes('NativeOption=retained'));

    // Applying the same preview again must fail instead of overwriting the new state.
    const stale = spawnSync(process.execPath,
        [
            winscpCli,
            'apply',
            '--file',
            targetFile,
            '--plan',
            previewFile,
            '--json',
        ],
        {cwd: consumer, encoding: 'utf8', windowsHide: true});

    assert.equal(stale.status, 1);
} else {
    assert.equal(apply.status, 1, 'Unknown/busy write availability must remain blocked');
    assert.ok(!(await readFile(targetFile, 'utf8')).includes('HostName'));
}

console.log('Packed cross-app CLI sync: preview/redaction, explicit apply/refusal, native preservation and stale-plan protection passed');

if (process.platform === 'win32') {
    const {randomUUID} = await import('node:crypto');
    const {runPowerShell} = await import(pathToFileURL(path.join(consumer,
        'node_modules', '@jalsoedesign', 'portline-platform', 'dist', 'index.js')).href);
    const fixture = 'Software\\PortlineFixture-' + randomUUID().replaceAll('-', '');
    const registry = 'HKCU\\' + fixture;
    const registryPreviewFile = path.join(integrationDirectory, 'registry-preview.json');
    const puttyCli = path.join(consumer, 'node_modules', '@jalsoedesign', 'putty-cli', 'bin', 'cli.js');
    const invoke = args => spawnSync(process.execPath, [puttyCli, ...args],
        {cwd: consumer, encoding: 'utf8', windowsHide: true});

    try {
        const registryPreview = JSON.parse(run([
            puttyCli,
            'sync',
            '--from',
            'heidisql',
            '--from-file',
            sourceFile,
            '--profile',
            'work',
            '--connection',
            'ssh',
            '--target-path',
            'Imported',
            '--registry',
            registry,
            '--registry-mode',
            'guarded',
            '--preview',
            registryPreviewFile,
            '--json',
        ], consumer));

        assert.equal(registryPreview.registryMode, 'guarded');

        const mismatch = invoke([
            'apply',
            '--registry',
            registry,
            '--plan',
            registryPreviewFile,
            '--json',
        ]);

        assert.equal(mismatch.status, 1, 'The default policy must reject a guarded preview');

        const guarded = invoke([
            'apply',
            '--registry',
            registry,
            '--registry-mode',
            'guarded',
            '--plan',
            registryPreviewFile,
            '--json',
        ]);

        if (registryPreview.inspection.application === 'closed' && registryPreview.inspection.lock === 'unlocked') {
            assert.equal(guarded.status, 0, guarded.stderr || guarded.stdout);
            assert.equal(JSON.parse(guarded.stdout).applied, true);

            const result = JSON.parse(run([
                puttyCli,
                'get',
                'Imported',
                '--registry',
                registry,
                '--json',
            ], consumer));

            assert.equal(result.host, 'gateway.example');
            assert.equal(result.keyFile, 'C:\\keys\\deployment.ppk');
        } else {
            assert.equal(guarded.status, 1, 'Busy/unknown application state must remain blocked');
        }
    } finally {
        await runPowerShell(String.raw`
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($request.key -notmatch '^Software\\PortlineFixture-[a-f0-9]{32}$') { throw 'Invalid fixture key' }
[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($request.key, $false)
@{ ok = $true } | ConvertTo-Json -Compress
`, {key: fixture});
    }

    console.log('Packed guarded registry CLI: explicit policy, preview binding, native apply/refusal and cleanup passed');
}
