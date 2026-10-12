#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import * as path from 'node:path';
import { Spinner } from 'picospinner';
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

let safePackageMode = packageMode as string;

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

const runner = startSpinner(chalk.yellow('Checking argv'));

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

runner.setText(chalk.cyan(`Generating API in directory: ${chalk.yellow(`"${resolvedOutDir}"`)}`));

const start = Date.now();

void fs.promises.mkdir(resolvedOutDir, { recursive: true }).then(() =>
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

function startSpinner(text: string) {
  const symbols = { succeed: chalk.green('✔'), fail: chalk.red('✖') };
  // picospinner animates unconditionally, which would flood logs when stderr is
  // not a terminal (e.g. in CI), so only animate when interactive and otherwise
  // just print the start and final lines.
  const interactive = process.stderr.isTTY && process.env.TERM !== 'dumb' && !('CI' in process.env);

  if (interactive) {
    const spinner = new Spinner(
      { text, stream: process.stderr },
      {
        colors: false,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map((frame) =>
          chalk.cyan(frame),
        ),
        symbols,
      },
    );
    spinner.start(80);
    return {
      setText: (newText: string) => spinner.setText(newText),
      succeed: (newText: string) => spinner.succeed(newText),
      fail: (newText?: string) => spinner.fail(newText),
    };
  }

  process.stderr.write(`- ${text}\n`);
  return {
    setText: (newText: string) => {
      text = newText;
    },
    succeed: (newText: string) => {
      process.stderr.write(`${symbols.succeed} ${newText}\n`);
    },
    fail: (newText = text) => {
      process.stderr.write(`${symbols.fail} ${newText}\n`);
    },
  };
}
