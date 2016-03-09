'use strict';

const expect = require('expect.js');
const sinon = require('sinon');
const assert = sinon.assert;
const match = sinon.match;
const stub = sinon.stub;

const testSuite = require('../src');

describe('Context', function() {
  let ctx;

  beforeEach(function() {
    ctx = new testSuite.Context({});
  });

  it('should not implement firebase', function() {
    expect(() => ctx.firebase({paths: '/foo'})).to.throwError();
  });

  it('should not implement get', function() {
    return ctx.get('/foo').then(
      () => Promise.reject(new Error('unexpected')),
      err => expect(err.message).to.be('not implemented')
    );
  });

  describe('startWith', function() {
    let ctx;

    beforeEach(function() {
      ctx = new testSuite.Context();
      sinon.stub(ctx, 'asAdmin').returnsThis();
      sinon.stub(ctx, 'set').returnsThis();
      sinon.stub(ctx, 'asGuest').returnsThis();
    });

    it('should login as admin', function() {
      return ctx.startWith().then(() => {
        sinon.assert.calledOnce(ctx.asAdmin);
      });
    });

    it('should then set the seed', function() {
      const data = {};
      return ctx.startWith(data).then(() => {
        sinon.assert.calledOnce(ctx.set);
        sinon.assert.calledWith(ctx.set, '/', data);
        sinon.assert.callOrder(ctx.asAdmin, ctx.set);
      });
    });

    it('should finnaly log user off', function() {
      return ctx.startWith().then(() => {
        sinon.assert.calledOnce(ctx.asGuest);
        sinon.assert.callOrder(ctx.asAdmin, ctx.set, ctx.asGuest);
      });
    });
  });

  describe('with', function() {
    let ctx;

    beforeEach(function() {
      ctx = new testSuite.Context({});
    });

    it('should create a copy of the context', function() {
      const newCtx = ctx.with();

      expect(newCtx).not.to.be(ctx);
      expect(newCtx.chain).to.be(ctx.chain);
      expect(newCtx.suite).to.be(ctx.suite);
      expect(newCtx.currentUser).to.be(ctx.currentUser);
    });

    it('should allow update the current user', function() {
      const currentUser = {};
      const newCtx = ctx.with({currentUser});

      expect(newCtx.currentUser).to.be(currentUser);
      expect(newCtx.currentUser).not.to.be(ctx.currentUser);
    });

    it('should allow update the chain', function() {
      const chain = Promise.resolve();
      const newCtx = ctx.with({chain});

      expect(newCtx.chain).to.be(chain);
      expect(newCtx.chain).not.to.be(ctx.chain);
    });

    it('should not update the suite', function() {
      const suite = {};
      const newCtx = ctx.with({suite});

      expect(newCtx.suite).not.to.be(suite);
      expect(newCtx.suite).to.be(ctx.suite);
    });

  });

  describe('then', function() {
    let ctx, chain, start, fails;

    beforeEach(() => {
      chain = new Promise((resolve, reject) => {
        start = resolve;
        fails = reject;
      });

      ctx = new testSuite.Context({}, chain);
    });

    it('should chain cbs', function() {
      start();

      ctx.then(() => {
        return 1;
      }).then(e => {
        expect(e.prev).to.be(1);
        return 2;
      }).then(e => {
        expect(e.prev).to.be(2);
      });
    });

    it('should catch reject promise', function() {
      fails();

      return ctx.then(
        () => new Error('Should not be called'),
        () => undefined
      );
    });

    it('should recover the chain from failure', function() {
      fails();

      ctx.then(
        () => new Error('Should not be called'),
        () => undefined
      );

      return ctx;
    });
  });

  describe('catch', () => {
    let ctx, fails;

    beforeEach(function() {
      const chain = new Promise((_, reject) => {
        fails = reject;
      });

      ctx = new testSuite.Context({}, chain);
    });

    it('should catch reject promise', function() {
      fails();

      return ctx.catch(() => undefined);
    });

    it('should recover the chain from failure', function() {
      fails();
      ctx.catch(() => undefined);

      return ctx;
    });

  });

  describe('ok', function() {

    it('should test the chain resolve fulfilled', function() {
      return new testSuite.Context({}, Promise.resolve()).ok();
    });

    it('should test the chain resolve rejected', function() {
      const err = new Error();

      return new testSuite.Context({}, Promise.reject(err)).ok().then(
        () => Promise.reject(new Error('unexpected')),
        e => expect(e).to.be(err)
      );
    });

    it('should call the callback function on success', function() {
      const done = sinon.spy();

      return new testSuite.Context({}, Promise.resolve()).ok(done).then(() => {
        sinon.assert.calledOnce(done);
        sinon.assert.calledWithExactly(done);
      });
    });

    it('should call the callback on failure', function() {
      const err = new Error();
      const done = sinon.spy();

      return new testSuite.Context({}, Promise.reject(err)).ok(done).then(
        () => Promise.reject(new Error('unexpected')),
        () => {
          sinon.assert.calledOnce(done);
          sinon.assert.calledWithExactly(done, err);
        }
      );
    });

  });

  describe('shouldFail', function() {

    it('should test the chain resolve rejected', function() {
      return new testSuite.Context({}, Promise.reject(new Error())).shouldFail();
    });

    it('should test the chain resolve fulfilled', function() {
      return new testSuite.Context({}, Promise.resolve()).shouldFail().then(
        () => Promise.reject(new Error('unexpected')),
        () => undefined
      );
    });

    it('should call the callback function on success', function() {
      const done = sinon.spy();

      return new testSuite.Context({}, Promise.reject()).shouldFail(done).then(() => {
        sinon.assert.calledOnce(done);
        sinon.assert.calledWithExactly(done);
      });
    });

    it('should call the callback function on failure', function() {
      const done = sinon.spy();

      return new testSuite.Context({}, Promise.resolve()).shouldFail(done).then(
        () => Promise.reject(new Error('unexpected')),
        err => {
          sinon.assert.calledOnce(done);
          sinon.assert.calledWithExactly(done, err);
        }
      );
    });

  });

  describe('as', function() {
    let suite, ctx, token;

    beforeEach(function() {
      token = 'some-token';
      suite = {token: sinon.stub().returns({token})};
      ctx = new testSuite.Context(suite);
    });

    it('should copy the ctx', function() {
      const uid = 'bob';
      const data = {isModerator: true};
      const debug = true;
      const newCtx = ctx.as(uid, data, debug);

      expect(newCtx).not.to.be(ctx);

      return newCtx.then(e => expect(e.ctx).to.be(newCtx));
    });

    it('should reset the current user if no uid is given', function() {
      return ctx.as().then(e => {
        expect(e.ctx.currentUser).to.eql({});
      });
    });

    it('should create a token', function() {
      const uid = 'bob';
      const data = {isModerator: true};
      const debug = true;

      return ctx.as(uid, data, debug).then(() => {
        assert.calledOnce(suite.token);
        assert.calledWith(suite.token, uid, data, match({debug}));
      });
    });

    it('should switch the current user', function() {
      const uid = 'bob';
      const data = {isModerator: true};
      const debug = true;

      return ctx.as(uid, data, debug).then(e => {
        expect(e.ctx.currentUser.token).to.be(token);
      });
    });

    it('should set debug to false by default', function() {
      const uid = 'bob';
      const data = {isModerator: true};

      return ctx.as(uid, data).then(e => {
        expect(e.ctx.currentUser.token).to.be(token);
        assert.calledOnce(suite.token);
        assert.calledWith(suite.token, uid, data, match(v => !v || !v.debug));
      });
    });
  });

  describe('asAdmin', function() {
    let suite, ctx, token;

    beforeEach(function() {
      token = 'some-token';
      suite = {token: sinon.stub().returns({token})};
      ctx = new testSuite.Context(suite);
    });

    it('should copy the ctx', function() {
      const newCtx = ctx.asAdmin();

      expect(newCtx).not.to.be(ctx);

      return newCtx.then(e => expect(e.ctx).to.be(newCtx));
    });

    it('should create an admin token', function() {
      return ctx.asAdmin().then(() => {
        assert.calledOnce(suite.token);
        assert.calledWith(suite.token, match.string, undefined, match(
          v => v.admin === true && !v.debug
        ));
      });
    });

    it('should switch the current user', function() {
      return ctx.asAdmin().then(e => {
        expect(e.ctx.currentUser.token).to.be(token);
      });
    });

  });

  describe('asGuest', function() {
    let ctx;

    beforeEach(function() {
      ctx = new testSuite.Context({});
    });

    it('should copy the ctx', function() {
      const newCtx = ctx.asGuest();

      expect(newCtx).not.to.be(ctx);

      return newCtx.then(e => expect(e.ctx).to.be(newCtx));
    });

    it('should reset the current user', function() {
      return ctx.asGuest().then(e => {
        expect(e.ctx.currentUser).to.eql({});
      });
    });
  });
});

describe('RestContext', function() {

  describe('firebase', function() {
    let ctx, suite, req;

    beforeEach(function() {
      req = sinon.stub();
      suite = {req};

      ctx = new testSuite.RestContext(suite);
    });

    it('should return a REST Firebase reference', function() {
      const expected = {};
      const paths = 'foo/bar';

      req.withArgs(sinon.match({paths})).returns(expected);

      expect(ctx.firebase(paths)).to.be(expected);
    });

    it('should create REST Firebase reference with the auth token', function() {
      const expected = {};
      const paths = 'foo/bar';
      const auth = 'some-token';

      ctx.currentUser.token = auth;
      req.withArgs(sinon.match({paths, auth})).returns(expected);

      expect(ctx.firebase(paths)).to.be(expected);
    });

  });

  describe('get', function() {
    let ctx;

    beforeEach(function() {
      ctx = new testSuite.RestContext({});
      sinon.stub(ctx, 'firebase');
    });

    it('should query a path', function() {
      const paths = 'foo/bar';
      const resp = {};
      const ref = {get: sinon.stub().returns(Promise.resolve(resp))};

      ctx.firebase.withArgs(paths).returns(ref);

      return ctx.get(paths).then(e => expect(e.prev).to.be(resp));
    });
  });

});

describe('SocketContext', () => {

  describe('firebase', function() {
    let ctx, suite, ref;

    beforeEach(function() {
      ref = sinon.stub();
      suite = {ref};

      ctx = new testSuite.SocketContext(suite);
    });

    it('should return a Rx Firebase reference', function() {
      const expected = {};
      const paths = 'foo/bar';

      ref.withArgs(sinon.match({paths})).returns(expected);

      expect(ctx.firebase(paths)).to.be(expected);
    });

  });

  describe('as', () => {
    let ctx, suite;

    beforeEach(() => {
      suite = {};
      ctx = new testSuite.SocketContext(suite);
    });

    it('should log user in', function() {
      const uid = 'bob';
      const data = {isModerator: true};
      const debug = true;
      const token = 'some-token';
      const authWithCustomToken = sinon.stub().returns(Promise.resolve());

      suite.token = sinon.stub().returns({token});
      suite.ref = sinon.stub().returns({authWithCustomToken});

      return ctx.as(uid, data, debug).then(e => {
        expect(e.ctx.currentUser.token).to.be(token);
        assert.calledOnce(authWithCustomToken);
        assert.calledWith(authWithCustomToken, token);
      });
    });

    it('should log user off if uid is missing', function() {
      const unauth = sinon.spy();
      suite.ref = sinon.stub().returns({unauth});

      return ctx.as().then(e => {
        expect(e.ctx.currentUser).to.eql({});
        sinon.assert.calledOnce(unauth);
      });
    });
  });

  describe('asAdmin', () => {
    let ctx, suite;

    beforeEach(() => {
      suite = {};
      ctx = new testSuite.SocketContext(suite);
    });

    it('should log user in', function() {
      const token = 'some-token';
      const authWithCustomToken = sinon.stub().returns(Promise.resolve());

      suite.token = sinon.stub().returns({token});
      suite.ref = sinon.stub().returns({authWithCustomToken});

      return ctx.asAdmin().then(e => {
        expect(e.ctx.currentUser.token).to.be(token);
        assert.calledOnce(authWithCustomToken);
        assert.calledWith(authWithCustomToken, token);
      });
    });
  });

  describe('asGuest', function() {
    let ctx, suite;

    beforeEach(() => {
      suite = {};
      ctx = new testSuite.SocketContext(suite);
    });

    it('should log user off', function() {
      const unauth = sinon.spy();
      suite.ref = sinon.stub().returns({unauth});

      return ctx.asGuest().then(e => {
        expect(e.ctx.currentUser).to.eql({});
        sinon.assert.calledOnce(unauth);
      });
    });
  });

  describe('get', function() {
    let ctx, suite;

    beforeEach(function() {
      suite = {};
      ctx = new testSuite.SocketContext(suite);
    });

    it('should query a Firebase reference for the requested path', function() {
      const paths = 'foo';
      const snapshot = {};
      const ref = {once: sinon.stub().returns(Promise.resolve(snapshot))};

      suite.ref = stub().returns(ref);

      return ctx.get(paths).then(() => {
        assert.calledOnce(suite.ref);
        assert.calledWith(suite.ref, match({paths}));
      });
    });

    it('should query the value at the path', function() {
      const paths = 'foo';
      const snapshot = {};
      const ref = {once: sinon.stub().returns(Promise.resolve(snapshot))};

      suite.ref = stub().returns(ref);

      return ctx.get(paths).then(e => {
        assert.calledOnce(ref.once);
        assert.calledWithExactly(ref.once, 'value');
        expect(e.prev).to.be(snapshot);
      });
    });

  });

  ['set', 'update', 'push'].forEach(meth => {
    describe(meth, function() {
      let ctx, suite;

      beforeEach(function() {
        suite = {};
        ctx = new testSuite.SocketContext(suite);
      });

      it('should operates on the right reference', function() {
        const paths = 'foo';
        const snapshot = {};
        const ref = {[meth]: sinon.stub().returns(Promise.resolve(snapshot))};
        const data = {};

        suite.ref = stub().returns(ref);

        return ctx[meth](paths, data).then(() => {
          assert.calledOnce(suite.ref);
          assert.calledWith(suite.ref, match({paths}));
          assert.calledOnce(ref[meth]);
          assert.calledWith(ref[meth], data);
        });
      });
    });
  });

  describe('remove', function() {
    let ctx, suite;

    beforeEach(function() {
      suite = {};
      ctx = new testSuite.SocketContext(suite);
    });

    it('should operates on the right reference', function() {
      const paths = 'foo';
      const snapshot = {};
      const ref = {remove: sinon.stub().returns(Promise.resolve(snapshot))};

      suite.ref = stub().returns(ref);

      return ctx.remove(paths).then(() => {
        assert.calledOnce(suite.ref);
        assert.calledWith(suite.ref, match({paths}));
        assert.calledOnce(ref.remove);
        assert.calledWith(ref.remove);
      });
    });

  });

});
