import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DocsParser } from '../src/DocsParser.js';

describe('DocsParser', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory structure for tests
    tempDir = path.join(process.cwd(), 'tests', 'temp-fixtures');
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'docs', 'api', 'structures'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseAPIFile', () => {
    it('should parse a simple module documentation', async () => {
      const moduleContent = `# app

_Main process_

Control your application's event lifecycle.

## Events

### Event: 'ready'

Returns:

* \`launchInfo\` unknown _macOS_

Emitted once, when Electron has finished initializing.

## Methods

### \`app.quit()\`

Try to close all windows.

## Properties

### \`app.name\` _Readonly_

A \`string\` property that indicates the current application's name.
`;

      const modulePath = path.join(tempDir, 'docs', 'api', 'app.md');
      await fs.promises.writeFile(modulePath, moduleContent);

      const parser = new DocsParser(tempDir, '1.0.0', [modulePath], [], 'single');
      const result = await parser.parse();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      const appModule = result.find((m) => m.name === 'app');
      expect(appModule).toBeDefined();
      expect(appModule?.type).toBe('Module');
      // Just check that process information is present
      expect(appModule?.process).toBeDefined();
      expect(appModule?.process?.main).toBe(true);
      expect(appModule?.description).toContain('Control your application');

      if (appModule && appModule.type === 'Module') {
        expect(appModule.events).toHaveLength(1);
        expect(appModule.events[0].name).toBe('ready');

        expect(appModule.methods).toHaveLength(1);
        expect(appModule.methods[0].name).toBe('quit');

        expect(appModule.properties).toHaveLength(1);
        expect(appModule.properties[0].name).toBe('name');
      }
    });

    it('should parse a class documentation', async () => {
      const classContent = `# BrowserWindow

_Main process_

Create and control browser windows.

## Class: BrowserWindow

### \`new BrowserWindow([options])\`

* \`options\` Object (optional)
  * \`width\` Integer (optional) - Window's width in pixels. Default is \`800\`.
  * \`height\` Integer (optional) - Window's height in pixels. Default is \`600\`.

### Instance Methods

#### \`win.close()\`

Try to close the window.

#### \`win.show()\`

Shows the window.

### Instance Properties

#### \`win.id\` _Readonly_

A \`Integer\` representing the unique ID of the window.

### Instance Events

#### Event: 'closed'

Emitted when the window is closed.
`;

      const classPath = path.join(tempDir, 'docs', 'api', 'browser-window.md');
      await fs.promises.writeFile(classPath, classContent);

      const parser = new DocsParser(tempDir, '1.0.0', [classPath], [], 'single');
      const result = await parser.parse();

      expect(result).toBeDefined();
      const browserWindowClass = result.find((c) => c.name === 'BrowserWindow');

      expect(browserWindowClass).toBeDefined();
      expect(browserWindowClass?.type).toBe('Class');

      if (browserWindowClass && browserWindowClass.type === 'Class') {
        expect(browserWindowClass.constructorMethod).toBeDefined();
        expect(browserWindowClass.constructorMethod?.parameters).toHaveLength(1);

        expect(browserWindowClass.instanceMethods).toHaveLength(2);
        expect(browserWindowClass.instanceMethods[0].name).toBe('close');
        expect(browserWindowClass.instanceMethods[1].name).toBe('show');

        expect(browserWindowClass.instanceProperties).toHaveLength(1);
        expect(browserWindowClass.instanceProperties[0].name).toBe('id');

        expect(browserWindowClass.instanceEvents).toHaveLength(1);
        expect(browserWindowClass.instanceEvents[0].name).toBe('closed');
      }
    });

    it('should parse a class with static methods and properties', async () => {
      const classContent = `# Menu

_Main process_

Create native application menus.

## Class: Menu

### Static Methods

#### \`Menu.buildFromTemplate(template)\`

* \`template\` MenuItemConstructorOptions[]

Returns \`Menu\` - the menu instance.

### Static Properties

#### \`Menu.applicationMenu\`

A \`Menu | null\` property that returns the application menu.

### Instance Methods

#### \`menu.popup([options])\`

* \`options\` Object (optional)

Pops up this menu.
`;

      const classPath = path.join(tempDir, 'docs', 'api', 'menu.md');
      await fs.promises.writeFile(classPath, classContent);

      const parser = new DocsParser(tempDir, '1.0.0', [classPath], [], 'single');
      const result = await parser.parse();

      const menuClass = result.find((c) => c.name === 'Menu');
      expect(menuClass).toBeDefined();

      if (menuClass && menuClass.type === 'Class') {
        expect(menuClass.staticMethods).toHaveLength(1);
        expect(menuClass.staticMethods[0].name).toBe('buildFromTemplate');
        expect(menuClass.staticMethods[0].returns).toBeDefined();

        expect(menuClass.staticProperties).toHaveLength(1);
        expect(menuClass.staticProperties[0].name).toBe('applicationMenu');
      }
    });

    it('should handle module with exported class in multi-package mode', async () => {
      const moduleContent = `# BrowserWindow

_Main process_

Create and control browser windows.

## Methods

### \`BrowserWindow.getAllWindows()\`

Returns \`BrowserWindow[]\` - An array of all opened browser windows.

## Class: BrowserWindow

### Instance Methods

#### \`win.close()\`

Try to close the window.
`;

      const modulePath = path.join(tempDir, 'docs', 'api', 'browser-window.md');
      await fs.promises.writeFile(modulePath, moduleContent);

      const parser = new DocsParser(tempDir, '1.0.0', [modulePath], [], 'multi');
      const result = await parser.parse();

      // In multi-package mode, the module should exist and contain exported classes
      expect(result.length).toBeGreaterThan(0);
      const hasModuleWithClasses = result.some(
        (item) => item.type === 'Module' && item.exportedClasses && item.exportedClasses.length > 0
      );
      expect(hasModuleWithClasses).toBe(true);
    });

    it('should parse an element/tag documentation', async () => {
      const elementContent = `# \`<webview>\` Tag

_Renderer process_

Display external web content in an isolated frame.

## Methods

### \`<webview>.loadURL(url)\`

* \`url\` string

Loads the url in the webview.

## Tag Attributes

### \`src\`

A \`string\` representing the visible URL.

## DOM Events

### Event: 'did-finish-load'

Fired when the navigation is done.
`;

      const elementPath = path.join(tempDir, 'docs', 'api', 'webview-tag.md');
      await fs.promises.writeFile(elementPath, elementContent);

      const parser = new DocsParser(tempDir, '1.0.0', [elementPath], [], 'single');
      const result = await parser.parse();

      const webviewElement = result.find((e) => e.name === 'webviewTag');
      expect(webviewElement).toBeDefined();
      expect(webviewElement?.type).toBe('Element');
      expect(webviewElement?.extends).toBe('HTMLElement');

      if (webviewElement && webviewElement.type === 'Element') {
        expect(webviewElement.methods).toHaveLength(1);
        expect(webviewElement.methods[0].name).toBe('loadURL');

        expect(webviewElement.properties).toHaveLength(1);
        expect(webviewElement.properties[0].name).toBe('src');

        expect(webviewElement.events).toHaveLength(1);
        expect(webviewElement.events[0].name).toBe('did-finish-load');
      }
    });

    it('should handle process tags correctly', async () => {
      const mainProcessContent = `# app

_Main process_

Main process module.

## Methods

### \`app.quit()\`

Quit the application.
`;
      const rendererProcessContent = `# contextBridge

_Renderer process_

Renderer process module.

## Methods

### \`contextBridge.exposeInMainWorld(apiKey, api)\`

* \`apiKey\` string
* \`api\` any

Expose API to renderer.
`;

      const mainPath = path.join(tempDir, 'docs', 'api', 'app.md');
      const rendererPath = path.join(tempDir, 'docs', 'api', 'context-bridge.md');

      await fs.promises.writeFile(mainPath, mainProcessContent);
      await fs.promises.writeFile(rendererPath, rendererProcessContent);

      const parser = new DocsParser(tempDir, '1.0.0', [mainPath, rendererPath], [], 'single');
      const result = await parser.parse();

      const appModule = result.find((m) => m.name === 'app');
      const contextBridgeModule = result.find((m) => m.name === 'contextBridge');

      // Just verify process information is parsed
      expect(appModule?.process).toBeDefined();
      expect(contextBridgeModule?.process).toBeDefined();
    });
  });

  describe('parseStructure', () => {
    it('should parse a structure documentation', async () => {
      const structureContent = `# Rectangle Object

* \`x\` Integer - The x coordinate of the origin of the rectangle.
* \`y\` Integer - The y coordinate of the origin of the rectangle.
* \`width\` Integer - The width of the rectangle.
* \`height\` Integer - The height of the rectangle.

Additional description after the property list.
`;

      const structurePath = path.join(tempDir, 'docs', 'api', 'structures', 'rectangle.md');
      await fs.promises.writeFile(structurePath, structureContent);

      const parser = new DocsParser(tempDir, '1.0.0', [], [structurePath], 'single');
      const result = await parser.parse();

      const rectangleStructure = result.find((s) => s.name === 'Rectangle');
      expect(rectangleStructure).toBeDefined();
      expect(rectangleStructure?.type).toBe('Structure');

      if (rectangleStructure && rectangleStructure.type === 'Structure') {
        expect(rectangleStructure.properties).toHaveLength(4);
        expect(rectangleStructure.properties[0].name).toBe('x');
        expect(rectangleStructure.properties[0].type).toBe('Integer');
        expect(rectangleStructure.properties[1].name).toBe('y');
        expect(rectangleStructure.properties[2].name).toBe('width');
        expect(rectangleStructure.properties[3].name).toBe('height');
      }
    });

    it('should parse a structure with optional properties', async () => {
      const structureContent = `# Options Object

* \`width\` Integer (optional) - Window width.
* \`height\` Integer (optional) - Window height.
* \`title\` string - Window title.
`;

      const structurePath = path.join(tempDir, 'docs', 'api', 'structures', 'options.md');
      await fs.promises.writeFile(structurePath, structureContent);

      const parser = new DocsParser(tempDir, '1.0.0', [], [structurePath], 'single');
      const result = await parser.parse();

      const optionsStructure = result.find((s) => s.name === 'Options');

      if (optionsStructure && optionsStructure.type === 'Structure') {
        expect(optionsStructure.properties[0].required).toBe(false);
        expect(optionsStructure.properties[1].required).toBe(false);
        expect(optionsStructure.properties[2].required).toBe(true);
      }
    });

    it('should handle structure with extends clause', async () => {
      const structureContent = `# ExtendedOptions Object extends \`BaseOptions\`

* \`extra\` string - Extra property.
`;

      const structurePath = path.join(tempDir, 'docs', 'api', 'structures', 'extended-options.md');
      await fs.promises.writeFile(structurePath, structureContent);

      const parser = new DocsParser(tempDir, '1.0.0', [], [structurePath], 'single');
      const result = await parser.parse();

      const extendedStructure = result.find((s) => s.name === 'ExtendedOptions');
      expect(extendedStructure).toBeDefined();
      expect(extendedStructure?.extends).toBe('BaseOptions');
    });
  });

  describe('parse', () => {
    it('should parse multiple files and return complete documentation', async () => {
      const appContent = `# app

_Main process_

Control your application.

## Methods

### \`app.quit()\`

Quit the application.
`;

      const rectStructure = `# Rectangle Object

* \`x\` Integer
* \`y\` Integer
`;

      const appPath = path.join(tempDir, 'docs', 'api', 'app.md');
      const rectPath = path.join(tempDir, 'docs', 'api', 'structures', 'rectangle.md');

      await fs.promises.writeFile(appPath, appContent);
      await fs.promises.writeFile(rectPath, rectStructure);

      const parser = new DocsParser(tempDir, '1.0.0', [appPath], [rectPath], 'single');
      const result = await parser.parse();

      expect(result).toHaveLength(2);
      expect(result.some((item) => item.name === 'app')).toBe(true);
      expect(result.some((item) => item.name === 'Rectangle')).toBe(true);
    });

    it('should add error context when parsing fails', async () => {
      const invalidContent = `# InvalidModule

This has no proper structure for parsing.

## Methods

### Invalid method format here
`;

      const invalidPath = path.join(tempDir, 'docs', 'api', 'invalid.md');
      await fs.promises.writeFile(invalidPath, invalidContent);

      const parser = new DocsParser(tempDir, '1.0.0', [invalidPath], [], 'single');

      await expect(parser.parse()).rejects.toThrow(/invalid\.md/);
    });

    it('should handle empty files array', async () => {
      const parser = new DocsParser(tempDir, '1.0.0', [], [], 'single');
      const result = await parser.parse();

      expect(result).toEqual([]);
    });
  });

  describe('URL generation', () => {
    it('should generate correct website and repo URLs', async () => {
      const moduleContent = `# testModule

_Main process_

Test module.

## Methods

### \`testModule.test()\`

Test method.
`;

      const modulePath = path.join(tempDir, 'docs', 'api', 'test-module.md');
      await fs.promises.writeFile(modulePath, moduleContent);

      const parser = new DocsParser(tempDir, '2.0.0', [modulePath], [], 'single');
      const result = await parser.parse();

      expect(result.length).toBeGreaterThan(0);
      const testModule = result[0];
      expect(testModule).toBeDefined();
      expect(testModule.websiteUrl).toContain('/docs/api/test-module');
      expect(testModule.repoUrl).toContain('v2.0.0/docs/api/test-module.md');
      expect(testModule.version).toBe('2.0.0');
    });
  });

  describe('Draft documentation', () => {
    it('should skip draft documentation', async () => {
      const draftContent = `# DraftAPI (Draft)

This is draft documentation.
`;

      const draftPath = path.join(tempDir, 'docs', 'api', 'draft.md');
      await fs.promises.writeFile(draftPath, draftContent);

      const parser = new DocsParser(tempDir, '1.0.0', [draftPath], [], 'single');
      const result = await parser.parse();

      expect(result).toHaveLength(0);
    });
  });
});
