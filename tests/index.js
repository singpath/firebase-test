'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const dirtyChai = require('dirty-chai');

chai.use(sinonChai);
chai.use(dirtyChai);

global.expect = chai.expect;
global.sinon = sinon;

require('./test_context');
require('./test_testsuite');
