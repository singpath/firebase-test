'use strict';

const FirebaseTokenGenerator = require('firebase-token-generator');
const restFirebase = require('rest-firebase');
const rxFirebase = require('rx-firebase');

/**
 * Chainable test suite context.
 *
 * Keep track of of the current user and authenticate it.
 *
 */
exports.Context = class Context {

  constructor(suite, chain, currentUser) {
    this.suite = suite;
    this.chain = chain || Promise.resolve();
    this.currentUser = currentUser || {};
  }

  firebase() {
    throw new Error('not implemented');
  }

  startWith(seed) {
    return this.asAdmin().set('/', seed || null).asGuest();
  }

  with(opts) {
    return new this.constructor(
      this.suite,
      (opts && opts.chain) || this.chain,
      (opts && opts.currentUser) || this.currentUser
    );
  }

  then(onSucess, onError) {
    this.chain = this.chain.then(
      prev => ({ctx: this, prev})
    ).then(onSucess, onError);

    return this;
  }

  catch(fn) {
    this.chain = this.chain.catch(fn);

    return this;
  }

  ok(done) {
    const onSuccess = result => {
      if (done) {
        done();
      }

      return result;
    };
    const onError = err => {
      if (done) {
        done(err);
      }

      return Promise.reject(err);
    };

    return this.chain.then(onSuccess, onError);
  }

  shouldFail(done) {
    const onSuccess = () => {
      const err = new Error('Operation should have failed');

      if (done) {
        done(err);
      }

      return Promise.reject(err);
    };
    const onError = () => done && done();

    return this.chain.then(onSuccess, onError);
  }

  as(uid, opts, debug) {
    if (!uid) {
      return this.asGuest();
    }

    const currentUser = this.suite.token(uid, opts, {debug: debug || false});

    return this.with({currentUser});
  }

  asAdmin() {
    const currentUser = this.suite.token('DB Admin', undefined, {admin: true});

    return this.with({currentUser});
  }

  asGuest() {
    return this.with({currentUser: {}});
  }

  get() {
    return Promise.reject(new Error('not implemented'));
  }

  set(paths, value) {
    return this.then(() => this.firebase(paths).set(value));
  }

  update(paths, data) {
    return this.then(() => this.firebase(paths).update(data));
  }

  push(paths, value) {
    return this.then(() => this.firebase(paths).push(value));
  }

  remove(paths) {
    return this.then(() => this.firebase(paths).remove());
  }
};

exports.RestContext = class RestContext extends exports.Context {

  firebase(paths) {
    const auth = this.currentUser && this.currentUser.token;

    return this.suite.req({paths, auth});
  }

  get(paths) {
    return this.then(() => this.firebase(paths).get());
  }
};

exports.SocketContext = class SocketContext extends exports.Context {

  firebase(paths) {
    return this.suite.ref({paths});
  }

  as(uid, opts, debug) {
    if (!uid) {
      return this.asGuest();
    }

    return super.as(uid, opts, debug).then(
      e => e.ctx.suite.ref().authWithCustomToken(e.ctx.currentUser.token)
    );
  }

  asAdmin() {
    return super.asAdmin().then(
      e => e.ctx.suite.ref().authWithCustomToken(e.ctx.currentUser.token)
    );
  }

  asGuest() {
    return super.asGuest().then(
      e => e.ctx.suite.ref().unauth()
    );
  }

  get(paths) {
    return this.then(() => this.firebase(paths).once('value'));
  }
};

/**
 * Test suite helper for firebase base e2e tests.
 *
 * Usage:
 *
 *    let suite, seed;
 *
 *    beforeEach(function() {
 *      suite = new Suite({firebaseId, firebaseSecret});
 *      seed = {users: {bob: {private: 'data'}, alice: {private: 'data'}}};
 *    });
 *
 *    it('should allow bob to read his data', function() {
 *      return suite.startWith(seed).as('bob').get('/users/bob').ok();
 *    });
 *
 *    it('should not allow bob to read someone else data', function() {
 *      return suite.startWith(seed).as('bob').get('/users/alice').shouldFail();
 *    });
 *
 * Note that firebase websocket client uses a singleton pattern and only one user
 * can be authenticated at one point. It will be slower, but you can use the a
 * rest operation to similate concurent request from different users:
 *
 *    it('should work with concurrent requests', function(done) {
 *      return suite.rest().startWith(seed).then(e => Promise.all([
 *        e.ctx.as('bob').get('/users/bob').ok(),
 *        e.ctx.as('alice').get('/users/bob').shouldFail();
 *      ]);
 *    });
 *
 */
exports.Suite = class Suite {

  constructor(opts) {
    if (!opts || !opts.firebaseId || !opts.firebaseSecret) {
      throw new Error('The test suite requires the firebase credentials');
    }

    this.rxFirebase = rxFirebase.factory(opts.firebaseId);
    this.restFirebase = restFirebase.factory(opts.firebaseId);
    this.generator = new FirebaseTokenGenerator(opts.firebaseSecret);
    this.defaultAuthData = opts.defaultAuthData || {};
  }

  req(opts) {
    opts = opts || {};

    return this.restFirebase(opts);
  }

  ref(opts) {
    return this.rxFirebase(opts && opts.paths);
  }

  token(uid, opts, tokenOpts) {
    const data = Object.assign(
      {}, this.defaultAuthData, opts, {uid}
    );
    const token = this.generator.createToken(data, tokenOpts);

    return {uid, data, token};
  }

  rest() {
    return new exports.RestContext(this);
  }

  socket() {
    return new exports.SocketContext(this);
  }

  startWith(seed) {
    return this.socket().startWith(seed);
  }
};

/**
 * Create a new test suite.
 *
 * Note that will patch console to remove Firebase warnings.
 *
 * Options:
 *
 * - `firebaseId` (String, required) of the Firebase db the rules are tested
 *   on; the content is being reset when `with(seedData)` is called.
 * - `firebaseSecret` (String, required) Firebase Auth secret of the db the
 *   rules are tested on.
 * - `defaultAuthData` (Object, default to an empty object) defaults auth
 *   data when authenticating a user.
 *
 * @param  {Object} opts  TestSuite options; must include `firebaseId` and
 *                        `firebaseSecret` fields.
 * @return {Suite}
 */
exports.factory = opts => new exports.Suite(opts);
