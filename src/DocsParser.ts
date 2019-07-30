import { expect } from 'chai';
import * as fs from 'fs-extra';
import MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token';
import * as path from 'path';
import toCamelCase = require('lodash.camelcase');

import {
  ParsedDocumentation,
  ParsedDocumentationResult,
  StructureDocumentationContainer,
  BaseDocumentationContainer,
  ModuleDocumentationContainer,
  ClassDocumentationContainer,
  ElementDocumentationContainer,
} from './ParsedDocumentation';
import {
  findNextList,
  convertListToTypedKeys,
  safelyJoinTokens,
  findContentAfterList,
  findContentInsideHeader,
  headingsAndContent,
  findConstructorHeader,
  consumeTypedKeysList,
} from './markdown-helpers';
import { WEBSITE_BASE_DOCS_URL, REPO_BASE_DOCS_URL } from './constants';
import { extendError } from './helpers';
import {
  parseMethodBlocks,
  _headingToMethodBlock,
  parsePropertyBlocks,
  parseEventBlocks,
} from './block-parsers';

export class DocsParser {
  constructor(
    private baseElectronDir: string,
    private electronVersion: string,
    private apiFiles: string[],
    private structureFiles: string[],
  ) {}

  private async parseBaseContainers(
    filePath: string,
    fileContents: string,
    tokens: Token[],
  ): Promise<
    {
      tokens: Token[];
      container: BaseDocumentationContainer;
      isClass: boolean;
    }[]
  > {
    const relativeDocsPath = path.relative(this.baseElectronDir, filePath).split('.')[0];
    const isStructure = relativeDocsPath.includes('structures');
    const headings = headingsAndContent(tokens);
    expect(headings).to.not.have.lengthOf(
      0,
      `File "${filePath}" does not have a top level heading, this is required`,
    );

    const parsedContainers: {
      tokens: Token[];
      container: BaseDocumentationContainer;
      isClass: boolean;
    }[] = [];

    for (const heading of headings) {
      const isTopLevelModuleHeading = heading.level === 1 && parsedContainers.length === 0;
      const isSecondLevelClassHeading =
        heading.level === 2 && heading.heading.startsWith('Class: ');
      const isClass = isSecondLevelClassHeading && !isTopLevelModuleHeading;
      if (isTopLevelModuleHeading && heading.heading.endsWith('(Draft)')) {
        continue;
      }
      if (isTopLevelModuleHeading || isSecondLevelClassHeading) {
        let name = heading.heading;
        if (isStructure) {
          expect(name).to.match(
            / Object(?: extends `.+?`)?$/,
            'Structure doc files top level heading should end with " Object"',
          );
          // Remove " Object"
          name = name.replace(/ Object(?: extends `.+?`)?$/, '');
        } else if (isClass) {
          // Remove "Class: "
          name = name.substr(7);
        }

        let description = '';
        if (isStructure) {
          description = safelyJoinTokens(findContentAfterList(tokens));
        } else {
          // TODO: Pull the top level Module / Class description
        }

        const extendsMatch = / Object extends `(.+?)`?$/.exec(heading.heading);
        parsedContainers.push({
          isClass,
          tokens: heading.content,
          container: {
            name,
            extends: extendsMatch ? extendsMatch[1] : undefined,
            description,
            slug: path.basename(filePath, '.md'),
            websiteUrl: `${WEBSITE_BASE_DOCS_URL}/${relativeDocsPath}`,
            repoUrl: `${REPO_BASE_DOCS_URL(this.electronVersion)}/${relativeDocsPath}.md`,
            version: this.electronVersion,
          },
        });
      }
    }

    return parsedContainers;
  }

  private async parseAPIFile(
    filePath: string,
  ): Promise<
    (ModuleDocumentationContainer | ClassDocumentationContainer | ElementDocumentationContainer)[]
  > {
    const parsed: (
      | ModuleDocumentationContainer
      | ClassDocumentationContainer
      | ElementDocumentationContainer)[] = [];
    const contents = await fs.readFile(filePath, 'utf8');
    const md = new MarkdownIt();

    const allTokens = md.parse(contents, {});

    const baseInfos = await this.parseBaseContainers(filePath, contents, allTokens);
    for (const { container, tokens, isClass } of baseInfos) {
      let isElement = false;
      if (container.name.endsWith('` Tag')) {
        expect(container.name).to.match(
          /<.+?>/g,
          'element documentation header should contain the HTML tag',
        );
        container.name = `${/<(.+?)>/g.exec(container.name)![1]}Tag`;
        container.extends = 'HTMLElement';
        isElement = true;
        expect(isClass).to.equal(
          false,
          'HTMLElement documentation should not be considered a class',
        );
      }
      if (isClass) {
        // Instance name will be taken either from an example in a method declaration or the camel
        // case version of the class name
        const levelFourHeader = headingsAndContent(tokens).find(h => h.level === 4);
        const instanceName = levelFourHeader
          ? (levelFourHeader.heading.split('`')[1] || '').split('.')[0] ||
            toCamelCase(container.name)
          : toCamelCase(container.name);

        // Try to get the constructor method
        const constructorMethod = _headingToMethodBlock(findConstructorHeader(tokens));

        // This is a class
        parsed.push({
          ...container,
          type: 'Class',
          // FIXME: We should read the process correctly
          process: {
            main: true,
            renderer: true,
          },
          constructorMethod: constructorMethod
            ? {
                signature: constructorMethod.signature,
                parameters: constructorMethod.parameters,
              }
            : null,
          // ### Static Methods
          staticMethods: parseMethodBlocks(findContentInsideHeader(tokens, 'Static Methods', 3)),
          // ### Static Properties
          staticProperties: parsePropertyBlocks(
            findContentInsideHeader(tokens, 'Static Properties', 3),
          ),
          // ### Instance Methods
          instanceMethods: parseMethodBlocks(
            findContentInsideHeader(tokens, 'Instance Methods', 3),
          ),
          // ### Instance Properties
          instanceProperties: parsePropertyBlocks(
            findContentInsideHeader(tokens, 'Instance Properties', 3),
          ),
          // ### Instance Events
          instanceEvents: parseEventBlocks(findContentInsideHeader(tokens, 'Instance Events', 3)),
          instanceName,
        });
      } else {
        // This is a module
        if (isElement) {
          parsed.push({
            ...container,
            type: 'Element',
            // FIXME: We should read the process correctly
            process: {
              main: true,
              renderer: true,
            },
            // ## Methods
            methods: parseMethodBlocks(findContentInsideHeader(tokens, 'Methods', 2)),
            // ## Properties
            properties: parsePropertyBlocks(findContentInsideHeader(tokens, 'Tag Attributes', 2)),
            // ## Events
            events: parseEventBlocks(findContentInsideHeader(tokens, 'DOM Events', 2)),
          });
        } else {
          parsed.push({
            ...container,
            type: 'Module',
            // FIXME: We should read the process correctly
            process: {
              main: true,
              renderer: true,
            },
            // ## Methods
            methods: parseMethodBlocks(findContentInsideHeader(tokens, 'Methods', 2)),
            // ## Properties
            properties: parsePropertyBlocks(findContentInsideHeader(tokens, 'Properties', 2)),
            // ## Events
            events: parseEventBlocks(findContentInsideHeader(tokens, 'Events', 2)),
          });
        }
      }
    }

    return parsed;
  }

  private async parseStructure(filePath: string): Promise<StructureDocumentationContainer> {
    const contents = await fs.readFile(filePath, 'utf8');
    const md = new MarkdownIt();

    const tokens = md.parse(contents, {});
    const baseInfos = await this.parseBaseContainers(filePath, contents, tokens);
    expect(baseInfos).to.have.lengthOf(
      1,
      'struct files should only contain one structure per file',
    );

    const list = findNextList(baseInfos[0].tokens);

    expect(list).to.not.equal(null, `Structure file ${filePath} has no property list`);

    return {
      type: 'Structure',
      ...baseInfos[0].container,
      properties: consumeTypedKeysList(convertListToTypedKeys(list!)).map(typedKey => ({
        name: typedKey.key,
        description: typedKey.description,
        required: typedKey.required,
        additionalTags: typedKey.additionalTags,
        ...typedKey.type,
      })),
    };
  }

  public async parse(): Promise<ParsedDocumentationResult> {
    const docs = new ParsedDocumentation();

    for (const apiFile of this.apiFiles) {
      try {
        docs.addModuleOrClassOrElement(...(await this.parseAPIFile(apiFile)));
      } catch (err) {
        throw extendError(`An error occurred while processing: "${apiFile}"`, err);
      }
    }

    for (const structureFile of this.structureFiles) {
      try {
        docs.addStructure(await this.parseStructure(structureFile));
      } catch (err) {
        throw extendError(`An error occurred while processing: "${structureFile}"`, err);
      }
    }

    return docs.getJSON();
  }
}
