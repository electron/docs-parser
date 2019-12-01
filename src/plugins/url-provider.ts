import { expect } from 'chai';

import { DocsParserPlugin, ExtendOptions } from '../DocsParserPlugin';
import { BaseDocumentationContainer } from '../ParsedDocumentation';

/**
 * This plugin adds "repoUrl" and "websiteURL" to each documention block so that users
 * can view the documentation that generated the block in either it's source form or on
 * your website
 */

export interface URLProviderOptions {
  // E.g.
  websiteDocsBaseURL: string;
  websiteDocsURLIncludesVersion?: boolean;
  // E.g. https://github.com/electron/electron/blob
  repoDocsBaseURL: string;
}

export interface URLProviderContainerExtension {
  websiteUrl: string;
  repoUrl: string;
}

export default class URLProviderPlugin extends DocsParserPlugin<URLProviderOptions> {
  private getURLInfo = (
    version: string,
    relativeDocsPath: string,
  ): URLProviderContainerExtension => {
    expect(
      this.options,
      'should provide all required config to URLProviderPlugin',
    ).to.have.property('websiteDocsBaseURL');
    expect(
      this.options,
      'should provide all required config to URLProviderPlugin',
    ).to.have.property('repoDocsBaseURL');
    return {
      websiteUrl: `${this.options.websiteDocsBaseURL}/${
        this.options.websiteDocsURLIncludesVersion ? `${version}/` : ''
      }${relativeDocsPath}`,
      repoUrl: `${this.options.repoDocsBaseURL}/v${version}/${relativeDocsPath}.md`,
    };
  };

  extendContainer(container: BaseDocumentationContainer, { relativeDocsPath }: ExtendOptions) {
    return this.getURLInfo(container.version, relativeDocsPath);
  }

  extendAPI: undefined;
}
