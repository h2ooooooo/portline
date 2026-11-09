import {lstat, realpath, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const packageDirectory = await realpath(process.cwd());
const relativeDirectory = path.relative(repository, packageDirectory).split(path.sep).join('/');
const packages = [
    'portline-abstract',
    'portline-core',
    'portline-platform',
    'portline-cli',
    'portline-dockline',
];

if (!packages.some((name) => relativeDirectory === `packages/${name}`)) {
    throw new Error('Build must run inside a known package directory');
}

const outputDirectory = path.resolve(packageDirectory, 'dist');

if (path.dirname(outputDirectory) !== packageDirectory || path.basename(outputDirectory) !== 'dist') {
    throw new Error('Refusing to clean an unexpected output directory');
}

const outputStat = await lstat(outputDirectory).catch((error) => {
    if (error.code !== 'ENOENT') {
        throw error;
    }
});

if (outputStat?.isSymbolicLink()) {
    throw new Error('Refusing to clean a linked output directory');
}

await rm(outputDirectory, {recursive: true, force: true});

const require = createRequire(path.join(packageDirectory, 'package.json'));
const compiler = require.resolve('typescript/bin/tsc');
const result = spawnSync(process.execPath, [compiler], {cwd: packageDirectory, stdio: 'inherit'});

if (result.error) {
    throw result.error;
}

process.exitCode = result.status ?? 1;
