#!/usr/bin/env node

import * as fs from 'fs-extra';
import minimist from 'minimist';
import ora from 'ora';
import * as path from 'path';
import pretty from 'pretty-ms';

import { parseDocs } from '.';
import chalk from 'chalk';
import { DocsParserPlugin } from './DocsParserPlugin';

const args = minimist(process.argv, {
  string: ['dir', 'outDir', 'outFile'],
  boolean: ['help'],
});

const { dir, outDir, help } = args;

if (help) {
  console.info(
    chalk.cyan(
      'Usage: electron-docs-parser --dir ../electron [--out-dir ../electron-out] [--out-file api.json]',
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
if (!fs.pathExistsSync(packageJsonPath)) {
  runner.fail(
    `${chalk.red('Expected a package.json file to exist at path:')} ${chalk.cyan(packageJsonPath)}`,
  );
  process.exit(1);
}

const pj = require(packageJsonPath);

const resolvedOutDir =
  typeof outDir === 'string'
    ? path.isAbsolute(outDir)
      ? outDir
      : path.resolve(process.cwd(), outDir)
    : process.cwd();

runner.text = chalk.cyan(`Generating API in directory: ${chalk.yellow(`"${resolvedOutDir}"`)}`);

const start = Date.now();

const loadPlugins = () => {
  if (!args.plugin) return [];

  const plugins: DocsParserPlugin<any>[] = [];
  const pluginArgs = (Array.isArray(args.plugin) ? args.plugin : [args.plugin]).map(String);
  for (const pluginArg of pluginArgs) {
    // Prevent path traversal
    if (pluginArg.includes('..')) continue;

    const plugin = require.resolve(path.resolve(__dirname, 'plugins', pluginArg));
    const Class = require(plugin).default;
    plugins.push(new Class(args[pluginArg] || {}));
    // TODO: Resolve a non-built-in plugin
  }
  // console.log(args);
  // process.exit(0);
  return plugins;
};

fs.mkdirp(resolvedOutDir)
  .then(() =>
    parseDocs({
      baseDirectory: resolvedDir,
      moduleVersion: pj.version,
      plugins: loadPlugins(),
    })
      .then(data =>
        fs.writeJson(path.resolve(resolvedOutDir, `./${args.outFile || 'api'}.json`), data, {
          spaces: 2,
        }),
      )
      .then(() =>
        runner.succeed(
          `${chalk.green(
            `${pj.productName || pj.name || 'Project'} API generated in`,
          )} ${chalk.yellow(`"${resolvedOutDir}"`)} took ${chalk.cyan(pretty(Date.now() - start))}`,
        ),
      ),
  )
  .catch(err => {
    runner.fail();
    console.error(err);
    process.exit(1);
  });
