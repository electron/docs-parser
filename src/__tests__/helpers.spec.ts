import { extendError } from '../utils/helpers';
import chalk from 'chalk';

describe('extendError', () => {
  it('should extend the error message with the provided prefix', () => {
    const newError = extendError('foo', new Error('test'));
    expect(newError.message).toEqual('foo - test');
  });

  it('should add the new message to the front of the stack in red', () => {
    const newError = extendError('foo', new Error('test'));
    expect(newError.stack!.split('\n')[0]).toEqual(chalk.red('foo'));
  });
});
