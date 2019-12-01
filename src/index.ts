import * as fs from 'fs-extra';
import * as path from 'path';
import { DocsParser } from './DocsParser';
import { DocsParserPlugin } from './DocsParserPlugin';

type ParseOptions = {
  baseDirectory: string;
  moduleVersion: string;
  plugins?: DocsParserPlugin<any>[];
};

export async function parseDocs(options: ParseOptions) {
  const electronDocsPath = path.resolve(options.baseDirectory, 'docs', 'api');

  const parser = new DocsParser(
    options.baseDirectory,
    options.moduleVersion,
    await getAllMarkdownFiles(electronDocsPath),
    await getAllMarkdownFiles(path.resolve(electronDocsPath, 'structures')),
    options.plugins || [],
  );

  return await parser.parse();
}

async function getAllMarkdownFiles(inDir: string) {
  const allMarkdownFiles: string[] = [];

  const children = await fs.readdir(inDir);
  for (const child of children) {
    const childPath = path.resolve(inDir, child);
    const stats = await fs.stat(childPath);
    if (path.extname(childPath) === '.md' && stats.isFile()) {
      allMarkdownFiles.push(childPath);
    }
  }

  return allMarkdownFiles;
}

export * from './ParsedDocumentation';
