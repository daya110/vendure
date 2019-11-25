const path = require('path');
const { getPackageDir } = require('./get-package-dir');

const packageDirname = getPackageDir();

module.exports = {
  'moduleFileExtensions': ['js', 'json', 'ts'],
  'rootDir': packageDirname,
  'testRegex': '.e2e-spec.ts$',
  'transform': {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  'testEnvironment': 'node',
  'globals': {
    'ts-jest': {
      'tsConfig': '<rootDir>/config/tsconfig.e2e.json',
      'diagnostics': false,
    },
  },
};
