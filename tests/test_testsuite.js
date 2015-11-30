'use strict';

const expect = require('expect.js');
const sinon = require('sinon');
const FirebaseTokenGenerator = require('firebase-token-generator');
const assert = sinon.assert;
const match = sinon.match;
const spy = sinon.spy;
const stub = sinon.stub;

const testSuite = require('..').testSuite;
const Context = require('../src/testsuite').Context;
const wait = require('./utils').wait;


describe('TestSuite', () => {
  let warn;

  beforeEach(() => {
    /*eslint no-console: 0*/
    warn = console.warn;
  });

  afterEach(() => {
    /*eslint no-console: 0*/
    console.warn = warn;
  });

  it('should throw if the firebase id is missing', () => {
    expect(() => {
      testSuite({
        firebaseSecret: 'xxx'
      });
    }).to.throwError();
  });

  it('should throw if the firebase secret is missing', () => {
    expect(() => {
      testSuite({
        firebaseId: 'some-id'
      });
    }).to.throwError();
  });

  it('should instantiate a token generator', () => {
    const suite = testSuite({
      firebaseId: 'some-id',
      firebaseSecret: 'xxx'
    });

    expect(suite.generator).to.be.an(FirebaseTokenGenerator);
    expect(suite.generator.mSecret).to.be('xxx');
  });

  it('should patch console.warn', () => {
    testSuite({
      firebaseId: 'some-id',
      firebaseSecret: 'xxx'
    });

    expect(console.warn).not.to.be(warn);
  });

  describe('warn', () => {
    let fakeWarn;

    beforeEach(() => {
      fakeWarn = console.warn = spy();

      testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });
    });

    it('should filter Firebase warning', () => {
      console.warn('FIREBASE WARNING: you should filter me');
      assert.notCalled(fakeWarn);
    });

    it('should not filter other warning', () => {
      console.warn('you should not filter me');
      assert.calledOnce(fakeWarn);
    });
  });

  describe('restore', function() {

    it('should restore the correct warn function', () => {
      const fakeWarn = console.warn = () => undefined;
      const suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      suite.restore();
      expect(console.warn).to.be(fakeWarn);
    });

  });

  describe('refPath', () => {

    it('should build the path to firebase element from a string', () => {
      const suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      expect(suite.refPath('foo/bar')).to.be('https://some-id.firebaseio.com/foo/bar');
    });

    it('should build the path to firebase element from an array', () => {
      const suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      expect(suite.refPath(['foo', 'bar'])).to.be('https://some-id.firebaseio.com/foo/bar');
    });

  });

  describe('token', () => {
    let suite;

    beforeEach(() => {
      suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx',
        defaultAuthData: {
          isModerator: false
        }
      });

      suite.generator = {createToken: stub().returns('some-token')};
    });

    it('should generate a new token for the user id', () => {
      expect(suite.token('bob')).to.be('some-token');
      assert.calledOnce(suite.generator.createToken);
      assert.calledWithExactly(
        suite.generator.createToken,
        match.has('uid', 'bob'),
        match.object
      );
    });

    it('should set default auth data', () => {
      suite.token('bob');
      assert.calledWithExactly(
        suite.generator.createToken,
        match({
          uid: 'bob',
          isModerator: false
        }),
        match.object
      );
    });

    it('should allow auth data to be set', () => {
      suite.token('bob', {'isModerator': true, displayName: 'Bob'});
      assert.calledWithExactly(
        suite.generator.createToken,
        match({
          uid: 'bob',
          isModerator: true,
          displayName: 'Bob'
        }),
        match.object
      );
    });

    it('should not debug rules by default', () => {
      suite.token('bob');
      assert.calledWithExactly(
        suite.generator.createToken,
        match.object,
        match(arg => !arg || !arg.debug)
      );
    });

    it('should allow to debug rules', () => {
      suite.token('bob', undefined, true);
      assert.calledWithExactly(
        suite.generator.createToken,
        match.object,
        match({
          debug: true
        })
      );
    });

    it('should not create an admin token', () => {
      suite.token('bob');
      assert.calledWithExactly(
        suite.generator.createToken,
        match.object,
        match(arg => !arg || !arg.admin)
      );
    });

  });

  describe('login', () => {
    let suite, ref;

    beforeEach(() => {
      suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      ref = {authWithCustomToken: spy()};
      suite.ref = stub().returns(ref);
      suite.token = stub().returns('some-token');
    });

    it('should request a token', () => {
      const authData = {};

      suite.login('bob', authData, true);
      assert.calledOnce(suite.token);
      assert.calledWithExactly(suite.token, 'bob', authData, true);
    });

    it('should return a promise', () => {
      expect(suite.login('bob').then).to.be.ok();
    });

    it('should query a Firebase reference for firebase db', () => {
      suite.login('bob');
      assert.calledOnce(suite.ref);
      assert.calledWithExactly(suite.ref);
    });

    it('should authenticate the user with the requested token', () => {
      suite.login('bob');
      assert.calledOnce(ref.authWithCustomToken);
      assert.calledWithExactly(ref.authWithCustomToken, 'some-token', match.func);
    });

    it('should resolve the promise with the auth data', done => {
      const promise = suite.login('bob');
      const cb = ref.authWithCustomToken.lastCall.args[1];
      const authData = {};

      cb(null, authData);
      promise.then(
        results => expect(results).to.be(authData)
      ).then(
        () => done(),
        done
      );
    });

    it('should resolve the promise in a rejected state if auth failed', done => {
      const promise = suite.login('bob');
      const cb = ref.authWithCustomToken.lastCall.args[1];
      const err = new Error();

      cb(err);
      promise.then(
        () => done(new Error('Should not be fulfilled')),
        e => expect(e).to.be(err)
      ).then(
        () => done(),
        done
      );
    });

  });

  describe('logAsAdmin', () => {
    let suite, ref;

    beforeEach(() => {
      suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      ref = {authWithCustomToken: spy()};
      suite.ref = stub().returns(ref);
      suite.generator = {createToken: stub().returns('some-token')};
    });

    it('should generate an admin token', () => {
      suite.logAsAdmin();
      assert.calledOnce(suite.generator.createToken);
      assert.calledWithExactly(
        suite.generator.createToken,
        match.object,
        match({admin: true})
      );
    });

    it('should return a promise', () => {
      expect(suite.logAsAdmin().then).to.be.ok();
    });

    it('should query a Firebase reference for firebase db', () => {
      suite.logAsAdmin();
      assert.calledOnce(suite.ref);
      assert.calledWithExactly(suite.ref);
    });

    it('should authenticate the user with the admin token', () => {
      suite.logAsAdmin();
      assert.calledOnce(ref.authWithCustomToken);
      assert.calledWithExactly(ref.authWithCustomToken, 'some-token', match.func);
    });

    it('should resolve the promise when user is authenticated as admin', done => {
      const promise = suite.logAsAdmin();
      const cb = ref.authWithCustomToken.lastCall.args[1];
      const authData = {};

      cb(null, authData);
      promise.then(
        results => expect(results).to.be(authData)
      ).then(
        () => done(),
        done
      );
    });

    it('should resolve the promise in a rejected state if auth failed', done => {
      const promise = suite.logAsAdmin();
      const cb = ref.authWithCustomToken.lastCall.args[1];
      const err = new Error();

      cb(err);
      promise.then(
        () => done(new Error('Should not be fulfilled')),
        e => expect(e).to.be(err)
      ).then(
        () => done(),
        done
      );
    });

  });

  describe('logout', () => {
    let suite, ref;

    beforeEach(() => {
      suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      ref = {unauth: spy()};
      suite.ref = stub().returns(ref);
    });

    it('should query a Firebase reference for firebase db', () => {
      suite.logout();
      assert.calledOnce(suite.ref);
      assert.calledWithExactly(suite.ref);
    });

    it('should un-authenticate the user', () => {
      suite.logout();
      assert.calledOnce(ref.unauth);
    });

  });

  describe('with', () => {
    let suite, ref, login;

    beforeEach(() => {
      suite = testSuite({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      ref = {set: spy()};
      suite.ref = stub().returns(ref);
      suite.logAsAdmin = stub().returns(new Promise(resolve => login = resolve));
      suite.logout = spy();
    });

    it('should return a Context object', () => {
      expect(suite.with()).to.be.an(Context);
    });

    it('should login as admin', () => {
      suite.with();
      assert.calledOnce(suite.logAsAdmin);
    });

    it('should set initial state once logged in', done => {
      const init = {};
      suite.with(init);
      assert.notCalled(suite.ref);

      login({});
      wait().then(() => {
        assert.calledOnce(suite.ref);
        assert.calledWithExactly(suite.ref);

        assert.calledOnce(ref.set);
        assert.calledWithExactly(ref.set, init, match.func);
      }).then(
        () => done(),
        done
      );
    });

    it('should logout once the initial state is set', done => {
      const init = {};
      suite.with(init);
      assert.notCalled(suite.ref);

      login({});
      wait().then(() => {
        const setCallback = ref.set.lastCall.args[1];

        assert.notCalled(suite.logout);
        setCallback(null);
        return wait();
      }).then(
        () => assert.calledOnce(suite.logout)
      ).then(
        () => done(),
        done
      );
    });

    it('should resolve returned promise once the admin is logged out', done => {
      suite.with({}).then(
        () => assert.calledOnce(suite.logout)
      ).then(
        () => done(),
        done
      );

      login({});
      wait().then(() => {
        const setCallback = ref.set.lastCall.args[1];
        setCallback(null);
      });
    });
  });

});
