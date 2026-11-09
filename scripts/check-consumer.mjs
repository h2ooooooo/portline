import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {argument} from './package-artifacts.mjs';
import {startReleaseRegistry} from './release-registry.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;

if (!npmCli) {
    throw new Error('Run using npm run check:consumer');
}

async function run(args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {cwd, windowsHide: true});
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', chunk => {
            stdout += chunk;
        });
        child.stderr.on('data', chunk => {
            stderr += chunk;
        });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve(stdout) :
            reject(new Error(stderr || stdout || 'Consumer command failed')));
    });
}

const registry = process.argv.includes('--artifacts') ? await startReleaseRegistry(argument('--artifacts')) : undefined;

try {
    const directory = await mkdtemp(path.join(tmpdir(), 'portline shared consumer '));
    const artifacts = path.join(directory, 'artifacts');
    const consumer = path.join(directory, 'consumer');

    await mkdir(artifacts);
    await mkdir(consumer);

    const packed = JSON.parse(await run([
        npmCli,
        'pack',
        '--workspaces',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        artifacts,
    ], repository));
    const packages = Array.isArray(packed) ? packed : Object.values(packed);

    assert.equal(packages.length, 5);

    await writeFile(path.join(consumer, 'package.json'), JSON.stringify({
        private: true,
        type: 'module',
        dependencies: Object.fromEntries(packages.map(item => [item.name, 'file:' + path.join(artifacts, item.filename).split(path.sep).join('/')])),
        devDependencies: {typescript: '6.0.3', '@types/node': '22.20.2'},
    }, null, 4));
    await run([
        npmCli,
        'install',
        '--prefer-offline',
        '--registry=' + (registry?.url ?? 'https://registry.npmjs.org'),
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
    ], consumer);

    const lock = JSON.parse(await readFile(path.join(consumer, 'package-lock.json'), 'utf8'));

    assert.ok(!Object.values(lock.packages).some(item => item.link), 'Packed consumers must not resolve repository links');

    for (const item of packages) {
        const manifest = JSON.parse(await readFile(path.join(consumer, 'node_modules', item.name, 'package.json'), 'utf8'));

        for (const version of Object.values(manifest.dependencies ?? {})) {
            assert.ok(!/^(file:|link:|workspace:)/.test(version), item.name + ': nonportable runtime dependency');
        }
    }

    await writeFile(path.join(consumer, 'smoke.cjs'), `
const assert = require('node:assert/strict');
const {ProfileConnectorFactory} = require('@jalsoedesign/portline-abstract');
const {ProfileCatalog, CredentialResolver, planProfileSync} = require('@jalsoedesign/portline-core');
const {NativeProfileWriter, RegistryWriteError} = require('@jalsoedesign/portline-platform');
const {DocklineBridge, createDocklineBridge} = require('@jalsoedesign/portline-dockline');
for (const api of [ProfileConnectorFactory, ProfileCatalog, CredentialResolver, planProfileSync, NativeProfileWriter, RegistryWriteError, DocklineBridge, createDocklineBridge]) {
    assert.equal(typeof api, 'function');
}
`);
    await run(['smoke.cjs'], consumer);
    await writeFile(path.join(consumer, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ProfileCatalog} from '@jalsoedesign/portline-core';
import {createProfileCli, createProfileWriteCommands} from '@jalsoedesign/portline-cli';
import {NativeProfileWriter} from '@jalsoedesign/portline-platform';
const require = createRequire(import.meta.url);
assert.equal(ProfileCatalog, require('@jalsoedesign/portline-core').ProfileCatalog);
assert.equal(NativeProfileWriter, require('@jalsoedesign/portline-platform').NativeProfileWriter);
assert.equal(typeof createProfileWriteCommands, 'function');
const cli = createProfileCli({name: 'fixture', loadSource() { throw new Error('Help must not load native settings'); }});
assert.equal(await cli.run(['--help']), 0);
`);
    console.log((await run(['smoke.mjs'], consumer)).trim());
    await writeFile(path.join(consumer, 'types.mts'), `
import type {ConnectionProfile, ProfileSource} from '@jalsoedesign/portline-abstract';
import {CredentialResolver, planProfileSync} from '@jalsoedesign/portline-core';
import {NativeProfileWriter, type NativeWriteOptions, type RegistryWriteMode} from '@jalsoedesign/portline-platform';
import {createProfileCli, createProfileWriteCommands} from '@jalsoedesign/portline-cli';
function types(profile: ConnectionProfile, source: ProfileSource, options: NativeWriteOptions, policy: RegistryWriteMode) {
    return [profile, source, new NativeProfileWriter({...options, registryMode: policy}), new CredentialResolver(), planProfileSync, createProfileCli, createProfileWriteCommands];
}
void types;
`);
    await run([
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
    console.log('Five shared tarballs: portable dependencies, isolated CommonJS/ESM identity, CLI help and declarations passed');
    console.log('Evidence: ' + directory);

} finally {
    await registry?.close();
}
