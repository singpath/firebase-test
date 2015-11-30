'use strict';

const expect = require('expect.js');
const sinon = require('sinon');
const assert = sinon.assert;
const match = sinon.match;
const spy = sinon.spy;
const stub = sinon.stub;

const Context = require('../src/testsuite').Context;
const wait = require('./utils').wait;

describe('Context', () => {

  describe('currentUser', () => {
    let ctx, suite;

    beforeEach(() => {
      const chain = Promise.resolve();
      suite = {};
      ctx = new Context(suite, chain);
    });

    it('should return the suite current user', () => {
      const currentUser = suite.currentUser = {};

      expect(ctx.currentUser).to.be(currentUser);
    });

  });

  describe('then', () => {
    let ctx, chain, start, fails;

    beforeEach(() => {
      chain = new Promise((resolve, reject) => {
        start = resolve;
        fails = reject;
      });

      ctx = new Context({}, chain);
    });

    it('should chain cbs', done => {
      var first, second = false;

      ctx.then(() => {expect(second).to.be(false); first = true;});
      ctx.then(() => {expect(first).to.be(true); second = true;});
      ctx.then(done, done);

      start();
    });

    it('should catch reject promise', done => {
      ctx.then(
        () => new Error('Should not be called'),
        () => done()
      );

      fails();
    });

    it('should recover from failure', done => {
      ctx.then(
        () => new Error('Should not be called'),
        () => undefined
      );
      ctx.then(done, done);

      fails();
    });
  });

  describe('catch', () => {
    let ctx, fails;

    beforeEach(() => {
      const chain = new Promise((_, reject) => {
        fails = reject;
      });

      ctx = new Context({}, chain);
    });

    it('should catch reject promise', done => {
      ctx.catch(() => done());

      fails();
    });

    it('should recover from failure', done => {
      ctx.catch(() => undefined);
      ctx.then(done, done);

      fails();
    });

  });

  describe('as', () => {
    let ctx, suite, chain;

    beforeEach(() => {
      suite = {};
      chain = Promise.resolve();
      ctx = new Context(suite, chain);
    });

    it('should log user in', done => {
      const uid = 'bob';
      const data = {isModerator: true};
      const debug = true;

      suite.login = spy();
      ctx.as(uid, data, debug).then(() => {
        assert.calledOnce(suite.login);
        assert.calledWith(suite.login, uid, data, debug);
        done();
      }, done);
    });

    it('should log user off', done => {
      suite.logout = spy();
      ctx.as().then(() => {
        assert.calledOnce(suite.logout);
        done();
      }, done);
    });
  });

  describe('get', () => {
    let ctx, suite, chain;

    beforeEach(() => {
      suite = {};
      chain = Promise.resolve();
      ctx = new Context(suite, chain);
    });

    it('should query a Firebase reference the requested path', done => {
      const path = 'foo';
      const ref = {value: spy()};

      suite.ref = stub().returns(ref);
      ctx.get(path);

      wait().then(() => {
        assert.calledOnce(suite.ref);
        done();
      });
    });

    it('should query the value at the path', done => {
      const path = 'foo';
      const ref = {once: spy()};


      suite.ref = stub().returns(ref);
      ctx.get(path);

      wait().then(() => {
        assert.calledOnce(ref.once);
        assert.calledWith(ref.once, 'value', match.func, match.func);
        done();
      });
    });

    it('should chain the operation', done => {
      let resolve;
      ctx.then(() => new Promise((ok) => resolve = ok));

      const ref = {once: spy()};
      suite.ref = stub().returns(ref);
      ctx.get('foo');

      wait().then(() => {
        assert.notCalled(ref.once);
        resolve();
        return wait();
      }).then(() => {
        assert.called(ref.once);
        done();
      });
    });

    it('should resolve the chain with the queried value', done => {
      const path = 'foo';
      const ref = {once: spy()};
      const value = {};

      suite.ref = stub().returns(ref);
      ctx.get(path);

      wait().then(() => {
        const args = ref.once.lastCall.args;
        const onSucess = args[1];

        onSucess(value);

        return ctx.chain;
      }).then(
        result => expect(result).to.be(value)
      ).then(
        () => done(),
        done
      );
    });

    it('should resolve the chain with the query error', done => {
      const path = 'foo';
      const ref = {once: spy()};
      const err = new Error();

      suite.ref = stub().returns(ref);
      ctx.get(path);

      wait().then(() => {
        const args = ref.once.lastCall.args;
        const onFailure = args[2];

        onFailure(err);

        return ctx.chain;
      }).then(
        () => done(new Error('should not be called')),
        e => {expect(e).to.be(err); done();}
      );
    });

  });

  ['set', 'update', 'push'].forEach(meth => {
    describe(meth, function() {
      let ctx, suite, chain;

      beforeEach(() => {
        suite = {};
        chain = Promise.resolve();
        ctx = new Context(suite, chain);
      });

      it('should query a Firebase reference for path it operates on', done => {
        const path = 'foo';
        const ref = {[meth]: spy()};
        const data = {};

        suite.ref = stub().returns(ref);
        ctx[meth](path, data);

        wait().then(() => {
          assert.calledOnce(suite.ref);
          done();
        });
      });

      it('should call the operation on the Firebase object', done => {
        const path = 'foo';
        const ref = {[meth]: spy()};
        const data = {};

        suite.ref = stub().returns(ref);
        ctx[meth](path, data);

        wait().then(() => {
          assert.calledOnce(ref[meth]);
          assert.calledWith(ref[meth], data, match.func);
          done();
        });
      });

      it('should chain the operation', done => {
        let resolve;
        ctx.then(() => new Promise((ok) => resolve = ok));

        const ref = {[meth]: spy()};
        suite.ref = stub().returns(ref);
        ctx[meth]('foo', {});

        wait().then(() => {
          assert.notCalled(ref[meth]);
          resolve();
          return wait();
        }).then(() => {
          assert.called(ref[meth]);
          done();
        });
      });

      it('should resolve the chain with the operation results', done => {
        const path = 'foo';
        const ref = {[meth]: spy()};
        const results = {};

        suite.ref = stub().returns(ref);
        ctx[meth](path, {});

        wait().then(() => {
          const cb = ref[meth].lastCall.args[1];
          cb(null, results);
          return ctx.chain;
        }).then(
          actual => expect(actual).to.be(results)
        ).then(
          () => done(), done
        );
      });

      it('should resolve the chain with the operation error', done => {
        const path = 'foo';
        const ref = {[meth]: spy()};
        const data = {};
        const err = new Error();

        suite.ref = stub().returns(ref);
        ctx[meth](path, data);

        wait().then(() => {
          const cb = ref[meth].lastCall.args[1];
          cb(err);
          return ctx.chain;
        }).then(
          () => done(new Error('Should not be called')),
          e => {expect(e).to.be(err); done();}
        );
      });
    });
  });

  describe('remove', () => {
    let ctx, suite, chain;

    beforeEach(() => {
      suite = {};
      chain = Promise.resolve();
      ctx = new Context(suite, chain);
    });

    it('should query a Firebase reference for path remove', done => {
      const path = 'foo';
      const ref = {remove: spy()};

      suite.ref = stub().returns(ref);
      ctx.remove(path);

      wait().then(() => {
        assert.calledOnce(suite.ref);
        done();
      });
    });

    it('should delete the element', done => {
      const path = 'foo';
      const ref = {remove: spy()};

      suite.ref = stub().returns(ref);
      ctx.remove(path);

      wait().then(() => {
        assert.calledOnce(ref.remove);
        assert.calledWith(ref.remove, match.func);
        done();
      });
    });

    it('should chain the operation', done => {
      let resolve;
      ctx.then(() => new Promise((ok) => resolve = ok));

      const ref = {remove: spy()};
      suite.ref = stub().returns(ref);
      ctx.remove('foo');

      wait().then(() => {
        assert.notCalled(ref.remove);
        resolve();
        return wait();
      }).then(() => {
        assert.called(ref.remove);
        done();
      });
    });

    it('should resolve the chain when the element is delete', done => {
      const path = 'foo';
      const ref = {remove: spy()};

      suite.ref = stub().returns(ref);
      ctx.remove(path);

      wait().then(() => {
        const cb = ref.remove.lastCall.args[0];
        cb(null);

        return ctx.chain;
      }).then(() => done(), done);
    });

    it('should resolve the chain it fails to delete the element', done => {
      const path = 'foo';
      const ref = {remove: spy()};
      const err = new Error();

      suite.ref = stub().returns(ref);
      ctx.remove(path);

      wait().then(() => {
        const cb = ref.remove.lastCall.args[0];
        cb(err);
        return ctx.chain;
      }).then(
        () => done(new Error('Should not be called')),
        e => {expect(e).to.be(err); done();}
      );
    });

  });

  describe('ok', function() {

    it('should test the chain resolve fulfilled', done => {
      new Context({}, Promise.resolve()).ok(done);
    });

  });

  describe('shouldFail', function() {

    it('should test the chain resolve rejected', done => {
      new Context({}, Promise.reject(new Error)).shouldFail(done);
    });

  });

});
