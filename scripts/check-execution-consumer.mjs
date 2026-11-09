import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {argument} from './package-artifacts.mjs';
import {startReleaseRegistry} from './release-registry.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;

assert.ok(npmCli, 'Run through npm run check:execution-consumer');

const registry = await startReleaseRegistry(argument('--artifacts'));
const directory = await mkdtemp(path.join(tmpdir(), 'portline execution consumer '));

async function run(args) {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {cwd: directory, stdio: 'inherit', windowsHide: true});

        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error('Consumer command failed: ' + args.join(' '))));
    });
}

try {
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({
        private: true,
        type: 'module',
        dependencies: {'@jalsoedesign/portline-dockline': '^1.0.0'},
        devDependencies: {typescript: '6.0.3', '@types/node': '22.20.5'},
    }, null, 4));
    await run([
        npmCli,
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--registry=' + registry.url,
    ]);

    const lock = JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8'));

    for (const client of ['ftp', 'sftp', 'ssh']) {
        assert.equal(lock.packages['node_modules/@jalsoedesign/dockline-' + client + '-client'], undefined,
            'Optional protocol clients must remain absent: ' + client);
    }

    assert.equal(Object.values(lock.packages).some(entry => entry.link), false, 'Packed consumer must contain no links');
    await writeFile(path.join(directory, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createDocklineBridge, ProfileExecutionError} from '@jalsoedesign/portline-dockline';
const require = createRequire(import.meta.url);
assert.equal(require('@jalsoedesign/portline-dockline').createDocklineBridge, createDocklineBridge);
const bridge = createDocklineBridge();
const auth = [{type:'prompt-password'}];
const ftp = {id:'site',path:'site',name:'site',source:{id:'fixture',application:'Fixture'},diagnostics:[],
    connections:[{id:'primary',kind:'ftp',protocol:'ftps',tls:'explicit',authentication:auth,
        endpoint:{host:'example.test',port:21,username:'user'}}]};
const ssh = {...ftp, connections:[{...ftp.connections[0],kind:'ssh',protocol:'sftp',
    endpoint:{host:'ssh.test',port:22,username:'user'}}]};
assert.equal((await bridge.toConfig(ftp,{password:'secret'})).protocol,'ftps');
assert.equal((await bridge.toConfig(ssh,{password:'secret',hostFingerprint:'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'})).protocol,'sftp');
assert.equal((await bridge.toSshConfig(ssh,{password:'secret',hostFingerprint:'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'})).host,'ssh.test');
for (const [operation, client] of [
    [() => bridge.createFileAdapter(ftp,{password:'secret'}),'ftp'],
    [() => bridge.createFileAdapter(ssh,{password:'secret',hostFingerprint:'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}),'sftp'],
    [() => bridge.withSsh(ssh,async () => {},{password:'secret',hostFingerprint:'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}),'ssh'],
]) {
    await assert.rejects(operation,error => error instanceof ProfileExecutionError && error.code==='MISSING_HANDLER' &&
        error.message.includes('npm install @jalsoedesign/dockline-'+client+'-client'));
}
console.log('Packed bridge works without protocol clients; FTP/SFTP/SSH each report the missing installation.');
`);
    await run(['smoke.mjs']);
    await writeFile(path.join(directory, 'types.mts'), `
import {createDocklineBridge, type ExecutionOptions, type SshSession, type TrustChallenge} from '@jalsoedesign/portline-dockline';
import type {ConnectionProfile} from '@jalsoedesign/portline-abstract';
const bridge=createDocklineBridge();
function check(profile:ConnectionProfile, options:ExecutionOptions, challenge:TrustChallenge) {
    const config=bridge.toConfig(profile,options);
    const ssh=bridge.toSshConfig(profile,options);
    const files=bridge.withFiles(profile,remote=>remote.stat('file'),options);
    const commands=bridge.withSsh(profile,(session:SshSession)=>session.exec('whoami'),options);
    return [config,ssh,files,commands,challenge];
}
void check;
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
        '--types',
        'node',
        'types.mts',
    ]);
    console.log('Strict declarations compile with no optional protocol client packages. Evidence: ' + directory);
} finally {
    await registry.close();
}

void repository;
