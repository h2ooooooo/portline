import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {assertGeneratedCatalog, renderCatalog, validateCatalog} from './ecosystem.mjs';

const catalog = JSON.parse(await readFile(new URL('../ecosystem.json', import.meta.url), 'utf8'));

test('catalog renders deterministically and all packages have stable links', () => {
    const output = renderCatalog(catalog);

    assert.deepEqual(output, renderCatalog({...catalog, entries: [...catalog.entries].reverse()}));

    for (const entry of catalog.entries) {
        for (const name of entry.packages) {
            assert.ok(output.markdown.includes('https://www.npmjs.com/package/' + name));
        }
    }
});

test('catalog rejects versions, duplicate packages and unsafe URLs', () => {
    const modified = () => structuredClone(catalog);
    const version = modified();

    version.entries[0].version = '1.0.0';
    assert.throws(() => validateCatalog(version));

    const duplicate = modified();

    duplicate.entries[1].packages.push(duplicate.entries[0].packages[0]);
    assert.throws(() => validateCatalog(duplicate));

    const unsafe = modified();

    unsafe.entries[0].documentation = 'javascript:alert(1)';
    assert.throws(() => validateCatalog(unsafe));
});

test('family directory leads with application API and CLI documentation', () => {
    const {markdown, libraries} = renderCatalog(catalog);

    for (const entry of catalog.entries.filter(item => item.family === 'portline' && item.applications.length)) {
        assert.ok(libraries.includes(entry.documentation + 'api/'));
        assert.ok(libraries.includes(entry.documentation + 'cli/'));
        assert.ok(markdown.indexOf('## ' + entry.name) < markdown.indexOf('# Related Dockline tools'));
    }

    assert.ok(!libraries.includes('portline-abstract'));
    assert.ok(libraries.includes('/integration/'));
});

test('generated catalog checks accept Windows line endings and reject content drift', () => {
    const output = renderCatalog(catalog);

    for (const expected of Object.values(output)) {
        assert.doesNotThrow(() => assertGeneratedCatalog(expected, expected));
        assert.doesNotThrow(() => assertGeneratedCatalog(expected.replaceAll('\n', '\r\n'), expected));
        assert.throws(() => assertGeneratedCatalog(expected + 'changed', expected));
        assert.throws(() => assertGeneratedCatalog(expected + '\n', expected));
    }
});
