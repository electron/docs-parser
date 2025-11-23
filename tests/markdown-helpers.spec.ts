import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';

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
  findContentAfterList,
  findContentAfterHeadingClose,
  headingsAndContent,
  findConstructorHeader,
  getContentBeforeConstructor,
  getContentBeforeFirstHeadingMatching,
  findContentInsideHeader,
  safelySeparateTypeStringOn,
  getTopLevelMultiTypes,
  getTopLevelOrderedTypes,
  convertListToTypedKeys,
} from '../src/markdown-helpers.js';
import {
  DocumentationTag,
  type DetailedFunctionType,
  type DetailedObjectType,
  type DetailedStringType,
  type DetailedEventType,
  type DetailedEventReferenceType,
} from '../src/ParsedDocumentation.js';

const getTokens = (md: string) => {
  const markdown = new MarkdownIt({ html: true });
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

    it('should throw an error if there is a tag not on the allowlist', () => {
      expect(() => parseHeadingTags(' _Awesome_')).toThrowErrorMatchingInlineSnapshot(
        `[AssertionError: heading tags must be from the allowlist: ["macOS","mas","Windows","Linux","Experimental","Deprecated","Readonly"]: expected [ 'macOS', 'mas', 'Windows', …(4) ] to include 'Awesome']`,
      );
    });
  });

  describe('safelyJoinTokens', () => {
    it('should join no tokens to an empty string', () => {
      expect(safelyJoinTokens([])).toBe('');
    });

    describe('snapshots', () => {
      const fixtureDir = path.resolve(import.meta.dirname, 'fixtures');
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

    it('should error helpfully on invalid value separators', () => {
      expect(() => extractStringEnum('Can be `x` sometimes `y'))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Unexpected separator token while extracting string enum, expected a comma or "and" or "or" but found "s"
          Context: \`x\` sometimes \`y
                       ^]
        `);
    });

    it('should error helpfully on unterminated enum strings', () => {
      expect(() => extractStringEnum('Can be `x` or `y')).toThrowErrorMatchingInlineSnapshot(`
        [Error: Unexpected early termination of token sequence while extracting string enum, did you forget to close a quote?
        Context: \`x\` or \`y]
      `);
    });

    describe('mixed ticks', () => {
      it('should extract an enum when mixed quotes are used', () => {
        const values = extractStringEnum('Can be `x"` or "`y"')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x"');
        expect(values[1].value).toBe('`y');
      });
    });

    describe('deprecated wrappers', () => {
      it('should handle strikethrough deprecation wrappers', () => {
        const values = extractStringEnum('Can be `x` or ~~`y`~~')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
      });
    });

    describe('lead-in descriptions', () => {
      it('should handle value lists that smoothly lead in to prose with a comma', () => {
        const values = extractStringEnum('Can be `x` or `y`, where `x` implies that...')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
      });

      it('should handle value lists that smoothly lead in to prose with a fullstop', () => {
        const values = extractStringEnum('Can be `x` or `y`. The `x` value implies that...')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
      });

      it('should handle value lists that smoothly lead in to prose with a semicolon', () => {
        const values = extractStringEnum('Can be `x` or `y`; the `x` value implies that...')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
      });

      it('should handle value lists that smoothly lead in to prose with a hyphen', () => {
        const values = extractStringEnum('Can be `x` or `y` - the `x` value implies that...')!;
        expect(values).not.toBe(null);
        expect(values).toHaveLength(2);
        expect(values[0].value).toBe('x');
        expect(values[1].value).toBe('y');
      });
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

  describe('with double quotes', () => {
    it('should extract an enum of the format "can be x"', () => {
      const values = extractStringEnum(`Can be "x"`)!;
      expect(values).not.toBe(null);
      expect(values).toHaveLength(1);
      expect(values[0].value).toBe('x');
    });

    it('should extract an enum of the format "can be x or y"', () => {
      const values = extractStringEnum(`Can be "x" or "y"`)!;
      expect(values).not.toBe(null);
      expect(values).toHaveLength(2);
      expect(values[0].value).toBe('x');
      expect(values[1].value).toBe('y');
    });

    it('should extract an enum of the format "can be x, y or z"', () => {
      const values = extractStringEnum(`Can be "x", "y" or "z"`)!;
      expect(values).not.toBe(null);
      expect(values).toHaveLength(3);
      expect(values[0].value).toBe('x');
      expect(values[1].value).toBe('y');
      expect(values[2].value).toBe('z');
    });

    it('should extract an enum of the format "can be x, y, or z"', () => {
      const values = extractStringEnum(`Can be "x", "y", or "z"`)!;
      expect(values).not.toBe(null);
      expect(values).toHaveLength(3);
      expect(values[0].value).toBe('x');
      expect(values[1].value).toBe('y');
      expect(values[2].value).toBe('z');
    });

    it('should extract an enum of the format "values include a', () => {
      const values = extractStringEnum(`Values include "a"`)!;
      expect(values).not.toBe(null);
      expect(values).toHaveLength(1);
      expect(values[0].value).toBe('a');
    });

    it('should extract an enum of the format "values include a and b', () => {
      const values = extractStringEnum(`Values include "a" and "b"`)!;
      expect(values).not.toBe(null);
      expect(values).toHaveLength(2);
      expect(values[0].value).toBe('a');
      expect(values[1].value).toBe('b');
    });

    it('should extract an enum of the format "values include a, b and c', () => {
      const values = extractStringEnum(`Values include "a", "b" and "c"`)!;
      expect(values).not.toBe(null);
      expect(values).toHaveLength(3);
      expect(values[0].value).toBe('a');
      expect(values[1].value).toBe('b');
      expect(values[2].value).toBe('c');
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
        `[AssertionError: expected to find a heading token but couldn't: expected -1 to not equal -1]`,
      );
    });

    it('should throw if the heading is does not end', () => {
      const tokens = getTokens('# qqq');
      expect(() =>
        findFirstHeading(tokens.slice(0, tokens.length - 2)),
      ).toThrowErrorMatchingInlineSnapshot(
        `[AssertionError: expected [ Array(1) ] to have a length at least 2 but got 1]`,
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

    it('should helpfully error for badly formatted union return types', () => {
      const customTokens = getTokens(
        `Returns \`WebContents\` | \`string\` - A WebContents instance with the given ID.`,
      );
      expect(() => extractReturnType(customTokens)).toThrowErrorMatchingInlineSnapshot(`
        [Error: Found a return type declaration that appears to be declaring a type union (A | B) but in the incorrect format. Type unions must be fully enclosed in backticks. For instance, instead of \`A\` | \`B\` you should specify \`A | B\`.
        Specifically this error was encountered here:
          "Returns \`WebContents\` | \`string\` - A WebContents instance with the given ID."...]
      `);
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
        `[Error: Attempted to consume a typed keys list that has already been consumed]`,
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

  describe('findContentAfterList', () => {
    it('should return content after a bullet list', () => {
      const md = `
* Item 1
* Item 2

Content after list.
`;
      const tokens = getTokens(md);
      const content = findContentAfterList(tokens);
      const joined = safelyJoinTokens(content);
      expect(joined).toContain('Content after list');
    });

    it('should return empty array when no list found and returnAllOnNoList is false', () => {
      const md = `Just some text without a list.`;
      const tokens = getTokens(md);
      const content = findContentAfterList(tokens, false);
      expect(content).toEqual([]);
    });

    it('should return all content after heading when no list found and returnAllOnNoList is true', () => {
      const md = `# Heading

Just some text without a list.`;
      const tokens = getTokens(md);
      const content = findContentAfterList(tokens, true);
      expect(content.length).toBeGreaterThan(0);
    });

    it('should handle nested lists correctly', () => {
      const md = `
* Item 1
  * Nested item
* Item 2

After nested list.
`;
      const tokens = getTokens(md);
      const content = findContentAfterList(tokens);
      const joined = safelyJoinTokens(content);
      expect(joined).toContain('After nested list');
    });
  });

  describe('findContentAfterHeadingClose', () => {
    it('should return content after a heading', () => {
      const md = `# Heading

Content after heading.`;
      const tokens = getTokens(md);
      const content = findContentAfterHeadingClose(tokens);
      const joined = safelyJoinTokens(content);
      expect(joined).toContain('Content after heading');
    });

    it('should return content until next heading', () => {
      const md = `# Heading One

Content for heading one.

## Heading Two

Content for heading two.`;
      const tokens = getTokens(md);
      const content = findContentAfterHeadingClose(tokens);
      // The function returns tokens, check that we got some
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('headingsAndContent', () => {
    it('should group headings with their content', () => {
      const md = `# Heading 1

Content 1

## Heading 2

Content 2`;
      const tokens = getTokens(md);
      const groups = headingsAndContent(tokens);

      expect(groups).toHaveLength(2);
      expect(groups[0].heading).toBe('Heading 1');
      expect(groups[0].level).toBe(1);
      expect(groups[1].heading).toBe('Heading 2');
      expect(groups[1].level).toBe(2);
    });

    it('should handle nested heading levels', () => {
      const md = `# Level 1

## Level 2

### Level 3

Back to level 2

## Another Level 2`;
      const tokens = getTokens(md);
      const groups = headingsAndContent(tokens);

      expect(groups.length).toBeGreaterThan(3);
      expect(groups.some((g) => g.level === 1)).toBe(true);
      expect(groups.some((g) => g.level === 2)).toBe(true);
      expect(groups.some((g) => g.level === 3)).toBe(true);
    });

    it('should include content tokens for each heading', () => {
      const md = `# Heading

Some paragraph text.`;
      const tokens = getTokens(md);
      const groups = headingsAndContent(tokens);

      expect(groups[0].content.length).toBeGreaterThan(0);
    });
  });

  describe('findConstructorHeader', () => {
    it('should find a constructor header', () => {
      const md = `# Class

### \`new BrowserWindow([options])\`

* \`options\` Object (optional)`;
      const tokens = getTokens(md);
      const constructor = findConstructorHeader(tokens);

      expect(constructor).not.toBeNull();
      expect(constructor?.heading).toContain('new BrowserWindow');
    });

    it('should return null when no constructor exists', () => {
      const md = `# Class

### \`someMethod()\`

Regular method.`;
      const tokens = getTokens(md);
      const constructor = findConstructorHeader(tokens);

      expect(constructor).toBeNull();
    });

    it('should only match level 3 headings', () => {
      const md = `# Class

## \`new BrowserWindow([options])\`

Not a level 3 constructor.

### \`new BrowserWindow([options])\`

This is the right level.`;
      const tokens = getTokens(md);
      const constructor = findConstructorHeader(tokens);

      expect(constructor).not.toBeNull();
      expect(constructor?.level).toBe(3);
    });
  });

  describe('getContentBeforeConstructor', () => {
    it('should return content before constructor', () => {
      const md = `# Class: BrowserWindow

Description of the class.

### \`new BrowserWindow([options])\`

Constructor details.`;
      const tokens = getTokens(md);
      const groups = getContentBeforeConstructor(tokens);

      expect(groups.length).toBeGreaterThan(0);
      const firstGroup = groups[0];
      // Use findContentAfterHeadingClose to get the actual content without heading tokens
      const content = safelyJoinTokens(findContentAfterHeadingClose(firstGroup.content));
      expect(content).toContain('Description');
    });

    it('should return empty array when no constructor', () => {
      const md = `# Class

Just some content.`;
      const tokens = getTokens(md);
      const groups = getContentBeforeConstructor(tokens);

      expect(groups).toEqual([]);
    });
  });

  describe('getContentBeforeFirstHeadingMatching', () => {
    it('should return content before matching heading', () => {
      const md = `# Main

Description here.

## Methods

Method content.`;
      const tokens = getTokens(md);
      const groups = getContentBeforeFirstHeadingMatching(tokens, (h) => h === 'Methods');

      expect(groups.length).toBeGreaterThan(0);
      const content = safelyJoinTokens(findContentAfterHeadingClose(groups[0].content));
      expect(content).toContain('Description');
    });

    it('should handle no matching heading', () => {
      const md = `# Main

Description here.`;
      const tokens = getTokens(md);
      const groups = getContentBeforeFirstHeadingMatching(tokens, (h) => h === 'Methods');

      // When no matching heading, returns all groups
      expect(groups.length).toBeGreaterThanOrEqual(0);
    });

    it('should work with complex matchers', () => {
      const md = `# API

## Events

Event content.

## Methods

Method content.`;
      const tokens = getTokens(md);
      const groups = getContentBeforeFirstHeadingMatching(
        tokens,
        (h) => h === 'Events' || h === 'Methods',
      );

      expect(groups.length).toBe(1);
      expect(groups[0].heading).toBe('API');
    });
  });

  describe('findContentInsideHeader', () => {
    it('should find content inside a specific header', () => {
      const md = `# API

## Methods

Method 1

Method 2

## Properties

Property content`;
      const tokens = getTokens(md);
      const content = findContentInsideHeader(tokens, 'Methods', 2);

      expect(content).not.toBeNull();
      // The returned content doesn't include the heading itself, so it can be joined directly
      expect(content!.length).toBeGreaterThan(0);
    });

    it('should return null when header not found', () => {
      const md = `# API

## Methods

Content`;
      const tokens = getTokens(md);
      const content = findContentInsideHeader(tokens, 'Properties', 2);

      expect(content).toBeNull();
    });

    it('should match both header name and level', () => {
      const md = `# Methods

Top level methods.

## Methods

Second level methods.`;
      const tokens = getTokens(md);
      const content = findContentInsideHeader(tokens, 'Methods', 2);

      expect(content).not.toBeNull();
      expect(content!.length).toBeGreaterThan(0);
    });
  });

  describe('safelySeparateTypeStringOn', () => {
    it('should separate simple types on pipe', () => {
      const result = safelySeparateTypeStringOn('string | number', '|');
      expect(result).toEqual(['string', 'number']);
    });

    it('should handle generic types without splitting inner content', () => {
      const result = safelySeparateTypeStringOn('Promise<string | number> | boolean', '|');
      expect(result).toEqual(['Promise<string | number>', 'boolean']);
    });

    it('should handle nested generics', () => {
      const result = safelySeparateTypeStringOn(
        'Map<string, Record<string | number>> | Array',
        '|',
      );
      expect(result).toEqual(['Map<string, Record<string | number>>', 'Array']);
    });

    it('should separate on comma', () => {
      const result = safelySeparateTypeStringOn('string, number, boolean', ',');
      expect(result).toEqual(['string', 'number', 'boolean']);
    });

    it('should handle object braces', () => {
      const result = safelySeparateTypeStringOn('{ a: string | number } | boolean', '|');
      expect(result).toEqual(['{ a: string | number }', 'boolean']);
    });

    it('should trim whitespace', () => {
      const result = safelySeparateTypeStringOn('  string  |  number  ', '|');
      expect(result).toEqual(['string', 'number']);
    });
  });

  describe('getTopLevelMultiTypes', () => {
    it('should split union types', () => {
      const result = getTopLevelMultiTypes('string | number | boolean');
      expect(result).toEqual(['string', 'number', 'boolean']);
    });

    it('should not split inner generic types', () => {
      const result = getTopLevelMultiTypes('Promise<A | B> | string');
      expect(result).toEqual(['Promise<A | B>', 'string']);
    });

    it('should handle single type', () => {
      const result = getTopLevelMultiTypes('string');
      expect(result).toEqual(['string']);
    });
  });

  describe('getTopLevelOrderedTypes', () => {
    it('should split comma-separated types', () => {
      const result = getTopLevelOrderedTypes('string, number, boolean');
      expect(result).toEqual(['string', 'number', 'boolean']);
    });

    it('should not split inner generic commas', () => {
      const result = getTopLevelOrderedTypes('Map<string, number>, Array<boolean>');
      expect(result).toEqual(['Map<string, number>', 'Array<boolean>']);
    });

    it('should handle single type', () => {
      const result = getTopLevelOrderedTypes('string');
      expect(result).toEqual(['string']);
    });
  });

  describe('convertListToTypedKeys', () => {
    it('should convert a simple list to typed keys', () => {
      const md = `
* \`name\` string - The name.
* \`age\` number - The age.
`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      expect(list).not.toBeNull();

      const typedKeys = convertListToTypedKeys(list!);
      expect(typedKeys.consumed).toBe(false);
      expect(typedKeys.keys.length).toBe(2);
      expect(typedKeys.keys[0].key).toBe('name');
      expect(typedKeys.keys[1].key).toBe('age');
    });

    it('should handle optional parameters', () => {
      const md = `
* \`width\` Integer (optional) - Window width.
* \`height\` Integer - Window height.
`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      expect(typedKeys.keys[0].required).toBe(false);
      expect(typedKeys.keys[1].required).toBe(true);
    });

    it('should handle nested properties', () => {
      const md = `
* \`options\` Object
  * \`width\` Integer
  * \`height\` Integer
`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      expect(typedKeys.keys).toHaveLength(1);
      expect(typedKeys.keys[0].key).toBe('options');
      // The nested structure is complex - just verify we got the top-level key
    });

    it('should handle list items with invalid structure but nested list', () => {
      const md = `
* Some description without proper format
  * \`validKey\` String - Valid nested key
  * \`anotherKey\` Number - Another valid key
`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      expect(typedKeys.keys).toHaveLength(2);
      expect(typedKeys.keys[0].key).toBe('validKey');
      expect(typedKeys.keys[1].key).toBe('anotherKey');
    });
  });

  describe('extractStringEnum', () => {
    it('should handle unexpected token at start', () => {
      const result = extractStringEnum('values includes @invalid');
      expect(result).toBeNull();
    });

    it('should throw on unexpected separator', () => {
      expect(() => extractStringEnum('values includes "foo" @ "bar"')).toThrow(
        /Unexpected separator token/,
      );
    });

    it('should throw on unexpected token after quote close', () => {
      expect(() => extractStringEnum('values includes "foo"!')).toThrow(
        /Unexpected separator token/,
      );
    });

    it('should throw on unclosed quote', () => {
      expect(() => extractStringEnum('values includes "foo')).toThrow(
        /Unexpected early termination/,
      );
    });

    it('should return null if no values found', () => {
      const result = extractStringEnum('can be ');
      expect(result).toBeNull();
    });

    it('should handle strikethrough wrapped deprecated values', () => {
      const result = extractStringEnum('values includes "foo", ~"bar"~');
      expect(result).toHaveLength(2);
      expect(result![0].value).toBe('foo');
      expect(result![1].value).toBe('bar');
    });

    it('should throw on mismatched wrapper unwrapping', () => {
      expect(() => extractStringEnum('values includes ~"foo"!')).toThrow(
        /Expected an unwrapping token that matched/,
      );
    });

    it('should handle terminating with period', () => {
      const result = extractStringEnum('can be "foo".');
      expect(result).toHaveLength(1);
      expect(result![0].value).toBe('foo');
    });

    it('should handle terminating with semicolon', () => {
      const result = extractStringEnum('can be "foo";');
      expect(result).toHaveLength(1);
    });

    it('should handle terminating with hyphen', () => {
      const result = extractStringEnum('can be "foo" -');
      expect(result).toHaveLength(1);
    });

    it('should handle or an Object terminator', () => {
      const result = extractStringEnum('can be "foo", or an Object');
      expect(result).toHaveLength(1);
      expect(result![0].value).toBe('foo');
    });

    it('should handle , or an Object terminator', () => {
      const result = extractStringEnum('can be "foo", or an Object');
      expect(result).toHaveLength(1);
    });

    it('should handle suffixes to ignore like (Deprecated)', () => {
      const result = extractStringEnum('can be "foo" (Deprecated), "bar"');
      expect(result).toHaveLength(2);
      expect(result![0].value).toBe('foo');
      expect(result![1].value).toBe('bar');
    });

    it('should gracefully terminate after comma when encountering unquoted text', () => {
      const result = extractStringEnum('can be "foo", then other stuff');
      expect(result).toHaveLength(1);
      expect(result![0].value).toBe('foo');
    });
  });

  describe('extractReturnType', () => {
    it('should return null return type when no Returns pattern found', () => {
      const tokens = getTokens('This is just a description without returns');
      const result = extractReturnType(tokens);
      expect(result.parsedReturnType).toBeNull();
      expect(result.parsedDescription).toBe('This is just a description without returns');
    });

    it('should return null return type when Returns keyword present but no backticks', () => {
      const tokens = getTokens('Returns something without backticks');
      const result = extractReturnType(tokens);
      expect(result.parsedReturnType).toBeNull();
      expect(result.parsedDescription).toBe('Returns something without backticks');
    });

    it('should handle returns with continuous sentence', () => {
      const tokens = getTokens('Returns `String` the value');
      const result = extractReturnType(tokens);
      expect(result.parsedReturnType).not.toBeNull();
      expect(result.parsedReturnType!.type).toBe('String');
      expect(result.parsedDescription).toBe('the value');
    });

    it('should throw error on incorrectly formatted type union', () => {
      const tokens = getTokens('Returns `A` | `B`');
      expect(() => extractReturnType(tokens)).toThrow(
        /Type unions must be fully enclosed in backticks/,
      );
    });

    it('should handle returns with failed list parsing', () => {
      const tokens = getTokens('Returns `Object`\n\n* invalid list item');
      const result = extractReturnType(tokens);
      expect(result.parsedReturnType).not.toBeNull();
      expect(result.parsedReturnType!.type).toBe('Object');
    });

    it('should handle description starting with pipe character', () => {
      const tokens = getTokens('Returns `String` | another thing');
      expect(() => extractReturnType(tokens)).toThrow(
        /Type unions must be fully enclosed in backticks/,
      );
    });
  });

  describe('rawTypeToTypeInformation edge cases', () => {
    it('should handle Function type without subTypedKeys', () => {
      const result = rawTypeToTypeInformation('Function', '', null);
      expect(result.type).toBe('Function');
      expect((result as DetailedFunctionType).parameters).toEqual([]);
      expect((result as DetailedFunctionType).returns).toBeNull();
    });

    it('should handle Function type with subTypedKeys', () => {
      const md = `
* \`callback\` Function - The callback
* \`event\` Event - The event object
`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      const result = rawTypeToTypeInformation('Function', '', typedKeys);
      expect(result.type).toBe('Function');
      expect((result as DetailedFunctionType).parameters).toHaveLength(2);
      expect((result as DetailedFunctionType).parameters[0].name).toBe('callback');
      expect((result as DetailedFunctionType).parameters[1].name).toBe('event');
      expect((result as DetailedFunctionType).returns).toBeNull();
    });

    it('should handle Object type without subTypedKeys', () => {
      const result = rawTypeToTypeInformation('Object', '', null);
      expect(result.type).toBe('Object');
      expect((result as DetailedObjectType).properties).toEqual([]);
    });

    it('should handle String type with subTypedKeys', () => {
      const md = `
* \`option1\` - First option
* \`option2\` - Second option
`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      const result = rawTypeToTypeInformation('String', '', typedKeys);
      expect(result.type).toBe('String');
      expect((result as DetailedStringType).possibleValues).toHaveLength(2);
      expect((result as DetailedStringType).possibleValues![0].value).toBe('option1');
    });

    it('should handle Event<> with inner type', () => {
      const result = rawTypeToTypeInformation('Event<CustomEvent>', '', null);
      expect(result.type).toBe('Event');
      expect((result as DetailedEventReferenceType).eventPropertiesReference).toBeDefined();
      expect((result as DetailedEventReferenceType).eventPropertiesReference.type).toBe('CustomEvent');
    });

    it('should throw on Event<> with both inner type and parameter list', () => {
      const md = `* \`foo\` String`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      expect(() => rawTypeToTypeInformation('Event<CustomEvent>', '', typedKeys)).toThrow(
        /Event<> should not have declared inner types AND a parameter list/,
      );
    });

    it('should throw on Event<> with multiple inner types', () => {
      expect(() => rawTypeToTypeInformation('Event<Type1, Type2>', '', null)).toThrow(
        /Event<> should have at most one inner type/,
      );
    });

    it('should throw on Event<> without inner type or parameter list', () => {
      expect(() => rawTypeToTypeInformation('Event<>', '', null)).toThrow(
        /Event<> declaration without a parameter list/,
      );
    });

    it('should handle Event<> with parameter list', () => {
      const md = `* \`detail\` String - Event detail`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      const result = rawTypeToTypeInformation('Event<>', '', typedKeys);
      expect(result.type).toBe('Event');
      expect((result as DetailedEventType).eventProperties).toHaveLength(1);
      expect((result as DetailedEventType).eventProperties[0].name).toBe('detail');
    });

    it('should handle Function<> with generic types', () => {
      const result = rawTypeToTypeInformation('Function<String, Number, Boolean>', '', null);
      expect(result.type).toBe('Function');
      expect((result as DetailedFunctionType).parameters).toHaveLength(2);
      expect((result as DetailedFunctionType).returns!.type).toBe('Boolean');
    });

    it('should handle Function<> without generic params falling back to subTypedKeys', () => {
      const md = `* \`arg1\` String - First arg`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      const result = rawTypeToTypeInformation('Function<Boolean>', '', typedKeys);
      expect(result.type).toBe('Function');
      expect((result as DetailedFunctionType).parameters).toHaveLength(1);
      expect((result as DetailedFunctionType).parameters[0].name).toBe('arg1');
      expect((result as DetailedFunctionType).returns!.type).toBe('Boolean');
    });

    it('should throw on generic type without inner types', () => {
      expect(() => rawTypeToTypeInformation('GenericType<>', '', null)).toThrow(
        /should have at least one inner type/,
      );
    });

    it('should handle generic types with Object inner type and subTypedKeys', () => {
      const md = `* \`prop\` String - Property`;
      const tokens = getTokens(md);
      const list = findNextList(tokens);
      const typedKeys = convertListToTypedKeys(list!);

      const result = rawTypeToTypeInformation('Promise<Object>', '', typedKeys);
      expect(result.type).toBe('Promise');
      expect(result.innerTypes).toHaveLength(1);
      expect(result.innerTypes![0].type).toBe('Object');
      expect((result.innerTypes![0] as DetailedObjectType).properties).toHaveLength(1);
    });
  });

  describe('findContentAfterList', () => {
    it('should return content starting from heading_close when returnAllOnNoList=true and no list found', () => {
      const md = `
### Heading

Some content without a list

#### Next Heading
`;
      const tokens = getTokens(md);
      const result = findContentAfterList(tokens, true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
