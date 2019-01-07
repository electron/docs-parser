import * as fs from 'fs';
import * as path from 'path';
import * as MarkdownIt from 'markdown-it';

import { safelyJoinTokens } from '../markdown-helpers';

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
});
