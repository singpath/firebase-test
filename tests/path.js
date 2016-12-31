'use strict';

const path = require('../src/path');

describe('path', function() {

  describe('trim', function() {

    it('should trim white spaces', function() {
      expect(path.trim('  foo ')).to.equal('foo');
    });

    it('should trim separators', function() {
      expect(path.trim('//foo/')).to.equal('foo');
    });

    it('should not trim url encoded chars', function() {
      expect(path.trim('%2Ffoo%20')).to.equal('%2Ffoo%20');
    });

    it('should handle missing path', function() {
      expect(path.trim()).to.equal('');
    });

  });

  describe('join', function() {

    it('should join strings', function() {
      expect(path.join('foo', 'bar', 'baz')).to.equal('foo/bar/baz');
    });

    it('should join an array', function() {
      expect(path.join(['foo', 'bar', 'baz'])).to.equal('foo/bar/baz');
    });

    it('should join mixed args', function() {
      expect(path.join(['foo', 'bar'], 'baz')).to.equal('foo/bar/baz');
    });

    it('should trim elements', function() {
      expect(path.join(['/foo/bar/', '/baz'], '/qux/')).to.equal('foo/bar/baz/qux');
    });

    it('should handle missing path', function() {
      expect(path.join()).to.equal('');
    });

  });

});
