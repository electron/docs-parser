# Electron Docs Parser

> Generate a structured JSON API file from Electrons free-form documentation

## Usage

```bash
yarn global add electron-docs-parser
cd ~/projects/path/to/electron/repo
electron-docs-parser --dir ./

# You now have ./api.json with the entire Electron API
```

## How it Works

We generate a markdown AST for every documentation file and search for
"Modules", "Classes" and "Structures".  We then use the well documented
and enforced [Electron docs style guide](https://github.com/electron/electron/blob/master/docs/styleguide.md) to pull the required information
about methods, properties and events from the generated AST.

For more information you should start your code dive in
[`DocsParser.ts`](src/DocsParser.ts) and then probably
[`block-parsers.ts`](src/block-parsers.ts).

## Typescript Definitions

The output of this module is used to generate Typescript definitions for
the Electron API.  This module itself is not used to generate those
definitions.

## License

MIT
