'use strict';

const env = require('../src/env');

describe('env', function() {

  describe('filter', function() {
    let _env;

    beforeEach(function() {
      _env = process.env;
    });

    afterEach(function() {
      process.env = _env;
    });

    it('should return an empty object by default', function() {
      process.env = {};

      expect(env.filter()).to.not.equal(process.env);
      expect(env.filter()).to.deep.equal({});
    });

    it('should filter variables', function() {
      const prefix = 'FOO_';
      const src = {
        FOO_BAR: 1,
        FOO_BAZ_QUX: 2,
        BAR: 3
      };

      expect(env.filter({prefix, src})).to.deep.equal({bar: 1, bazQux: 2});
    });

  });

});
