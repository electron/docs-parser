import { extendError } from '../src/helpers.js';

import chalk from 'chalk';
import { describe, expect, it } from 'vitest';

describe('extendError', () => {
  it('should extend the error message with the provided prefix', () => {
    const newError = extendError('foo', new Error('test'));
    expect(newError.message).toEqual('foo - test');
  });

  it('should add the new message to the front of the stack in red', () => {
    const newError = extendError('foo', new Error('test'));
    expect(newError.stack!.split('\n')[0]).toEqual(chalk.red('foo'));
  });

  it('should handle errors without a stack trace', () => {
    const errorWithoutStack = new Error('test');
    delete (errorWithoutStack as any).stack;
    const newError = extendError('foo', errorWithoutStack);
    expect(newError.message).toEqual('foo - test');
    expect(newError.stack).toBeUndefined();
  });

  it('should handle errors with non-string stack', () => {
    const errorWithNonStringStack: any = new Error('test');
    errorWithNonStringStack.stack = null;
    const newError = extendError('foo', errorWithNonStringStack);
    expect(newError.message).toEqual('foo - test');
    expect(newError.stack).toBeNull();
  });

  it('should handle plain objects with message and stack properties', () => {
    const errorLikeObject = { message: 'custom error', stack: 'custom stack trace' };
    const newError = extendError('prefix', errorLikeObject);
    expect(newError.message).toEqual('prefix - custom error');
    expect(newError.stack).toContain(chalk.red('prefix'));
    expect(newError.stack).toContain('custom stack trace');
  });

  it('should handle error-like objects without a message property', () => {
    const errorWithoutMessage: any = { stack: 'some stack' };
    const newError = extendError('prefix', errorWithoutMessage);
    expect(newError.message).toEqual('prefix - undefined');
  });

  it('should preserve original stack when it is a string', () => {
    const originalError = new Error('original');
    const originalStack = originalError.stack;
    const newError = extendError('wrapped', originalError);
    expect(newError.stack).toContain(chalk.red('wrapped'));
    expect(newError.stack).toContain(originalStack!.split('\n').slice(1).join('\n'));
  });
});
