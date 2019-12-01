import MarkdownIt from 'markdown-it';

import { findProcess } from '../electron-process';

const getTokens = (md: string) => {
  const markdown = new MarkdownIt();
  return markdown.parse(md, {});
};

describe('findProcess()', () => {
  it('should be available in main processe only', () => {
    var proc = findProcess(getTokens('Process: [Main](../glossary.md#main-process)'));
    expect(proc.main).toEqual(true);
    expect(proc.renderer).toEqual(false);
  });

  it('should be available in renderer processe only', () => {
    var proc = findProcess(getTokens('Process: [Renderer](../glossary.md#renderer-process)'));
    expect(proc.main).toEqual(false);
    expect(proc.renderer).toEqual(true);
  });

  it('should be available in both processes', () => {
    var proc = findProcess(
      getTokens(
        'Process: [Main](../glossary.md#main-process), [Renderer](../glossary.md#renderer-process)',
      ),
    );
    expect(proc.main).toEqual(true);
    expect(proc.renderer).toEqual(true);
  });

  it('should be available in both processes', () => {
    var proc = findProcess(
      getTokens(
        'Process: [Renderer](../glossary.md#renderer-process), [Main](../glossary.md#main-process)',
      ),
    );
    expect(proc.main).toEqual(true);
    expect(proc.renderer).toEqual(true);
  });

  it('should be available in both processes', () => {
    var proc = findProcess(getTokens(''));
    expect(proc.main).toEqual(true);
    expect(proc.renderer).toEqual(true);
  });

  it('should be available in both processes', () => {
    var proc = findProcess([]);
    expect(proc.main).toEqual(true);
    expect(proc.renderer).toEqual(true);
  });
});
