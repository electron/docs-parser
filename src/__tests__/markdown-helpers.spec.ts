import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';

import {
  safelyJoinTokens,
  extractStringEnum,
  rawTypeToTypeInformation,
  parseHeadingTags,
  findNextList,
  getTopLevelGenericType,
  findFirstHeading,
  consumeTypedKeysList,
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
        `"heading tags must be from the whitelist: [\\"macOS\\",\\"mas\\",\\"Windows\\",\\"Linux\\",\\"Experimental\\",\\"Deprecated\\",\\"Readonly\\"]: expected [ Array(7) ] to include 'Awesome'"`,
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

    describe('with single quotes', () => {
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
    });

    describe('with backticks', () => {
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
});
