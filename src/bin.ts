#!/usr/bin/env node

import * as fs from 'fs-extra';
import minimist from 'minimist';
import ora from 'ora';
import * as path from 'path';
import pretty from 'pretty-ms';

import { parseDocs } from '.';
import chalk from 'chalk';

const args = minimist(process.argv);

const { dir, outDir, help } = args;

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

const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
if (!fs.pathExistsSync(resolvedDir)) {
  runner.fail(`${chalk.red('Resolved directory does not exist:')} ${chalk.cyan(resolvedDir)}`);
  process.exit(1);
}

const packageJsonPath = path.resolve(resolvedDir, 'package.json');
if (!fs.pathExistsSync(packageJsonPath)) {
  runner.fail(
    `${chalk.red('Expected a package.json file to exist at path:')} ${chalk.cyan(packageJsonPath)}`,
  );
  process.exit(1);
}

const pj = require(packageJsonPath);
if (pj.name !== 'electron') {
  runner.fail(
    chalk.red(
      'The package.json file in the provided directory is not for Electron, please point this tool at a Electron repository',
    ),
  );
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

fs.mkdirp(resolvedOutDir).then(() =>
  parseDocs({
    baseDirectory: resolvedDir,
    electronVersion: pj.version,
  })
    .then(data =>
      fs.writeJson(path.resolve(resolvedOutDir, './electron-api.json'), data, {
        spaces: 2,
      }),
    )
    .then(() =>
      runner.succeed(
        `${chalk.green('Electron API generated in')} ${chalk.yellow(
          `"${resolvedOutDir}"`,
        )} took ${chalk.cyan(pretty(Date.now() - start))}`,
      ),
    )
    .catch(err => {
      console.error(err);
      process.exit(1);
    }),
);
