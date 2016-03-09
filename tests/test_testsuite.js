'use strict';

const expect = require('expect.js');
const sinon = require('sinon');
const FirebaseTokenGenerator = require('firebase-token-generator');
const assert = sinon.assert;
const match = sinon.match;
const stub = sinon.stub;
const restFirebase = require('rest-firebase');
const rxFirebase = require('rx-firebase');

const testSuite = require('../');

describe('Suite', function() {

  beforeEach(function() {
    sinon.stub(restFirebase, 'factory');
    sinon.stub(rxFirebase, 'factory');
  });

  afterEach(function() {
    restFirebase.factory.restore();
    rxFirebase.factory.restore();
  });

  it('should throw if the firebase id is missing', function() {
    expect(() => {
      testSuite.factory({
        firebaseSecret: 'xxx'
      });
    }).to.throwError();
  });

  it('should throw if the firebase secret is missing', function() {
    expect(() => {
      testSuite.factory({
        firebaseId: 'some-id'
      });
    }).to.throwError();
  });

  it('should instantiate a token generator', function() {
    const suite = testSuite.factory({
      firebaseId: 'some-id',
      firebaseSecret: 'xxx'
    });

    expect(suite.generator).to.be.an(FirebaseTokenGenerator);
    expect(suite.generator.mSecret).to.be('xxx');
  });

  it('should set rxFirebase', function() {
    const id = 'some-id';
    const factory = {};

    rxFirebase.factory.withArgs(id).returns(factory);

    const suite = testSuite.factory({
      firebaseId: id,
      firebaseSecret: 'xxx'
    });

    expect(suite.rxFirebase).to.be(factory);
  });

  it('should set restFirebase', function() {
    const id = 'some-id';
    const factory = {};

    restFirebase.factory.withArgs(id).returns(factory);

    const suite = testSuite.factory({
      firebaseId: id,
      firebaseSecret: 'xxx'
    });

    expect(suite.restFirebase).to.be(factory);
  });

  describe('req', function() {
    let suite;

    beforeEach(function() {
      suite = testSuite.factory({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      suite.restFirebase = sinon.stub();
    });

    it('should return a rest firebase reference', function() {
      const opts = {};
      const ref = {};

      suite.restFirebase.withArgs(opts).returns(ref);
      expect(suite.req(opts)).to.be(ref);
    });

    it('should reference the db root by default', function() {
      const ref = {};

      suite.restFirebase.withArgs(
        sinon.match(v => !v || !v.paths || v.paths === '/')
      ).returns(ref);

      expect(suite.req()).to.be(ref);
    });
  });

  describe('ref', function() {
    let suite;

    beforeEach(function() {
      suite = testSuite.factory({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });

      suite.rxFirebase = sinon.stub();
    });

    it('should return a rest firebase reference', function() {
      const opts = {paths: 'foo/bar'};
      const ref = {};

      suite.rxFirebase.withArgs(opts.paths).returns(ref);
      expect(suite.ref(opts)).to.be(ref);
    });

    it('should reference the db root by default', function() {
      const ref = {};

      suite.rxFirebase.withArgs(
        sinon.match(v => !v || !v.paths || v.paths === '/')
      ).returns(ref);

      expect(suite.ref()).to.be(ref);
    });
  });

  describe('token', function() {
    let suite, token;

    beforeEach(function() {
      token = 'some-token';
      suite = testSuite.factory({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx',
        defaultAuthData: {
          isModerator: false
        }
      });

      suite.generator = {createToken: stub().returns(token)};
    });

    it('should generate a new token for the user id', function() {
      expect(suite.token('bob').token).to.be(token);
      assert.calledOnce(suite.generator.createToken);
      assert.calledWithExactly(
        suite.generator.createToken,
        match({uid: 'bob'}),
        undefined
      );
    });

    it('should set default auth data', function() {
      suite.token('bob');
      assert.calledWithExactly(
        suite.generator.createToken,
        match({
          uid: 'bob',
          isModerator: false
        }),
        undefined
      );
    });

    it('should allow auth data to be set', function() {
      suite.token('bob', {'isModerator': true, displayName: 'Bob'});
      assert.calledWithExactly(
        suite.generator.createToken,
        match({
          uid: 'bob',
          isModerator: true,
          displayName: 'Bob'
        }),
        undefined
      );
    });

    it('should not debug rules by default', function() {
      suite.token('bob');
      assert.calledWithExactly(
        suite.generator.createToken,
        match.object,
        match(arg => !arg || !arg.debug)
      );
    });

    it('should allow to debug rules', function() {
      suite.token('bob', undefined, {debug: true});
      assert.calledWithExactly(
        suite.generator.createToken,
        match.object,
        match({
          debug: true
        })
      );
    });

    it('should not create an admin token', function() {
      suite.token('bob');
      assert.calledWithExactly(
        suite.generator.createToken,
        match.object,
        match(arg => !arg || !arg.admin)
      );
    });

  });

  describe('rest', function() {
    let suite;

    beforeEach(function() {
      suite = testSuite.factory({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });
    });

    it('should return a RestContext', function() {
      expect(suite.rest()).to.be.a(testSuite.RestContext);
    });

    it('should reference the test suite', function() {
      expect(suite.rest().suite).to.be(suite);
    });

    it('should have no current user', function() {
      expect(suite.rest().currentUser.token).to.be(undefined);
    });

  });

  describe('socket', function() {
    let suite;

    beforeEach(function() {
      suite = testSuite.factory({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });
    });

    it('should return a SocketContext', function() {
      expect(suite.socket()).to.be.a(testSuite.SocketContext);
    });

    it('should reference the test suite', function() {
      expect(suite.socket().suite).to.be(suite);
    });

    it('should have no current user', function() {
      expect(suite.socket().currentUser.token).to.be(undefined);
    });

  });

  describe('startWith', () => {
    let suite, ctx;

    beforeEach(() => {
      suite = testSuite.factory({
        firebaseId: 'some-id',
        firebaseSecret: 'xxx'
      });
      ctx = {startWith: sinon.stub().returnsThis()};
      sinon.stub(suite, 'socket').returns(ctx);
    });

    it('should return a SocketContext object', () => {
      expect(suite.startWith()).to.be(ctx);
    });

    it('should setup the db', function() {
      const data = {};

      suite.startWith(data);
      sinon.assert.calledOnce(ctx.startWith);
      sinon.assert.calledWithExactly(ctx.startWith, data);
    });

  });

});
