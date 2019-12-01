import {
  StructureDocumentationContainer,
  BaseDocumentationContainer,
  ClassDocumentationContainer,
  ElementDocumentationContainer,
  ModuleDocumentationContainer,
} from './ParsedDocumentation';
import Token = require('markdown-it/lib/token');

export interface ExtendOptions {
  relativeDocsPath: string;
}

export abstract class DocsParserPlugin<Options> {
  constructor(protected readonly options: Options) {}

  abstract extendContainer?(
    container: BaseDocumentationContainer,
    opts: ExtendOptions,
  ): object | void;

  abstract extendAPI?(
    api: ClassDocumentationContainer | ElementDocumentationContainer | ModuleDocumentationContainer,
    tokens: Token[],
  ): object | void;
}
