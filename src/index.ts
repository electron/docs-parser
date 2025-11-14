import fs from 'node:fs';
import * as path from 'node:path';
import { DocsParser } from './DocsParser.js';

type ParseOptions = {
  baseDirectory: string;
  useReadme: boolean;
  moduleVersion: string;
  packageMode?: 'single' | 'multi';
};

export async function parseDocs(options: ParseOptions) {
  const packageMode = options.packageMode || 'single';

  const apiDocsPath = path.resolve(options.baseDirectory, 'docs', 'api');
  const structuresPath = path.resolve(apiDocsPath, 'structures');

  let structures: string[] = [];
  let apis: string[] = [];

  if (options.useReadme) {
    const readmePath = path.resolve(options.baseDirectory, 'README.md');
    if (!fs.existsSync(readmePath)) {
      throw new Error('README.md file not found');
    }
    apis = [readmePath];
  } else {
    structures = await getAllMarkdownFiles(structuresPath);
    apis = await getAllMarkdownFiles(apiDocsPath);
  }

  const parser = new DocsParser(
    options.baseDirectory,
    options.moduleVersion,
    apis,
    structures,
    packageMode,
  );

  return await parser.parse();
}

async function getAllMarkdownFiles(inDir: string) {
  const allMarkdownFiles: string[] = [];

  const children = await fs.promises.readdir(inDir);
  for (const child of children) {
    const childPath = path.resolve(inDir, child);
    const stats = await fs.promises.stat(childPath);
    if (path.extname(childPath) === '.md' && stats.isFile()) {
      allMarkdownFiles.push(childPath);
    }
  }

  return allMarkdownFiles;
}

export * from './ParsedDocumentation.js';
