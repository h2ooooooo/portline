import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;

if (!npmCli) {
    throw new Error('Run this check using npm run check:packages');
}

const result = spawnSync(process.execPath, [
    npmCli,
    'pack',
    '--workspaces',
    '--dry-run',
    '--ignore-scripts',
    '--json',
], {cwd: repository, encoding: 'utf8', windowsHide: true});

if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Package inventory failed');
}

const packageResult = JSON.parse(result.stdout);
const packages = Array.isArray(packageResult) ? packageResult : Object.values(packageResult);
const workspacePackages = new Map(readdirSync(path.join(repository, 'packages')).map(directory => {
    const packageDirectory = path.join(repository, 'packages', directory);
    const manifest = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));

    return [manifest.name, {directory, packageDirectory, manifest}];
}));

assert.equal(packages.length, workspacePackages.size, 'All workspace packages must be inspected');

for (const packed of packages) {
    const workspace = workspacePackages.get(packed.name);

    assert.ok(workspace, `${packed.name}: unknown workspace`);

    const {directory: packageName, packageDirectory, manifest} = workspace;
    const files = packed.files.map((file) => file.path);

    for (const required of [
        'LICENSE',
        'README.md',
        'package.json',
        'dist/index.js',
        'dist/index.d.ts',
    ]) {
        assert.ok(files.includes(required), `${packed.name}: missing ${required}`);
    }

    const expectedDocklineDependency = {
        'connector-abstract': '@jalsoedesign/dockline-abstract',
        'connector-ftp': '@jalsoedesign/dockline-ftp-client',
        'connector-sftp': '@jalsoedesign/dockline-sftp-client',
    }[packageName];
    const docklineDependencies = Object.keys(manifest.dependencies ?? {}).filter(name => name.startsWith('@jalsoedesign/dockline-'));

    assert.deepEqual(docklineDependencies, expectedDocklineDependency ? [expectedDocklineDependency] : []);

    for (const version of Object.values(manifest.dependencies ?? {})) {
        assert.equal(version.startsWith('file:'), false, `${packed.name}: published dependencies must be portable`);
    }

    assert.equal(manifest.license, 'MIT');
    assert.ok(manifest.engines.node);
    assert.ok(manifest.exports['.'].types);

    for (const file of files) {
        const recipe = packageName === 'cli' && file === 'examples/transfer-recipes.ts';

        assert.ok(recipe || file.startsWith('dist/') || ['LICENSE', 'README.md', 'package.json'].includes(file), `${packed.name}: unexpected published file ${file}`);

        if (file.startsWith('dist/') && file.endsWith('.js')) {
            const source = file.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts');

            assert.ok(existsSync(path.join(packageDirectory, source)), `${packed.name}: stale output ${file}`);
        }
    }

    const require = createRequire(path.join(packageDirectory, 'package.json'));

    assert.ok(require.resolve(packed.name));
    console.log(`${packed.name}: ${files.length} intentional files, license and public entry verified`);
}
