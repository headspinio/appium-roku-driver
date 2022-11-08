'use strict';

module.exports = (wallaby) => {
  return {
    compilers: {
      '**/*.js': wallaby.compilers.babel(),
    },
    debug: true,
    env: {
      type: 'node',
    },
    files: [
      './lib/**/*.js',
    ],
    testFramework: 'mocha',
    tests: [
      './test/unit/**/*.spec.js',
    ],
    runMode: 'onsave',
    workers: {recycle: true},
    setup() {
    }
  }
};
