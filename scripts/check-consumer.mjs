import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;

if (!npmCli) {
    throw new Error('Run using npm run check:consumer');
}

function run(args, cwd) {
    const result = spawnSync(process.execPath, args, {cwd, encoding: 'utf8', windowsHide: true});

    assert.equal(result.status, 0, result.stderr || result.stdout);

    return result.stdout;
}

const directory = await mkdtemp(path.join(tmpdir(), 'portline shared consumer '));
const artifacts = path.join(directory, 'artifacts');
const consumer = path.join(directory, 'consumer');

await mkdir(artifacts);
await mkdir(consumer);

const packed = JSON.parse(run([
    npmCli,
    'pack',
    '--workspaces',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    artifacts,
], repository));
const packages = Array.isArray(packed) ? packed : Object.values(packed);

assert.equal(packages.length, 4);

await writeFile(path.join(consumer, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: Object.fromEntries(packages.map(item => [item.name, 'file:' + path.join(artifacts, item.filename).split(path.sep).join('/')])),
    devDependencies: {typescript: '6.0.3', '@types/node': '22.20.2'},
}, null, 4));
run([
    npmCli,
    'install',
    '--prefer-offline',
    '--registry=https://registry.npmjs.org',
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
for (const api of [ProfileConnectorFactory, ProfileCatalog, CredentialResolver, planProfileSync, NativeProfileWriter, RegistryWriteError]) {
    assert.equal(typeof api, 'function');
}
`);
run(['smoke.cjs'], consumer);
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
console.log(run(['smoke.mjs'], consumer).trim());
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
console.log('Four shared tarballs: portable dependencies, isolated CommonJS/ESM identity, CLI help and declarations passed');
console.log('Evidence: ' + directory);
