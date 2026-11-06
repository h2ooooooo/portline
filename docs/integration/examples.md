# Example languages and setup

Part of [Build an integration](/integration/): shared APIs and infrastructure for adapter authors. For application usage, [choose a library](/libraries/).

Complete programs have four tabs: **TypeScript**, **JavaScript**, **MJS** and **CommonJS**. TypeScript is selected on a fresh page. Choosing another language also changes the matching run commands and keeps that choice while navigating the site.

## Prepare a directory

Create an empty directory and run `npm init -y`. Install the Portline packages listed on the example's page, then use the setup matching its language:

::: code-group

```sh [TypeScript]
npm pkg set type=module
npm install --save-dev typescript tsx @types/node
```

```sh [JavaScript]
npm pkg set type=module
```

```sh [MJS]
# The .mjs extension explicitly selects ES modules.
```

```sh [CommonJS]
# The .cjs extension explicitly selects CommonJS.
```

:::

Save the filename printed at the top of the selected code tab. Run the command from the same directory. Use `npm.cmd` and `npx.cmd` in PowerShell if script execution policy blocks the corresponding PowerShell wrappers.

## Reading the examples

Each complete program has matching source, command and captured output. Download links provide the same code without copying a page. The smaller recipes explicitly reuse variables from a linked complete example and are not separate programs.

In-memory examples do not need a server. Native adapter recipes identify settings files and their source/destination role; they require the named adapter packages and explicit native settings. They are separate from the synthetic examples.

## Types and module formats

Portline requires Node.js 22.22.2 or newer. All packages include declarations. Core, abstract and platform provide CommonJS-compatible exports; the CLI package is ESM. The CommonJS CLI example uses the supported Node runtime's synchronous ESM loading.

Type declarations in the [reference](/integration/reference/types) stay TypeScript-only. Repository fixture scripts keep their actual filenames in contributor commands.
