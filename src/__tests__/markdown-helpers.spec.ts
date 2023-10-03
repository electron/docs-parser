import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';

import {
  safelyJoinTokens,
  extractStringEnum,
  extractReturnType,
  rawTypeToTypeInformation,
  parseHeadingTags,
  findNextList,
  getTopLevelGenericType,
  findFirstHeading,
  consumeTypedKeysList,
  findProcess,
  slugifyHeading,
} from '../markdown-helpers';
import { DocumentationTag } from '../ParsedDocumentation';

const getTokens = (md: string) => {
  const markdown = new MarkdownIt();
  return markdown.parse(md, {});
};

describe('markdown-helpers', () => {
  describe('parseHeadingTags', () => {
    it('should return an empty array for null input', () => {
      expect(parseHeadingTags(null)).toEqual([]);
    });

    it('should return an empty array if there are no tags in the input', () => {
      expect(parseHeadingTags('String thing no tags')).toEqual([]);
    });

    it('should return a list of tags if there is one tag', () => {
      expect(parseHeadingTags(' _macOS_')).toEqual([DocumentationTag.OS_MACOS]);
    });

    it('should return a list of tags if there are multiple tags', () => {
      expect(parseHeadingTags(' _macOS_ _Windows_ _Experimental_')).toEqual([
        DocumentationTag.OS_MACOS,
        DocumentationTag.OS_WINDOWS,
        DocumentationTag.STABILITY_EXPERIMENTAL,
      ]);
    });

    it('should throw an error if there is a tag not on the whitelist', () => {
      expect(() => parseHeadingTags(' _Awesome_')).toThrowErrorMatchingInlineSnapshot(
        `"heading tags must be from the whitelist: ["macOS","mas","Windows","Linux","Experimental","Deprecated","Readonly"]: expected [ 'macOS', 'mas', 'Windows', …(4) ] to include 'Awesome'"`,
      );
    });
  });

  describe('safelyJoinTokens', () => {
    it('should join no tokens to an empty string', () => {
      expect(safelyJoinTokens([])).toBe('');
    });

    describe('snapshots', () => {
      const fixtureDir = path.resolve(__dirname, 'fixtures');
      for (const markdownFixture of fs.readdirSync(fixtureDir)) {
        if (!markdownFixture.endsWith('.md')) continue;

        it(`should be correct for ${path.basename(markdownFixture, '.md')}`, () => {
          const tokens = getTokens(
            fs.readFileSync(path.resolve(fixtureDir, markdownFixture), 'utf8'),
          );
          expect(safelyJoinTokens(tokens)).toMatchSnapshot();
        });
      }
    });

    describe('with code fence support', () => {
      it('should correctly insert the code fence', () => {
        const tokens = getTokens(
          `
> a

\`\`\`
wat

def fn():
  pass

# a
\`\`\`

> foo
`,
        );
        expect(safelyJoinTokens(tokens, { parseCodeFences: true })).toMatchSnapshot();
      });
    });
  });

  describe('extractStringEnum()', () => {
    it('should return null if no string enum is found', () => {
      expect(
        extractStringEnum('this is just nonsense that can be anything really or include magic'),
      ).toBe(null);
    });

    it('should return null if nothing remotely string enum~ish exists', () => {
      expect(extractStringEnum('wassup')).toBe(null);
    });

    describe('with backticks', () => {
      it('should extract an enum of the format "can be x"', () => {
        const values = extractStringEnum('Can be `x`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(1);
        expect(values[0].value).toBe('x');
      });

      it('should extract an enum of the format "can be x or y"', () => {
        const values = extractStringEnum('Can be `x` or `y`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
      });

      it('should extract an enum of the format "can be x, y or z"', () => {
        const values = extractStringEnum('Can be `x`, `y` or `z`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
        expect(values[2].value).toBe('z');
      });

      it('should extract an enum of the format "can be x, y, or z"', () => {
        const values = extractStringEnum('Can be `x`, `y`, or `z`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
        expect(values[2].value).toBe('z');
      });

      it('should extract an enum of the format "values include a', () => {
        const values = extractStringEnum('Values include `a`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(1);
        expect(values[0].value).toBe('a');
      });

      it('should extract an enum of the format "values include a and b', () => {
        const values = extractStringEnum('Values include `a` and `b`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('a');
        expect(values[1].value).toBe('b');
      });

      it('should extract an enum of the format "values include a, b and c', () => {
        const values = extractStringEnum('Values include `a`, `b` and `c`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('a');
        expect(values[1].value).toBe('b');
        expect(values[2].value).toBe('c');
      });

      it('should extract an enum with underscores in the values', () => {
        const values = extractStringEnum('Values includes `a`, `b_c` and `d`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('a');
        expect(values[1].value).toBe('b_c');
        expect(values[2].value).toBe('d');
      });

      it('should extract an enum with fullstops in the values', () => {
        const values = extractStringEnum('Values includes `a`, `b.c` and `d`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('a');
        expect(values[1].value).toBe('b.c');
        expect(values[2].value).toBe('d');
      });

      it('should extract an enum with colons in the values', () => {
        const values = extractStringEnum('Values includes `a`, `https:` and `d`')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('a');
        expect(values[1].value).toBe('https:');
        expect(values[2].value).toBe('d');
      });

      it('should extract an enum with numbers in the values', () => {
        const values = extractStringEnum('Can be `tls1`, `tls1.1`, `tls1.2` or `tls1.3`.')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(4);
        expect(values[0].value).toBe('tls1');
        expect(values[1].value).toBe('tls1.1');
        expect(values[2].value).toBe('tls1.2');
        expect(values[3].value).toBe('tls1.3');
      });
    });

    describe('with single quotes', () => {
      it('should extract an enum of the format "can be x"', () => {
        const values = extractStringEnum(`Can be 'x'`)!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(1);
        expect(values[0].value).toBe('x');
      });

      it('should extract an enum of the format "can be x or y"', () => {
        const values = extractStringEnum(`Can be 'x' or 'y'`)!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
      });

      it('should extract an enum of the format "can be x, y or z"', () => {
        const values = extractStringEnum(`Can be 'x', 'y' or 'z'`)!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
        expect(values[2].value).toBe('z');
      });

      it('should extract an enum of the format "can be x, y, or z"', () => {
        const values = extractStringEnum(`Can be 'x', 'y', or 'z'`)!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
        expect(values[2].value).toBe('z');
      });

      it('should extract an enum of the format "values include a', () => {
        const values = extractStringEnum(`Values include 'a'`)!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(1);
        expect(values[0].value).toBe('a');
      });

      it('should extract an enum of the format "values include a and b', () => {
        const values = extractStringEnum(`Values include 'a' and 'b'`)!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('a');
        expect(values[1].value).toBe('b');
      });

      it('should extract an enum of the format "values include a, b and c', () => {
        const values = extractStringEnum(`Values include 'a', 'b' and 'c'`)!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(3);
        expect(values[0].value).toBe('a');
        expect(values[1].value).toBe('b');
        expect(values[2].value).toBe('c');
      });
    });
  });

  describe('rawTypeToTypeInformation()', () => {
    it('should map a primitive types correctly', () => {
      expect(rawTypeToTypeInformation('Boolean', '', null)).toMatchSnapshot();
    });

    it('should map an unknown types correctly', () => {
      expect(rawTypeToTypeInformation('MyType', '', null)).toMatchSnapshot();
    });

    it('should map a Promise types correctly', () => {
      expect(rawTypeToTypeInformation('Promise<T>', '', null)).toMatchSnapshot();
    });

    it('should map a complex Promise types correctly', () => {
      expect(rawTypeToTypeInformation('Promise<T | A>', '', null)).toMatchSnapshot();
    });

    it('should map a nested Promise types correctly', () => {
      expect(rawTypeToTypeInformation('Promise<T | Promise<A>>', '', null)).toMatchSnapshot();
    });

    it('should map a nested complex Promise types correctly', () => {
      expect(rawTypeToTypeInformation('Promise<T | Promise<A[]>[]>', '', null)).toMatchSnapshot();
    });

    it('should map a nested complex Promise types correctly', () => {
      expect(rawTypeToTypeInformation('Promise<T | Promise<A[]>[]>', '', null)).toMatchSnapshot();
    });

    it('should map a nested Function types correctly', () => {
      expect(rawTypeToTypeInformation('Promise<T | Function<A[]>[]>', '', null)).toMatchSnapshot();
    });

    it('should map a wrapped collection type correctly', () => {
      expect(
        rawTypeToTypeInformation('Promise<(T | Function<A[]>)[]>', '', null),
      ).toMatchSnapshot();
    });

    it('should map a function return type correctly', () => {
      expect(rawTypeToTypeInformation('Function<R>', '', null)).toMatchSnapshot();
    });

    it('should map a function return type + param types correctly', () => {
      expect(rawTypeToTypeInformation('Function<P1, P2, R>', '', null)).toMatchSnapshot();
    });

    it('should map a function with complex return type + complex param types correctly', () => {
      expect(
        rawTypeToTypeInformation(
          'Function<P1<InnerP1, AnotherInnerP1[]>, P2<(InnerP2 | AnotherInnerP2<SuperDeepP2, EvenDeeperP2>)[]>, R<Foo>>',
          '',
          null,
        ),
      ).toMatchSnapshot();
    });

    it('should allow commas in object types', () => {
      expect(
        rawTypeToTypeInformation('Function<{a: string, b: string}>', '', null),
      ).toMatchSnapshot();
    });
  });

  describe('findNextList()', () => {
    it('should return null when no list is present in the tokens', () => {
      expect(findNextList(getTokens('ABC `123`'))).toEqual(null);
    });

    it('should return null when the end of the list is not present in the tokens', () => {
      const tokens = getTokens(' * 123');
      expect(findNextList(tokens.slice(0, tokens.length - 2))).toEqual(null);
    });

    it('should return the entire list when their is a list present in the blocks', () => {
      const list = findNextList(
        getTokens(`
what up

* 123
* 456

hey lol
    `),
      );
      expect(list).not.toEqual(null);
      expect(safelyJoinTokens(list!)).toMatchInlineSnapshot(`
                                                                        "* 123
                                                                        * 456"
                                                      `);
    });

    it('should return the entire list when their is a list present in the blocks with sublists', () => {
      const list = findNextList(
        getTokens(`
what up

* 123
  * deeper
  * and
    * again
* 456

hey lol
    `),
      );
      expect(list).not.toEqual(null);
      expect(safelyJoinTokens(list!)).toMatchInlineSnapshot(`
                                                                "* 123
                                                                  * deeper
                                                                  * and
                                                                    * again
                                                                * 456"
                                                `);
    });
  });

  describe('findFirstHeading()', () => {
    it('should throw if there is no heading', () => {
      expect(() => findFirstHeading(getTokens('`abc`'))).toThrowErrorMatchingInlineSnapshot(
        `"expected to find a heading token but couldn't: expected -1 to not equal -1"`,
      );
    });

    it('should throw if the heading is does not end', () => {
      const tokens = getTokens('# qqq');
      expect(() =>
        findFirstHeading(tokens.slice(0, tokens.length - 2)),
      ).toThrowErrorMatchingInlineSnapshot(
        `"expected [ Array(1) ] to have a length at least 2 but got 1"`,
      );
    });

    it('should return the heading string token for the first heading', () => {
      expect(
        safelyJoinTokens([
          findFirstHeading(
            getTokens(`
hey there

# abc

# def

foo`),
          ),
        ]),
      ).toMatchInlineSnapshot(`"abc"`);
    });
  });

  describe('extractReturnType()', () => {
    it('should handle simple return types with descriptions', () => {
      const intTokens = getTokens(`Returns \`Integer\` - The request id used for the request.`);
      const intRet = extractReturnType(intTokens);
      expect(intRet.parsedReturnType).toEqual({
        collection: false,
        type: 'Integer',
      });

      const stringTokens = getTokens(`Returns \`String\` - Returns the WebRTC IP Handling Policy.`);
      const stringRet = extractReturnType(stringTokens);
      expect(stringRet.parsedReturnType).toEqual({
        collection: false,
        possibleValues: null,
        type: 'String',
      });
    });

    it('should handle Promises with void inner types', () => {
      const promiseTokens = getTokens(
        `Returns \`Promise<void>\` - Indicates whether the snapshot has been created successfully.`,
      );
      const promiseRet = extractReturnType(promiseTokens);
      expect(promiseRet.parsedReturnType).toEqual({
        collection: false,
        innerTypes: [
          {
            collection: false,
            type: 'void',
          },
        ],
        type: 'Promise',
      });
    });

    it('should handle Promises with non-void inner types', () => {
      const promiseTokens = getTokens(
        `Returns \`Promise<Buffer>\` - Resolves with the generated PDF data.`,
      );
      const promiseRet = extractReturnType(promiseTokens);
      expect(promiseRet.parsedReturnType).toEqual({
        collection: false,
        innerTypes: [
          {
            collection: false,
            type: 'Buffer',
          },
        ],
        type: 'Promise',
      });
    });

    it('should handle custom return types', () => {
      const customTokens = getTokens(
        `Returns \`WebContents\` - A WebContents instance with the given ID.`,
      );
      const customRet = extractReturnType(customTokens);
      expect(customRet.parsedReturnType).toEqual({
        collection: false,
        type: 'WebContents',
      });
    });

    it('should handle return types with no descriptions', () => {
      const printerTokens = getTokens(`Returns [\`PrinterInfo[]\`](structures/printer-info.md)`);
      const printerRet = extractReturnType(printerTokens);
      expect(printerRet.parsedReturnType).toEqual({
        collection: true,
        type: 'PrinterInfo',
      });
    });
  });

  describe('getTopLevelGenericType()', () => {
    it('should return null if there is no generic in the type', () => {
      expect(getTopLevelGenericType('Foo')).toEqual(null);
    });

    it('should return null if something ends like a generic but does not start like one', () => {
      expect(getTopLevelGenericType('Foo>')).toEqual(null);
    });

    it('should extract the generic correctly', () => {
      expect(getTopLevelGenericType('Foo<T>')).toStrictEqual({
        genericType: 'T',
        outerType: 'Foo',
      });
    });

    it('should extract the generic correctly when the generic is itself generic', () => {
      expect(getTopLevelGenericType('Foo<T<B>>')).toStrictEqual({
        genericType: 'T<B>',
        outerType: 'Foo',
      });
    });
  });

  describe('consumeTypedKeysList()', () => {
    it('should return the keys property if the list is unconsumed', () => {
      const list = {
        consumed: false,
        keys: [],
      };
      expect(consumeTypedKeysList(list)).toStrictEqual(list.keys);
    });

    it('should throw an error if the list has already been consumed', () => {
      const list = {
        consumed: false,
        keys: [],
      };
      consumeTypedKeysList(list);
      expect(() => consumeTypedKeysList(list)).toThrowErrorMatchingInlineSnapshot(
        `"Attempted to consume a typed keys list that has already been consumed"`,
      );
    });
  });

  describe('findProcess()', () => {
    it('should be available in main process only', () => {
      var proc = findProcess(getTokens('Process: [Main](../glossary.md#main-process)'));
      expect(proc.main).toEqual(true);
      expect(proc.renderer).toEqual(false);
      expect(proc.utility).toEqual(false);
    });

    it('should be available in renderer process only', () => {
      var proc = findProcess(getTokens('Process: [Renderer](../glossary.md#renderer-process)'));
      expect(proc.main).toEqual(false);
      expect(proc.renderer).toEqual(true);
      expect(proc.utility).toEqual(false);
    });

    it('should be available in utility process only', () => {
      var proc = findProcess(getTokens('Process: [Utility](../glossary.md#utility-process)'));
      expect(proc.main).toEqual(false);
      expect(proc.renderer).toEqual(false);
      expect(proc.utility).toEqual(true);
    });

    it('should be available in main and renderer processes', () => {
      var proc = findProcess(
        getTokens(
          'Process: [Main](../glossary.md#main-process), [Renderer](../glossary.md#renderer-process)',
        ),
      );
      expect(proc.main).toEqual(true);
      expect(proc.renderer).toEqual(true);
      expect(proc.utility).toEqual(false);
    });

    it('should be available in main and renderer processes', () => {
      var proc = findProcess(
        getTokens(
          'Process: [Renderer](../glossary.md#renderer-process), [Main](../glossary.md#main-process)',
        ),
      );
      expect(proc.main).toEqual(true);
      expect(proc.renderer).toEqual(true);
      expect(proc.utility).toEqual(false);
    });

    it('should be available in main and utility processes', () => {
      var proc = findProcess(
        getTokens(
          'Process: [Main](../glossary.md#main-process), [Utility](../glossary.md#renderer-process)',
        ),
      );
      expect(proc.main).toEqual(true);
      expect(proc.renderer).toEqual(false);
      expect(proc.utility).toEqual(true);
    });

    it('should be available in all processes', () => {
      var proc = findProcess(getTokens(''));
      expect(proc.main).toEqual(true);
      expect(proc.renderer).toEqual(true);
      expect(proc.utility).toEqual(true);
    });

    it('should be available in all processes', () => {
      var proc = findProcess([]);
      expect(proc.main).toEqual(true);
      expect(proc.renderer).toEqual(true);
      expect(proc.utility).toEqual(true);
    });
  });

  describe('slugifyHeading', () => {
    it('should correctly slugify a complex heading', () => {
      const heading =
        '`systemPreferences.isHighContrastColorScheme()` _macOS_ _Windows_ _Deprecated_';
      const slugified = 'systempreferencesishighcontrastcolorscheme-macos-windows-deprecated';
      expect(slugifyHeading(heading)).toBe(slugified);
    });
  });
});
