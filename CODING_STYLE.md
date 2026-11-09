# Coding style

Use vertical readability: separate logical steps with one blank line, keep related declarations together, use explicit guard blocks, and expand long conditions and lists. Keep imports compact. Optimize for scanning and debugging, not the fewest lines.

## Formatting contract

- Use four spaces for indentation, single quotes and semicolons. Double quotes are allowed when they avoid escaping an apostrophe.
- Keep opening braces on the same line. Put control-flow bodies on separate lines and always use braces.
- Put one blank line between setup and the next operation, between guard clauses, around control-flow blocks, and before a final return.
- Keep related adjacent declarations together. Preserve an intentional blank line between unrelated declaration groups.
- Do not insert empty lines immediately inside every block or between every expression. A short guard remains `if (...) {` followed directly by its indented return and closing brace.
- Expand long logical conditions across lines, with one logical operand per line, `&&` or `||` at the end of the previous line, and the closing condition parenthesis aligned with the statement.
- Expand arrays containing five or more elements to one element per line. Short arrays may stay on one line. Multiline arrays keep a trailing comma.
- Expand objects with four or more properties, and keep multiline object properties on separate lines. Small objects may stay compact. Keep small named imports compact; existing long import lists may span multiple lines.
- Keep named imports compact, for example `import {Readable} from 'node:stream';`. Preserve existing line endings.
- Use 120 columns as the working limit for ordinary code. Imports, comments, URLs, strings, templates and regular expressions are exempt so formatting does not rewrite their contents.

The five-element, four-property and 120-column limits make the approved example reproducible. Change those values in the preset if the preferred threshold changes.

## Commands

From the repository root, check authored JavaScript and TypeScript, apply available formatting fixes, and verify the local style rules:

~~~sh
npm run lint
npx eslint . --fix
npm run test:style
~~~

For a focused edit, target its actual package source:

~~~sh
npx eslint packages/portline-dockline/src/index.ts
npx eslint packages/portline-dockline/src/index.ts --fix
~~~

Use npm.cmd and npx.cmd in PowerShell when its wrappers do not forward arguments correctly. The default ESLint configuration covers package source, tests, contributor examples, scripts and VitePress configuration/theme TypeScript. Dependencies, generated output and generated downloadable documentation variants are excluded. Run npm run docs:examples:check to verify those variants against their page and TypeScript source. Editors can use eslint.config.mjs for fix-on-save.

## What the tools can decide

[ESLint Stylistic](https://eslint.style/rules) supplies the standard whitespace rules. Local whitespace-only rules separate members in expanded objects/interfaces and expand logical `if`, `while` and `do...while` conditions. It preserves parentheses and comments. Negated root expressions and `for` headers remain manual layout choices; the rule does not descend into callback bodies or logical function arguments. `eslint --fix` applies available fixes; remaining line-length or comment-sensitive diagnostics may need a deliberate edit.

ESLint recognizes statement boundaries, not the meaning of a logical step. When several transformations belong to one thought, keep them together. When responsibility changes, add a blank line. Do not force unrelated code into one block simply because a formatter accepts it.

Other preferences, such as descriptive names, useful intermediate variables, small functions, early validation and avoiding unnecessary abstraction, remain code-review guidance. Formatting is not permission to change runtime behavior.


## Stylesheets

Follow the existing VitePress theme's spacing and SCSS conventions. This repository does not define Stylelint or separate styles:check/styles:fix scripts. The documentation build verifies the theme's compilation; npm run lint checks authored JavaScript and TypeScript.
