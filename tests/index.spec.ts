import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocs } from '../src/index.js';
import type {
  ModuleDocumentationContainer,
  ClassDocumentationContainer,
  StructureDocumentationContainer,
  ElementDocumentationContainer,
} from '../src/ParsedDocumentation.js';

type ParsedItem = ModuleDocumentationContainer | ClassDocumentationContainer | StructureDocumentationContainer | ElementDocumentationContainer;

describe('index (public API)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'tests', 'temp-api-fixtures');
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'docs', 'api', 'structures'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseDocs', () => {
    it('should parse documentation from a base directory', async () => {
      const appContent = `# app

_Main process_

Application module.

## Methods

### \`app.quit()\`

Quit the application.
`;

      const appPath = path.join(tempDir, 'docs', 'api', 'app.md');
      await fs.promises.writeFile(appPath, appContent);

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const appModule = result.find((m: ParsedItem) => m.name === 'app');
      expect(appModule).toBeDefined();
    });

    it('should use single package mode by default', async () => {
      const moduleWithClassContent = `# TestModule

Module description.

## Class: TestClass

### Instance Methods

#### \`test.method()\`

Test method.
`;

      const modulePath = path.join(tempDir, 'docs', 'api', 'test-module.md');
      await fs.promises.writeFile(modulePath, moduleWithClassContent);

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      // In single package mode, classes are not nested in modules
      const testClass = result.find((item: ParsedItem) => item.name === 'TestClass');
      expect(testClass).toBeDefined();
      expect(testClass?.type).toBe('Class');
    });

    it('should use multi package mode when specified', async () => {
      const moduleWithClassContent = `# TestModule

_Main process_

Module description.

## Methods

### \`TestModule.init()\`

Initialize the module.

## Class: TestClass

### Instance Methods

#### \`test.method()\`

Test method.
`;

      const modulePath = path.join(tempDir, 'docs', 'api', 'test-module.md');
      await fs.promises.writeFile(modulePath, moduleWithClassContent);

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
        packageMode: 'multi',
      });

      // In multi package mode, classes are nested in modules
      const testModule = result.find((item: ParsedItem) => item.name === 'TestModule');
      expect(testModule).toBeDefined();
      expect(testModule?.type).toBe('Module');

      if (testModule && testModule.type === 'Module') {
        expect(testModule.exportedClasses).toHaveLength(1);
        expect(testModule.exportedClasses[0].name).toBe('TestClass');
      }
    });

    it('should parse structures from structures directory', async () => {
      const structureContent = `# Point Object

* \`x\` Integer - X coordinate.
* \`y\` Integer - Y coordinate.
`;

      const structurePath = path.join(tempDir, 'docs', 'api', 'structures', 'point.md');
      await fs.promises.writeFile(structurePath, structureContent);

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      const pointStructure = result.find((s: ParsedItem) => s.name === 'Point');
      expect(pointStructure).toBeDefined();
      expect(pointStructure?.type).toBe('Structure');
    });

    it('should parse both API files and structures', async () => {
      const appContent = `# app

_Main process_

Application module.

## Methods

### \`app.quit()\`

Quit the app.
`;
      const structureContent = `# Options Object

* \`width\` Integer
`;

      const appPath = path.join(tempDir, 'docs', 'api', 'app.md');
      const structurePath = path.join(tempDir, 'docs', 'api', 'structures', 'options.md');

      await fs.promises.writeFile(appPath, appContent);
      await fs.promises.writeFile(structurePath, structureContent);

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      expect(result.some((item: ParsedItem) => item.name === 'app')).toBe(true);
      expect(result.some((item: ParsedItem) => item.name === 'Options')).toBe(true);
    });

    it('should use README when useReadme is true', async () => {
      const readmeContent = `# MyPackage

Package documentation.

## Methods

### \`myPackage.init()\`

Initialize the package.
`;

      const readmePath = path.join(tempDir, 'README.md');
      await fs.promises.writeFile(readmePath, readmeContent);

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: true,
        moduleVersion: '1.0.0',
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      const packageModule = result.find((m: ParsedItem) => m.name === 'MyPackage');
      expect(packageModule).toBeDefined();
    });

    it('should throw error when README not found with useReadme', async () => {
      await expect(
        parseDocs({
          baseDirectory: tempDir,
          useReadme: true,
          moduleVersion: '1.0.0',
        }),
      ).rejects.toThrow('README.md file not found');
    });

    it('should handle empty API directory', async () => {
      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '2.5.0',
      });

      expect(result).toEqual([]);
    });

    it('should handle directory with only structures', async () => {
      const structureContent = `# Config Object

* \`name\` string
`;

      const structurePath = path.join(tempDir, 'docs', 'api', 'structures', 'config.md');
      await fs.promises.writeFile(structurePath, structureContent);

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('Structure');
      expect(result[0].name).toBe('Config');
    });

    it('should include version in parsed documentation', async () => {
      const appContent = `# app

_Main process_

Application module.

## Methods

### \`app.quit()\`

Quit the app.
`;

      const appPath = path.join(tempDir, 'docs', 'api', 'app.md');
      await fs.promises.writeFile(appPath, appContent);

      const version = '5.0.0-beta.1';
      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: version,
      });

      expect(result[0].version).toBe(version);
    });

    it('should handle multiple API files', async () => {
      const files = [
        { name: 'app.md', content: '# app\n\n_Main process_\n\nApp module.\n\n## Methods\n\n### `app.quit()`\n\nQuit.' },
        { name: 'browser-window.md', content: '# BrowserWindow\n\n_Main process_\n\n## Methods\n\n### `BrowserWindow.getAllWindows()`\n\nGet all windows.\n\n## Class: BrowserWindow\n\n### Instance Methods\n\n#### `win.close()`\n\nClose.' },
        { name: 'dialog.md', content: '# dialog\n\n_Main process_\n\nDialog module.\n\n## Methods\n\n### `dialog.showOpenDialog()`\n\nShow dialog.' },
      ];

      for (const file of files) {
        const filePath = path.join(tempDir, 'docs', 'api', file.name);
        await fs.promises.writeFile(filePath, file.content);
      }

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.some((item: ParsedItem) => item.name === 'app')).toBe(true);
      expect(result.some((item: ParsedItem) => item.name === 'BrowserWindow')).toBe(true);
      expect(result.some((item: ParsedItem) => item.name === 'dialog')).toBe(true);
    });
  });

  describe('getAllMarkdownFiles (implicit testing)', () => {
    it('should find all markdown files in API directory', async () => {
      const files = ['app.md', 'dialog.md', 'menu.md'];

      for (const file of files) {
        const filePath = path.join(tempDir, 'docs', 'api', file);
        const moduleName = file.replace('.md', '');
        await fs.promises.writeFile(
          filePath,
          `# ${moduleName}\n\n_Main process_\n\nModule.\n\n## Methods\n\n### \`${moduleName}.test()\`\n\nTest.`
        );
      }

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      expect(result.length).toBe(files.length);
    });

    it('should not find non-markdown files', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'docs', 'api', 'app.md'),
        '# app\n\n_Main process_\n\nModule.\n\n## Methods\n\n### `app.test()`\n\nTest.',
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'docs', 'api', 'README.txt'),
        'Not a markdown file',
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'docs', 'api', 'config.json'),
        '{"test": true}',
      );

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('app');
    });

    it('should handle structures subdirectory separately', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'docs', 'api', 'app.md'),
        '# app\n\n_Main process_\n\nModule.\n\n## Methods\n\n### `app.test()`\n\nTest.',
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'docs', 'api', 'structures', 'point.md'),
        '# Point Object\n\n* `x` Integer',
      );

      const result = await parseDocs({
        baseDirectory: tempDir,
        useReadme: false,
        moduleVersion: '1.0.0',
      });

      // Should have parsed both api files and structures
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((item: ParsedItem) => item.type === 'Module' || item.type === 'Structure')).toBe(true);
    });
  });
});
