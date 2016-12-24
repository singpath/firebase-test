'use strict';

const context = require('../src/context');

describe('context', function() {

  describe('create', function() {
    let rules, driver;

    beforeEach(function() {
      rules = {};
      driver = {
        init: sinon.spy(),
        exec: sinon.stub()
      };
    });

    it('should throw if options are missing', function() {
      expect(() => context.create()).to.throw();
    });

    it('should throw if driver is missing', function() {
      expect(() => context.create({rules})).to.throw();
    });

    it('should throw if rules are missing', function() {
      expect(() => context.create({driver})).to.throw();
    });

    it('should create a context', function() {
      const ctx = context.create({rules, driver});

      expect(ctx.rules).to.equal(rules);
      expect(ctx.driver).to.equal(driver);
      expect(ctx.driver.init).to.have.been.calledOnce();
      expect(ctx.driver.init).to.have.been.calledWith(ctx);
    });

    it('should have no seed, auth or operation', function() {
      const ctx = context.create({rules, driver});

      expect(ctx.seed).to.be.null();
      expect(ctx.auth).to.be.null();
      expect(ctx.ops).to.have.length(0);
    });

    describe('fork', function() {

      it('should fork the ctx', function() {
        const ctx0 = context.create({rules, driver});
        const ctx1 = ctx0.fork({seed: 1, auth: {uid: 'bob'}});

        ctx1.ops.push({});

        expect(ctx0.seed).to.be.null();
        expect(ctx0.auth).to.be.null();
        expect(ctx0.ops).to.have.length(0);

        expect(ctx1.seed).to.equal(1);
        expect(ctx1.auth).to.deep.equal({uid: 'bob'});
        expect(ctx1.ops).to.have.length(1);
      });

    });

    describe('startWith', function() {

      it('should fork and reset seed and operations', function() {
        const ctx0 = context.create({rules, driver});

        ctx0.ops.push({});

        const ctx1 = ctx0.startWith(1);

        expect(ctx1.seed).to.equal(1);
        expect(ctx1.auth).to.be.null();
        expect(ctx1.ops).to.have.length(0);
      });

    });

    describe('as', function() {

      it('should fork and set auth', function() {
        const ctx0 = context.create({rules, driver});
        const ctx1 = ctx0.as('bob', {role: 'user'});

        expect(ctx0.auth).to.be.null();
        expect(ctx1.auth).to.deep.equal({uid: 'bob', role: 'user'});
      });

      it('should reset auth', function() {
        const ctx0 = context.create({rules, driver}).as('bob', {role: 'user'});
        const ctx1 = ctx0.as();

        expect(ctx0.auth).to.deep.equal({uid: 'bob', role: 'user'});
        expect(ctx1.auth).to.be.null();
      });

    });

    describe('get', function() {

      it('should fork and add a get operation', function() {
        const ctx0 = context.create({rules, driver}).as('bob');
        const ctx1 = ctx0.get('foo/bar');

        expect(ctx0.ops).to.have.length(0);
        expect(ctx1.ops).to.have.length(1);
        expect(ctx1.ops[0]).to.deep.equal({
          op: 'get',
          path: 'foo/bar',
          auth: {uid: 'bob'},
          value: undefined,
          options: {}
        });
      });

      it('should default path to the root', function() {
        const ctx = context.create({rules, driver}).as('bob').get();

        expect(ctx.ops).to.have.length(1);
        expect(ctx.ops[0].path).to.equal('');
      });

      it('should default auth to null', function() {
        const ctx = context.create({rules, driver});

        delete ctx.auth;

        expect(ctx.get().ops[0].auth).to.be.null();
      });

    });

    describe('set', function() {

      it('should fork and add a set operation', function() {
        const ctx0 = context.create({rules, driver}).as('bob');
        const ctx1 = ctx0.set('foo/bar', 1);

        expect(ctx0.ops).to.have.length(0);
        expect(ctx1.ops).to.have.length(1);
        expect(ctx1.ops[0]).to.deep.equal({
          op: 'set',
          path: 'foo/bar',
          auth: {uid: 'bob'},
          value: 1,
          options: {}
        });
      });

      it('should fork and add a set operation', function() {
        const ctx = context.create({rules, driver}).set('foo/bar');

        expect(ctx.ops).to.have.length(1);
        expect(ctx.ops[0].value).to.be.null();
      });

    });

    describe('update', function() {

      it('should fork and add a update operation', function() {
        const ctx0 = context.create({rules, driver}).as('bob');
        const ctx1 = ctx0.update('foo', {bar: 1});

        expect(ctx0.ops).to.have.length(0);
        expect(ctx1.ops).to.have.length(1);
        expect(ctx1.ops[0]).to.deep.equal({
          op: 'update',
          path: 'foo',
          auth: {uid: 'bob'},
          value: {bar: 1},
          options: {}
        });
      });

      it('should fork and add a update operation', function() {
        const ctx = context.create({rules, driver}).update('foo');

        expect(ctx.ops).to.have.length(1);
        expect(ctx.ops[0].value).to.deep.equal({});
      });

    });

    describe('push', function() {

      it('should fork and add a push operation', function() {
        const ctx0 = context.create({rules, driver}).as('bob');
        const ctx1 = ctx0.push('foo/bar', 1);

        expect(ctx0.ops).to.have.length(0);
        expect(ctx1.ops).to.have.length(1);
        expect(ctx1.ops[0]).to.deep.equal({
          op: 'push',
          path: 'foo/bar',
          auth: {uid: 'bob'},
          value: 1,
          options: {}
        });
      });

      it('should fork and add a push operation', function() {
        const ctx = context.create({rules, driver}).push('foo/bar');

        expect(ctx.ops).to.have.length(1);
        expect(ctx.ops[0].value).to.be.null();
      });

    });

    describe('remove', function() {

      it('should fork and add a set operation', function() {
        const ctx0 = context.create({rules, driver}).as('bob');
        const ctx1 = ctx0.remove('foo/bar');

        expect(ctx0.ops).to.have.length(0);
        expect(ctx1.ops).to.have.length(1);
        expect(ctx1.ops[0]).to.deep.equal({
          op: 'set',
          path: 'foo/bar',
          auth: {uid: 'bob'},
          value: null,
          options: {}
        });
      });

    });

    describe('then', function() {

      it('should run the sequence of operation', function() {
        const result = {};
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.returns(result);

        return ctx.then(r => {
          expect(ctx.driver.exec).to.have.been.calledOnce();
          expect(ctx.driver.exec).to.have.been.calledWith(ctx);
          expect(r).to.equal(result);
        });
      });

      it('should capture exceptions', function() {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.throws(err);

        return ctx.then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e).to.equal(err)
        );
      });

      it('should capture rejected promise', function() {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.returns(Promise.reject(err));

        return ctx.then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e).to.equal(err)
        );
      });

    });

    describe('catch', function() {

      it('should capture exceptions', function() {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.throws(err);

        return ctx.catch(e => Promise.reject(e)).then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e).to.equal(err)
        );
      });

      it('should capture rejected promise', function() {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.returns(Promise.reject(err));

        return ctx.catch(e => Promise.reject(e)).then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e).to.equal(err)
        );
      });

    });

    describe('ok', function() {

      it('should return a thenable object', function(done) {
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.ok().then(
          () => done(),
          done
        );
      });

      it('should report error', function(done) {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.throws(err);

        ctx.ok().then(
          () => done(new Error('unexpected')),
          e => {
            expect(e.original).to.equal(err);
            done();
          }
        );
      });

      it('should report error with custom message', function(done) {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.throws(err);

        ctx.ok({msg: 'foo bar fails'}).then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e.toString()).to.contain('foo bar fails')
        ).then(
          () => done(),
          done
        );
      });

      it('should report error with original error stack', function(done) {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.throws(err);

        ctx.ok().then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e.toString()).to.contain(err.stack)
        ).then(
          () => done(),
          done
        );
      });

      it('should report error with original error string if it has no stack', function(done) {
        const err = {toString: () => 'some error with no stack'};
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.throws(err);

        ctx.ok().then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e.toString()).to.contain(err.toString())
        ).then(
          () => done(),
          done
        );
      });

      it('should report completion via a callback', function(done) {
        const ctx = context.create({rules, driver}).set('foo/bar');
        const cb = ce => {
          try {
            expect(ce).to.be.be.undefined();
            done();
          } catch (e) {
            done(e);
          }
        };

        ctx.ok({done: cb});
      });

      it('should report error via a callback', function(done) {
        const err = new Error();
        const ctx = context.create({rules, driver}).set('foo/bar');
        const cb = ce => {
          try {
            expect(ce).to.be.an('error');
            expect(ce.original).to.equal(err);
            done();
          } catch (e) {
            done(e);
          }
        };

        ctx.driver.exec.throws(err);

        ctx.ok({done: cb});
      });

    });

    describe('shouldFail', function() {

      it('should return a thenable object', function(done) {
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.driver.exec.throws();

        ctx.shouldFail().then(
          () => done(),
          done
        );
      });

      it('should report error if the sequence completes', function(done) {
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.shouldFail().then(
          () => done(new Error('unexpected')),
          () => done()
        );
      });

      it('should report the completion error with a custom message', function(done) {
        const ctx = context.create({rules, driver}).set('foo/bar');

        ctx.shouldFail({msg: 'foo bar succeeded!!!'}).then(
          () => Promise.reject(new Error('unexpected')),
          e => expect(e.toString()).to.contain('foo bar succeeded!!!')
        ).then(
          () => done(),
          done
        );
      });

      it('should report via a callback', function(done) {
        const ctx = context.create({rules, driver}).set('foo/bar');
        const cb = ce => {
          try {
            expect(ce).to.be.be.undefined();
            done();
          } catch (e) {
            done(e);
          }
        };

        ctx.driver.exec.throws();

        ctx.shouldFail({done: cb});
      });

      it('should report completion error via a callback', function(done) {
        const ctx = context.create({rules, driver}).set('foo/bar');
        const cb = ce => {
          try {
            expect(ce).to.be.an('error');
            done();
          } catch (e) {
            done(e);
          }
        };

        ctx.shouldFail({done: cb});
      });

    });

  });

});
