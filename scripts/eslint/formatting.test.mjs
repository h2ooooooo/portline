import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, URL} from 'node:url';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {ESLint} from 'eslint';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const parser = require('@typescript-eslint/parser');
const eslint = new ESLint({
    cwd: repository,
    overrideConfigFile: 'eslint.style.config.mjs',
    fix: true,
});

async function format(source) {
    const [result] = await eslint.lintText(source, {filePath: 'packages/portline-core/src/style-fixture.ts'});

    return {result, output: result.output ?? source};
}

function syntax(source) {
    return JSON.stringify(parser.parse(source), (key, value) => {
        if ([
            'loc',
            'range',
            'start',
            'end',
            'raw',
            'comments',
            'tokens',
        ].includes(key)) {
            return undefined;
        }

        return value;
    });
}

test('the approved example stays unchanged on repeated formatting', async () => {
    const source = await readFile(new URL('../../packages/portline-core/src/ProfileCatalog.ts', import.meta.url), 'utf8');
    const {result, output} = await format(source);

    assert.deepEqual(result.messages, []);
    assert.equal(output, source);
});

test('guard spacing, compact imports and related declarations match the approved contract', async () => {
    const source = 'import { Readable } from "node:stream";\nexport function check(value: unknown) {\n  const first = Readable;\n  const second = first;\n  if (!value) { return second; }\n  if (value === second) { return value; }\n  return first;\n}\n';
    const expected = 'import {Readable} from \'node:stream\';\n\nexport function check(value: unknown) {\n    const first = Readable;\n    const second = first;\n\n    if (!value) {\n        return second;\n    }\n\n    if (value === second) {\n        return value;\n    }\n\n    return first;\n}\n';
    const {result, output} = await format(source);

    assert.deepEqual(result.messages, []);
    assert.equal(output, expected);
    assert.equal(syntax(output), syntax(source));
});

test('five-element arrays expand while intentional declaration-group gaps survive', async () => {
    const source = 'export function values() {\n    const small = [1, 2];\n\n    const expanded = [1, 2, 3, 4, 5];\n    return {small, expanded};\n}\n';
    const {result, output} = await format(source);

    assert.deepEqual(result.messages, []);
    assert.match(output, /const small = \[1, 2\];\n\n {4}const expanded/u);
    assert.match(output, /\[\n {8}1,\n {8}2,\n {8}3,\n {8}4,\n {8}5,\n {4}\]/u);
    assert.equal(syntax(output), syntax(source));
});

test('a long chain formats exactly with aligned operands and trailing operators', async () => {
    const source = 'export function check(available: boolean, connected: boolean, authenticated: boolean, remembered: boolean) {\n  if (available && connected && authenticated && remembered && available === connected && authenticated === remembered) {\n    return true;\n  }\n  return false;\n}\n';
    const {result, output} = await format(source);

    assert.deepEqual(result.messages, []);
    assert.match(output, / {4}if \(\n {8}available &&\n {8}connected &&\n {8}authenticated &&\n {8}remembered &&\n {8}available === connected &&\n {8}authenticated === remembered\n {4}\) \{/u);
    assert.equal(syntax(output), syntax(source));
    assert.equal((await format(output)).output, output);
});

test('the complete preset retains unsafe commented gaps for a deliberate edit', async () => {
    const source = 'export function check(first: boolean, second: boolean) {\n    if (first // keep this comment with first\n        || second) {\n        return true;\n    }\n\n    return false;\n}\n';
    const {result, output} = await format(source);

    assert.match(output, /first \/\/ keep this comment with first\n\s*\|\| second/u);
    assert.ok(result.messages.some(message => message.ruleId === 'filezilla-style/multiline-conditions'));
    assert.equal(syntax(output), syntax(source));
});
