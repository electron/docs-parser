const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['node_modules', path.resolve(__dirname, 'dist')],
  setupFiles: ['<rootDir>/jest.setup.js'],
};