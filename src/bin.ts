#!/usr/bin/env node

import * as fs from 'fs-extra';
import minimist from 'minimist';
import ora from 'ora';
import * as path from 'path';
import pretty from 'pretty-ms';

import { parseDocs, ParseOptions } from '.';
import chalk from 'chalk';

const args = minimist(process.argv, {
  default: {
    packageMode: 'single',
    apiDocDir: path.join('docs', 'api'),
    outName: 'electron-api',
  },
  boolean: ['dontExtractVersion'],
});

const {
  dir,
  outDir,
  useReadme,
  packageMode,
  dontExtractVersion,
  apiDocDir,
  outName,
  websiteURL,
  repoURL,
  help,
} = args;
if (!['single', 'multi'].includes(packageMode)) {
  console.error(chalk.red('packageMode must be one of "single" and "multi"'));
  process.exit(1);
}

if (help) {
  console.info(
    chalk.cyan(
      'Usage: electron-docs-parser --dir ../electron \
[--out-dir ../electron-out] [--dontExtractVersion] [--apiDocDir docs/api] \
[--outName electron-api]',
    ),
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
if (!dontExtractVersion && !fs.pathExistsSync(packageJsonPath)) {
  runner.fail(
    `${chalk.red('Expected a package.json file to exist at path:')} ${chalk.cyan(packageJsonPath)}`,
  );
  process.exit(1);
}

let pj;
if (!dontExtractVersion) {
  pj = require(packageJsonPath);
}

const resolvedOutDir =
  typeof outDir === 'string'
    ? path.isAbsolute(outDir)
      ? outDir
      : path.resolve(process.cwd(), outDir)
    : process.cwd();
runner.text = chalk.cyan(`Generating API in directory: ${chalk.yellow(`"${resolvedOutDir}"`)}`);

const start = Date.now();

const options: ParseOptions = {
  useReadme: useReadme ? true : false,
  baseDirectory: resolvedDir,
  moduleVersion: 'no-version',
  packageMode,
  apiDir: apiDocDir,
  websiteURL: websiteURL,
  repoURL: repoURL,
};

const fileListPath = path.resolve(path.join(resolvedDir, apiDocDir), 'api-doc-list.json');
if (fs.pathExistsSync(fileListPath)) {
  options.fileList = require(fileListPath);
}

if (!dontExtractVersion) {
  options.moduleVersion = pj.version;
}

fs.mkdirp(resolvedOutDir).then(() =>
  parseDocs(options)
    .then(data =>
      fs.writeJson(path.resolve(resolvedOutDir, path.join('./', outName + '.json')), data, {
        spaces: 2,
      }),
    )
    .then(() =>
      runner.succeed(
        `${chalk.green(`${outName}.json generated in`)} ${chalk.yellow(
          `"${resolvedOutDir}"`,
        )} took ${chalk.cyan(pretty(Date.now() - start))}`,
      ),
    )
    .catch(err => {
      runner.fail();
      console.error(err);
      process.exit(1);
    }),
);
