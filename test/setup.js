'use strict';

require('@babel/register')();

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');

// The `chai` global is set if a test needs something special.
// Most tests won't need this.
chai.use(chaiAsPromised).use(sinonChai);

// `should()` is only necessary when working with some `null` or `undefined` values.
global.should = chai.should();
