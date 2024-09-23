#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import ora from 'ora';
import * as path from 'path';
import pretty from 'pretty-ms';

import { parseDocs } from './index.js';

const {
  values: { outDir, dir, useReadme, moduleVersion, help, packageMode },
} = parseArgs({
  options: {
    packageMode: {
      type: 'string',
      default: 'single',
    },
    dir: {
      type: 'string',
    },
    outDir: {
      type: 'string',
    },
    useReadme: {
      type: 'boolean',
    },
    moduleVersion: {
      type: 'string',
    },
    help: {
      type: 'boolean',
      default: false,
    },
  },
});

let safePackageMode = packageMode as 'single' | 'multi' | string;

if (safePackageMode !== 'single' && safePackageMode !== 'multi') {
  console.error(chalk.red('packageMode must be one of "single" and "multi"'));
  process.exit(1);
}

if (help) {
  console.info(
    chalk.cyan('Usage: electron-docs-parser --dir ../electron [--out-dir ../electron-out]'),
  );
  process.exit(0);
}

const runner = ora(chalk.yellow('Checking argv')).start();

if (typeof dir !== 'string') {
  runner.fail(chalk.red('Missing required --dir argument.  "--dir ../electron"'));
  process.exit(1);
}

if (typeof moduleVersion !== 'string') {
  runner.fail(chalk.red('Missing required --moduleVersion argument.  "--moduleVersion 1.2.3"'));
  process.exit(1);
}

const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
if (!fs.existsSync(resolvedDir)) {
  runner.fail(`${chalk.red('Resolved directory does not exist:')} ${chalk.cyan(resolvedDir)}`);
  process.exit(1);
}

const resolvedOutDir =
  typeof outDir === 'string'
    ? path.isAbsolute(outDir)
      ? outDir
      : path.resolve(process.cwd(), outDir)
    : process.cwd();

runner.text = chalk.cyan(`Generating API in directory: ${chalk.yellow(`"${resolvedOutDir}"`)}`);

const start = Date.now();

fs.promises.mkdir(resolvedOutDir, { recursive: true }).then(() =>
  parseDocs({
    useReadme: useReadme ? true : false,
    baseDirectory: resolvedDir,
    moduleVersion,
    packageMode: safePackageMode,
  })
    .then((data) =>
      fs.promises.writeFile(
        path.resolve(resolvedOutDir, './electron-api.json'),
        JSON.stringify(data, null, 2),
      ),
    )
    .then(() =>
      runner.succeed(
        `${chalk.green('Electron API generated in')} ${chalk.yellow(
          `"${resolvedOutDir}"`,
        )} took ${chalk.cyan(pretty(Date.now() - start))}`,
      ),
    )
    .catch((err) => {
      runner.fail();
      console.error(err);
      process.exit(1);
    }),
);
