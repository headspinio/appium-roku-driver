'use strict';

const gulp = require('gulp');
const boilerplate = require('@appium/gulp-plugins').boilerplate.use(gulp);


boilerplate({
  build: 'appium-roku-driver',
  projectRoot: __dirname,
  test: {
    files: ['${testDir}/**/*-specs.js', '!${testDir}/fixtures', '!${testDir}/**/*-e2e-specs.js'],
  },
});
