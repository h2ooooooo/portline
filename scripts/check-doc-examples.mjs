import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {javascript, commonJs, unformattedTechnicalText, terminalHtml} from './docs-example-utils.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const docs = path.join(repository, 'docs');
const manifest = JSON.parse(await readFile(path.join(docs, 'example-variants.json'), 'utf8'));
const require = createRequire(import.meta.url);
const tsx = pathToFileURL(require.resolve('tsx')).href;
const labels = ['TypeScript', 'JavaScript', 'MJS', 'CommonJS'];
const extensions = ['ts', 'js', 'mjs', 'cjs'];
const noFilename = code => code.replace(/^\/\/ [\w-]+\.(?:ts|js|mjs|cjs)\n/, '').trim();
const pages = [];
let groups = 0;
let programsFound = 0;

async function visit(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
        if (entry.name.startsWith('.') || ['node_modules', 'public'].includes(entry.name)) {
            continue;
        }

        const filename = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            await visit(filename);
        } else if (filename.endsWith('.md')) {
            pages.push(filename);
        }
    }
}

await visit(docs);

for (const filename of pages) {
    const relative = path.relative(docs, filename).replaceAll('\\', '/');
    const text = await readFile(filename, 'utf8');

    assert.deepEqual(unformattedTechnicalText(text), [], relative + ': unformatted technical text');

    assert.doesNotMatch(text, /your (?:own )?application|your computer/i, relative + ': terminology');
    assert.doesNotMatch(text, /--path\.|\.(?:mjs|cjs|js|ts)\.\//, relative + ': malformed command');
    assert.doesNotMatch(text, /Save this as `[^`]+\.mjs`/, relative + ': MJS-first setup');

    for (const match of text.matchAll(/::: code-group\n([\s\S]*?)\n:::/g)) {
        const blocks = [...match[1].matchAll(/```(\w+) \[([^\]]+)\]\n([\s\S]*?)```/g)];

        if (!blocks.some(block => labels.includes(block[2]))) {
            continue;
        }

        assert.deepEqual(blocks.map(block => block[2]), labels, relative + ': language order');
        groups++;

        if (blocks[0][1] === 'sh') {
            if (relative === 'integration/examples.md') {
                assert.ok(blocks[0][3].includes('npm pkg set type=module'), relative + ': TypeScript ESM setup');
            }

            continue;
        }

        const source = blocks[0][3].trim();
        const program = manifest.programs.find(item => item.page === relative && source.startsWith('// ' + item.name + '.ts\n'));
        const esm = javascript(source);
        const expected = [source, esm, esm, commonJs(noFilename(esm), Boolean(program))];

        for (const [index, block] of blocks.entries()) {
            const parsed = ts.createSourceFile('snippet.' + (index ? 'js' : 'ts'), block[3], ts.ScriptTarget.Latest, true);

            assert.equal(parsed.parseDiagnostics.length, 0, relative + ': syntax ' + block[2]);
            assert.equal(noFilename(block[3]), noFilename(expected[index]), relative + ': formatting ' + block[2]);

            if (!program) {
                continue;
            }

            const asset = program.name + '.' + extensions[index];

            assert.equal(noFilename(await readFile(path.join(docs, 'public/examples', asset), 'utf8')), noFilename(block[3]), asset + ': downloadable source differs');

            const command = (index ? 'node ' : 'npx tsx ') + asset + (program.args ? ' ' + program.args : '');

            assert.ok(text.includes(command), asset + ': matching run command');
        }

        if (program) {
            programsFound++;
        }
    }

    const outside = text.replace(/::: code-group\n[\s\S]*?\n:::/g, '');

    if (!['integration/reference/types.md'].includes(relative)) {
        assert.doesNotMatch(outside, /```(?:ts|js|javascript)\n/, relative + ': executable snippet lacks language tabs');
    }
}

assert.equal(programsFound, manifest.programs.length);
console.log('Audited ' + pages.length + ' pages and ' + groups + ' synchronized language groups.');

const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    types: ['node'],
    typeRoots: [path.join(repository, 'node_modules/@types')],
};
const typeFiles = manifest.assets.filter(asset => asset.filename.endsWith('.ts')).map(asset => path.join(docs, 'public/examples', asset.filename));
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(typeFiles, options));

assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCanonicalFileName: file => file, getCurrentDirectory: () => repository, getNewLine: () => '\n'}));
console.log(typeFiles.length + ' complete TypeScript programs: strict type checking PASS.');

async function run(filename, directory, args, environment, expectedCode = 0, expectedError = '') {
    const child = spawn(process.execPath, [...(filename.endsWith('.ts') ? ['--import', tsx] : []), filename, ...args], {
        cwd: directory,
        windowsHide: true,
        env: {...process.env, ...environment},
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => child.kill(), 30000);

    child.stdout.on('data', chunk => {
        output += chunk;
    });
    child.stderr.on('data', chunk => {
        errors += chunk;
    });

    try {
        const code = await new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', resolve);
        });

        assert.equal(code, expectedCode, filename + '\n' + output + errors);

        if (expectedError) {
            assert.equal(errors.replaceAll('\r\n', '\n').trim(), expectedError);
        }

        return output.replaceAll('\r\n', '\n').trim();
    } finally {
        clearTimeout(timer);
    }
}

const checkRoot = path.join(docs, '.local-dev/example-checks');

await mkdir(checkRoot, {recursive: true});
await writeFile(path.join(checkRoot, 'package.json'), JSON.stringify({private: true, type: 'module'}));

for (const asset of manifest.assets) {
    const program = manifest.programs.find(item => item.name === asset.name);
    const filename = path.join(checkRoot, asset.filename);
    const text = await readFile(path.join(docs, 'public/examples', asset.filename), 'utf8');

    await writeFile(filename, text);

    const actual = await run(filename, checkRoot, program.args ? program.args.split(' ') : [], {});

    assert.equal(actual, program.output.trim(), asset.filename + ': captured output differs');

    if (asset.name === 'profile-cli') {
        const page = await readFile(path.join(docs, 'integration/cli/commands.md'), 'utf8');

        for (const test of manifest.cliCases) {
            const result = await run(filename, checkRoot, test.args, {FORCE_COLOR: test.colored ? '1' : '0'}, test.code, test.stderr);
            const command = (asset.filename.endsWith('.ts') ? 'npx tsx ' : 'node ') + asset.filename + ' ' + test.args.join(' ');

            assert.ok(page.includes(command), command + ': documented command differs');

            if (test.colored) {
                const {stripVTControlCharacters} = await import('node:util');

                assert.equal(stripVTControlCharacters(result), test.stdout);
                assert.ok(result.includes(String.fromCharCode(27) + '['), 'Expected real CLI colours');
                assert.ok(page.includes(terminalHtml(result)), 'Rendered terminal capture differs');
            } else {
                assert.equal(result, test.stdout);
                assert.ok(page.includes(test.stderr || test.stdout), 'Captured command output differs');
            }
        }
    }

    console.log(asset.filename + ': runtime and output PASS');
}

console.log(manifest.assets.length + ' runnable example variants passed without native settings or network connections.');
