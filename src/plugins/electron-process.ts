import { expect } from 'chai';

import { DocsParserPlugin, ExtendOptions } from '../DocsParserPlugin';
import {
  ClassDocumentationContainer,
  ElementDocumentationContainer,
  ModuleDocumentationContainer,
} from '../ParsedDocumentation';
import Token = require('markdown-it/lib/token');

/**
 * This plugin adds a "process" object to all parsed API files that indicate which process
 * the API is available in in Electron.
 */

export interface ElectronProcessPluginOptions {}

export interface ElectronProcessPluginAPIExtension {
  process: {
    main: boolean;
    renderer: boolean;
  };
}

export const findProcess = (tokens: Token[]): ElectronProcessPluginAPIExtension['process'] => {
  for (const tk of tokens) {
    if (tk.type === 'inline' && tk.content.indexOf('Process') === 0) {
      const ptks = tk.children.slice(2, tk.children.length - 1);
      const procs = { main: false, renderer: false };
      for (const ptk of ptks) {
        if (ptk.type !== 'text') continue;
        if (ptk.content === 'Main') procs.main = true;
        if (ptk.content === 'Renderer') procs.renderer = true;
      }
      return procs;
    }
  }
  return { main: true, renderer: true };
};

export default class ElectronProcessPlugin extends DocsParserPlugin<ElectronProcessPluginOptions> {
  extendContainer: undefined;

  extendAPI(
    api: ClassDocumentationContainer | ElementDocumentationContainer | ModuleDocumentationContainer,
    tokens: Token[],
  ): ElectronProcessPluginAPIExtension {
    return {
      process: findProcess(tokens),
    };
  }
}
