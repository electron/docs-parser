import * as fs from 'fs-extra';
import * as path from 'path';
import { DocsParser } from './DocsParser';

export type ParseOptions = {
  baseDirectory: string;
  useReadme: boolean;
  moduleVersion: string;
  packageMode?: 'single' | 'multi';
  fileList?: [string];
  apiDir: string;
  websiteURL?: string;
  repoURL?: string;
};

export async function parseDocs(options: ParseOptions) {
  const packageMode = options.packageMode || 'single';

  const apiDocsPath = path.resolve(options.baseDirectory, options.apiDir);

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
    structures = await getAllMarkdownFiles(structuresPath, options);
    apis = await getAllMarkdownFiles(apiDocsPath, options);
  }

  const parser = new DocsParser(
    options.baseDirectory,
    options.moduleVersion,
    apis,
    structures,
    packageMode,
    options.websiteURL,
    options.repoURL,
  );

  return await parser.parse();
}

async function getAllMarkdownFiles(inDir: string, options: ParseOptions) {
  const allMarkdownFiles: string[] = [];

  const children = await fs.readdir(inDir);
  for (const child of children) {
    const childPath = path.resolve(inDir, child);
    const stats = await fs.stat(childPath);
    if (
      path.extname(childPath) === '.md' &&
      stats.isFile() &&
      (options.fileList == undefined || options.fileList.includes(path.basename(childPath)))
    ) {
      allMarkdownFiles.push(childPath);
    }
  }

  return allMarkdownFiles;
}

export * from './ParsedDocumentation';
