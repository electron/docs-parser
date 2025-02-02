import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';

import { parseMethodBlocks } from '../src/block-parsers';

describe('block parsers', () => {
  it('should parse a method', async () => {
    const md = new MarkdownIt({ html: true });
    const contents = `
# \`test.foo(x)\`
* \`x\` Integer - x
`;

    const allTokens = md.parse(contents, {});

    expect(parseMethodBlocks(allTokens)).toEqual([
      {
        additionalTags: [],
        description: '',
        name: 'foo',
        parameters: [
          {
            collection: false,
            description: 'x',
            name: 'x',
            required: true,
            type: 'Integer',
          },
        ],
        rawGenerics: undefined,
        returns: null,
        signature: '(x)',
        urlFragment: '#testfoox',
      },
    ]);
  });

  it('should parse a method with optional parameters', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`test.foo([x])\`
* \`x\` Integer (optional) - x
`;

    const allTokens = md.parse(contents, {});

    expect(parseMethodBlocks(allTokens)).toEqual([
      {
        additionalTags: [],
        description: '',
        name: 'foo',
        parameters: [
          {
            collection: false,
            description: 'x',
            name: 'x',
            required: false,
            type: 'Integer',
          },
        ],
        rawGenerics: undefined,
        returns: null,
        signature: '([x])',
        urlFragment: '#testfoox',
      },
    ]);
  });

  it('should parse a method with a parameter that can be an object or an integer', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`test.foo([x])\`
* \`x\` Object | Integer (optional) - x
  * \`y\` Integer - y
`;

    const allTokens = md.parse(contents, {});

    expect(parseMethodBlocks(allTokens)).toEqual([
      {
        additionalTags: [],
        description: '',
        name: 'foo',
        parameters: [
          {
            collection: false,
            description: 'x',
            name: 'x',
            required: false,
            type: [
              {
                collection: false,
                properties: [
                  {
                    additionalTags: [],
                    collection: false,
                    description: 'y',
                    name: 'y',
                    required: true,
                    type: 'Integer',
                  },
                ],
                type: 'Object',
              },
              {
                collection: false,
                type: 'Integer',
              },
            ],
          },
        ],
        rawGenerics: undefined,
        returns: null,
        signature: '([x])',
        urlFragment: '#testfoox',
      },
    ]);
  });
});
