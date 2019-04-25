import * as fs from 'fs-extra';
import * as path from 'path';
import { DocsParser } from './DocsParser';

type ParseOptions = {
  baseDirectory: string;
  electronVersion: string;
};

export async function parseDocs(options: ParseOptions) {
  const electronDocsPath = path.resolve(options.baseDirectory, 'docs', 'api');

  const parser = new DocsParser(
    options.baseDirectory,
    options.electronVersion,
    await getAllMarkdownFiles(electronDocsPath),
    await getAllMarkdownFiles(path.resolve(electronDocsPath, 'structures')),
  );

  return await parser.parse();
}

async function getAllMarkdownFiles(inDir: string) {
  const allMarkdownFiles: string[] = [];

  const children = await fs.readdir(inDir);
  await Promise.all(
    children.map(async child => {
      const childPath = path.resolve(inDir, child);
      const stats = await fs.stat(childPath);
      if (path.extname(childPath) === '.md' && stats.isFile()) {
        allMarkdownFiles.push(childPath);
      }
    }),
  );

  return allMarkdownFiles;
}

export * from './ParsedDocumentation';
