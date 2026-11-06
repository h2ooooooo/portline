import {stripTypeScriptTypes} from 'node:module';
import ts from 'typescript';

export function javascript(source) {
    const stripped = stripTypeScriptTypes(source, {mode: 'strip'});
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, stripped);
    let result = '';

    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
        let value = scanner.getTokenText();

        if (
            kind === ts.SyntaxKind.WhitespaceTrivia &&
            source.slice(scanner.getTokenPos(), scanner.getTextPos()) !== value &&
            !/(^|\n)[ \t]*$/.test(result)
        ) {
            const following = stripped.slice(scanner.getTextPos());

            value = /^[,;)]/.test(following) ? '' : ' ';
        }

        result += value;
    }

    result = result.replace(/[ \t]+$/gm, '');
    result = result.replace(/^import \{([^\n]+)\} from/gm, (_, names) => {
        const items = names.split(',').map(name => name.trim()).filter(Boolean);

        return 'import {' + items.join(', ') + '} from';
    });

    return result.trim();
}

export function commonJs(javascript, complete) {
    const parsed = ts.createSourceFile('example.js', javascript, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports = [];
    const edits = [];

    for (const statement of parsed.statements) {
        if (!ts.isImportDeclaration(statement)) {
            continue;
        }

        const name = statement.moduleSpecifier.text;
        const clause = statement.importClause;

        if (!clause) {
            imports.push("require('" + name + "');");
        } else {
            if (clause.name) {
                imports.push('const ' + clause.name.text + " = require('" + name + "');");
            }

            const bindings = clause.namedBindings;

            if (bindings && ts.isNamespaceImport(bindings)) {
                imports.push('const ' + bindings.name.text + " = require('" + name + "');");
            } else if (bindings) {
                const names = bindings.elements.map(element => element.propertyName ? element.propertyName.text + ': ' + element.name.text : element.name.text);

                if (names.length) {
                    imports.push('const {' + names.join(', ') + "} = require('" + name + "');");
                }
            }
        }

        edits.push([statement.getStart(parsed), statement.end]);
    }

    let body = javascript;

    for (const [start, end] of edits.reverse()) {
        body = body.slice(0, start) + body.slice(end);
    }

    body = body.replace(/\bexport (?=(async )?function|const |let |class )/g, '').trim();

    if (!complete) {
        return [...imports, '', body].join('\n').trim();
    }

    return imports.join('\n') + '\n\nasync function main() {\n' + body.split('\n').map(line => line ? '    ' + line : '').join('\n') + '\n}\n\nmain().catch(error => {\n    console.error(error);\n    process.exitCode = 1;\n});\n';
}

/** Catch bare package names, CLI flags and writer APIs outside code, links and captured output. */
export function unformattedTechnicalText(markdown) {
    const prose = markdown
        .replace(/^---\n[\s\S]*?\n---\n/, '')
        .replace(/^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$/gm, '')
        .replace(/<pre\b[\s\S]*?<\/pre>/g, '')
        .replace(/`+[^`\n]*`+/g, '')
        .replace(/https?:\/\/[^\s)<>]+/g, '')
        .replace(/\]\([^)]+\)/g, '')
        .replace(/<[^>\n]+>/g, '')
        .replace(/^#{1,6} .*$/gm, '');

    return [...prose.matchAll(/@jalsoedesign\/[A-Za-z0-9_-]+|(?<![\w-])--[a-z][\w-]*|\b(?:CredentialResolver|ProfileCatalog|ConnectionProfile|ProfileSource|SourceReference|NativeProfileWriter|NativeWritePreview|createProfileCli|createNormalizedCliSource|createProfileWriteCommands|planProfileSync|backupPaths)\b/g)].map(match => match[0]);
}

/** Render captured ANSI terminal output with the same foreground colours and emphasis. */
export function terminalHtml(output) {
    const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const colors = {
        30: '#000000',
        31: '#aa0000',
        32: '#00aa00',
        33: '#aa5500',
        34: '#0000aa',
        35: '#aa00aa',
        36: '#00aaaa',
        37: '#aaaaaa',
        90: '#555555',
        97: '#ffffff',
    };
    const sequence = new RegExp(String.fromCharCode(27) + '\\[([0-9;]*)m', 'g');
    let result = '';
    let cursor = 0;
    let color;
    let bold = false;

    function chunk(value) {
        const style = [color && 'color:' + (bold && color === '#aaaaaa' ? '#ffffff' : color), bold && 'font-weight:700'].filter(Boolean).join(';');

        return style ? '<span style="' + style + '">' + escape(value) + '</span>' : escape(value);
    }

    for (const match of output.matchAll(sequence)) {
        result += chunk(output.slice(cursor, match.index));
        cursor = match.index + match[0].length;

        for (const code of match[1].split(';').map(Number)) {
            if (code === 0) {
                color = undefined;
                bold = false;
            } else if (code === 1) {
                bold = true;
            } else if (code === 22) {
                bold = false;
            } else if (code === 39) {
                color = undefined;
            } else if (colors[code]) {
                color = colors[code];
            }
        }
    }

    return result + chunk(output.slice(cursor));
}
