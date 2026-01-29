import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';

import {
  parseMethodBlocks,
  parsePropertyBlocks,
  parseEventBlocks,
  guessParametersFromSignature,
} from '../src/block-parsers.js';
import { DocumentationTag } from '../src/ParsedDocumentation.js';

describe('block parsers', () => {
  describe('parseMethodBlocks', () => {
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

  it('should parse a method with return type', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`test.getValue()\`

Returns \`string\` - The current value.
`;

    const allTokens = md.parse(contents, {});
    const methods = parseMethodBlocks(allTokens);

    expect(methods).toHaveLength(1);
    expect(methods[0].returns).toBeDefined();
    expect(methods[0].returns?.type).toBe('String');
  });

  it('should handle methods with no parameters', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`test.noParams()\`

Does something without parameters.
`;

    const allTokens = md.parse(contents, {});
    const methods = parseMethodBlocks(allTokens);

    expect(methods).toHaveLength(1);
    expect(methods[0].parameters).toHaveLength(0);
    expect(methods[0].signature).toBe('()');
  });

  it('should parse methods with generic types', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`test.getItems<T>()\`

Returns \`T[]\` - Array of items.
`;

    const allTokens = md.parse(contents, {});
    const methods = parseMethodBlocks(allTokens);

    expect(methods).toHaveLength(1);
    expect(methods[0].rawGenerics).toBe('<T>');
  });

  it('should handle platform tags', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`test.macOnly()\` _macOS_

macOS specific method.
`;

    const allTokens = md.parse(contents, {});
    const methods = parseMethodBlocks(allTokens);

    expect(methods).toHaveLength(1);
    expect(methods[0].additionalTags).toContain(DocumentationTag.OS_MACOS);
  });

  it('should return empty array for null tokens', () => {
    expect(parseMethodBlocks(null)).toEqual([]);
  });
});

describe('parsePropertyBlocks', () => {
  it('should parse a basic property', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`obj.name\`

A \`string\` representing the name.
`;

    const allTokens = md.parse(contents, {});
    const properties = parsePropertyBlocks(allTokens);

    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe('name');
    expect(properties[0].type).toBe('String');
    expect(properties[0].required).toBe(true);
  });

  it('should parse an optional property', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`obj.title\`

A \`string\` (optional) representing the title.
`;

    const allTokens = md.parse(contents, {});
    const properties = parsePropertyBlocks(allTokens);

    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe('title');
    expect(properties[0].required).toBe(false);
  });

  it('should parse a readonly property', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`obj.id\` _Readonly_

An \`Integer\` representing the unique identifier.
`;

    const allTokens = md.parse(contents, {});
    const properties = parsePropertyBlocks(allTokens);

    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe('id');
    expect(properties[0].additionalTags).toContain(DocumentationTag.AVAILABILITY_READONLY);
  });

  it('should parse properties with complex types', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`obj.bounds\`

A \`Rectangle | null\` representing the window bounds.
`;

    const allTokens = md.parse(contents, {});
    const properties = parsePropertyBlocks(allTokens);

    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe('bounds');
  });

  it('should parse multiple properties', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`obj.width\`

A \`Integer\` for the width.

# \`obj.height\`

A \`Integer\` for the height.
`;

    const allTokens = md.parse(contents, {});
    const properties = parsePropertyBlocks(allTokens);

    expect(properties).toHaveLength(2);
    expect(properties[0].name).toBe('width');
    expect(properties[1].name).toBe('height');
  });

  it('should handle platform-specific properties', async () => {
    const md = new MarkdownIt();
    const contents = `
# \`obj.macProperty\` _macOS_

A \`boolean\` available only on macOS.
`;

    const allTokens = md.parse(contents, {});
    const properties = parsePropertyBlocks(allTokens);

    expect(properties).toHaveLength(1);
    expect(properties[0].additionalTags).toContain(DocumentationTag.OS_MACOS);
  });

  it('should return empty array for null tokens', () => {
    expect(parsePropertyBlocks(null)).toEqual([]);
  });
});

describe('parseEventBlocks', () => {
  it('should parse a basic event', async () => {
    const md = new MarkdownIt();
    const contents = `
# Event: 'ready'

Emitted when the app is ready.
`;

    const allTokens = md.parse(contents, {});
    const events = parseEventBlocks(allTokens);

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('ready');
    expect(events[0].description).toContain('Emitted when the app is ready');
    expect(events[0].parameters).toHaveLength(0);
  });

  it('should parse an event with parameters', async () => {
    const md = new MarkdownIt();
    const contents = `
# Event: 'login'

Returns:

* \`event\` Event
* \`webContents\` WebContents
* \`authenticationResponseDetails\` Object
  * \`url\` string

Emitted when login is requested.
`;

    const allTokens = md.parse(contents, {});
    const events = parseEventBlocks(allTokens);

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('login');
    expect(events[0].parameters).toHaveLength(3);
    expect(events[0].parameters[0].name).toBe('event');
    expect(events[0].parameters[1].name).toBe('webContents');
    expect(events[0].parameters[2].name).toBe('authenticationResponseDetails');
  });

  it('should parse multiple events', async () => {
    const md = new MarkdownIt();
    const contents = `
# Event: 'focus'

Emitted when focused.

# Event: 'blur'

Emitted when blurred.
`;

    const allTokens = md.parse(contents, {});
    const events = parseEventBlocks(allTokens);

    expect(events).toHaveLength(2);
    expect(events[0].name).toBe('focus');
    expect(events[1].name).toBe('blur');
  });

  it('should handle platform-specific events', async () => {
    const md = new MarkdownIt();
    const contents = `
# Event: 'swipe' _macOS_

Returns:

* \`event\` Event
* \`direction\` string

Emitted on swipe gesture.
`;

    const allTokens = md.parse(contents, {});
    const events = parseEventBlocks(allTokens);

    expect(events).toHaveLength(1);
    expect(events[0].additionalTags).toContain(DocumentationTag.OS_MACOS);
  });

  it('should parse event with deprecated tag', async () => {
    const md = new MarkdownIt();
    const contents = `
# Event: 'old-event' _Deprecated_

This event is deprecated.
`;

    const allTokens = md.parse(contents, {});
    const events = parseEventBlocks(allTokens);

    expect(events).toHaveLength(1);
    expect(events[0].additionalTags).toContain(DocumentationTag.STABILITY_DEPRECATED);
  });

  it('should return empty array for null tokens', () => {
    expect(parseEventBlocks(null)).toEqual([]);
  });
});

describe('guessParametersFromSignature', () => {
  it('should parse single parameter', () => {
    const params = guessParametersFromSignature('(x)');
    expect(params).toEqual([{ name: 'x', optional: false }]);
  });

  it('should parse multiple parameters', () => {
    const params = guessParametersFromSignature('(x, y, z)');
    expect(params).toEqual([
      { name: 'x', optional: false },
      { name: 'y', optional: false },
      { name: 'z', optional: false },
    ]);
  });

  it('should parse optional parameters', () => {
    const params = guessParametersFromSignature('(x, [y])');
    expect(params).toEqual([
      { name: 'x', optional: false },
      { name: 'y', optional: true },
    ]);
  });

  it('should parse nested optional parameters', () => {
    const params = guessParametersFromSignature('(x, [y, [z]])');
    expect(params).toEqual([
      { name: 'x', optional: false },
      { name: 'y', optional: true },
      { name: 'z', optional: true },
    ]);
  });

  it('should handle spread parameters', () => {
    const params = guessParametersFromSignature('(...args)');
    expect(params).toEqual([{ name: '...args', optional: false }]);
  });

  it('should reject empty parameters due to regex restriction', () => {
    // The function's regex doesn't support empty parentheses by design
    expect(() => guessParametersFromSignature('()')).toThrow(/signature should be a bracket wrapped group/);
  });

  it('should handle parameters with numbers', () => {
    const params = guessParametersFromSignature('(x1, y2)');
    expect(params).toEqual([
      { name: 'x1', optional: false },
      { name: 'y2', optional: false },
    ]);
  });
});
});
