import chalk from 'chalk';

export const extendError = (msg: string, err: any) => {
  const e = new Error(`${msg} - ${err.message}`);
  e.stack = err.stack;
  if (typeof e.stack === 'string') {
    e.stack = chalk.red(msg) + '\n' + e.stack;
  }
  return e;
};
