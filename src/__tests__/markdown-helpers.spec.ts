import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';

import { safelyJoinTokens, extractStringEnum, rawTypeToTypeInformation } from '../markdown-helpers';

describe('markdown-helpers', () => {
  describe('safelyJoinTokens', () => {
    it('should join no tokens to an empty string', () => {
      expect(safelyJoinTokens([])).toBe('');
    });

    describe('snapshots', () => {
      const fixtureDir = path.resolve(__dirname, 'fixtures');
      for (const markdownFixture of fs.readdirSync(fixtureDir)) {
        if (!markdownFixture.endsWith('.md')) continue;

        it(`should be correct for ${path.basename(markdownFixture, '.md')}`, () => {
          const markdown = new MarkdownIt();
          const tokens = markdown.parse(
            fs.readFileSync(path.resolve(fixtureDir, markdownFixture), 'utf8'),
            {},
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
});
