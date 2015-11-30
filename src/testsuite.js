'use strict';

const Firebase = require('firebase');
const FirebaseTokenGenerator = require('firebase-token-generator');


/**
 * Used to chain operation on the Firebase DB.
 */
const Context = exports.Context = class Context {

  /**
   * @private
   */
  constructor(suite, chain) {
    this.suite = suite;
    this.chain = chain;
  }

  get currentUser() {
    return this.suite.currentUser;
  }

  /**
   * Chain any operation
   *
   * @param  {Function} onSucess
   * @param  {Function} onError
   * @return {Context}
   */
  then(onSucess, onError) {
    this.chain = this.chain.then(onSucess, onError);
    return this;
  }

  /**
   * Chain a recovery operation
   *
   * @param  {Function} fn
   * @return {Context}
   */
  catch(fn) {
    this.chain = this.chain.catch(fn);
    return this;
  }

  /**
   * Chain a Login operation
   *
   * @param  {String}  uid
   * @param  {Object}  opts  user auth data
   * @param  {Boolean} debug to enable debug output from your security rules
   * @return {Context}
   */
  as(uid, opts, debug) {
    if (!uid) {
      this.suite.logout();
      return this;
    }

    return this.then(() => this.suite.login(uid, opts, debug));
  }

  /**
   * Chain an operation to retrieve a value.
   *
   * @param  {String|Array|Firebase} path path to retrieve
   * @return {Context}
   */
  get(path) {
    return this.then(() => new Promise((resolve, reject) => {
      this.suite.ref(path).once('value', resolve, reject);
    }));
  }

  /**
   * Chain an operation to set a value.
   *
   * @param {String|Array|Firebase} path path to set
   * @param {Object} value
   * @return {Context}
   */
  set(path, value) {
    return this.then(() => new Promise((resolve, reject) => {
      this.suite.ref(path).set(value, makeCallback(resolve, reject));
    }));
  }

  /**
   * Chain an operation update a path.
   *
   * @param  {String|Array|Firebase} path path to update from
   * @param  {Object}                data
   * @return {Context}
   */
  update(ref, data) {
    return this.then(() => new Promise((resolve, reject) => {
      this.suite.ref(ref).update(data, makeCallback(resolve, reject));
    }));
  }

  /**
   * Chain an operation to push a new children to a path
   *
   * @param  {String|Array|Firebase} path path to push to
   * @param  {Object}                data
   * @return {Context}
   */
  push(ref, data) {
    return this.then(() => new Promise((resolve, reject) => {
      this.suite.ref(ref).push(data, makeCallback(resolve, reject));
    }));
  }

  /**
   * Chain operation to remove an element
   *
   * @param  {String|Array|Firebase} path path to element to remove
   * @return {Context}
   */
  remove(ref) {
    return this.then(() => new Promise((resolve, reject) => {
      this.suite.ref(ref).remove(makeCallback(resolve, reject));
    }));
  }

  /**
   * Test the chain resolves successfully.
   *
   * It call the done when the chain resolves. It will call it with undefined
   * if chain is fulfilled or with a new Error if is rejected.
   *
   * @param  {Function}  done
   * @return {undefined}
   */
  ok(done) {
    this.chain.then(
      () => done(),
      err => done(err)
    );
  }

  /**
   * Test the chain fails.
   *
   * It call the done when the chain resolves. It will call it with an error if
   * chain is fulfilled or with undefined if is rejected.
   *
   * @param  {Function}  done
   * @return {undefined}
   */
  shouldFail(done) {
    this.chain.then(
      () => done(new Error('Operation should have failed')),
      () => done()
    );
  }
};

/**
 * TestSuite helps write firebase rules test suite.
 *
 * @type {TestSuite}
 */
exports.TestSuite = class TestSuite {

  /**
   * TestSuite constructor
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
   * @return {TestSuite}
   */
  constructor(opts) {
    /*eslint no-console: 0*/
    if (!opts || !opts.firebaseId || ! opts.firebaseSecret) {
      throw new Error('The test suite requires the firebase credentials');
    }

    this.firebaseId = opts.firebaseId;
    this.generator = new FirebaseTokenGenerator(opts.firebaseSecret);
    this.defaultAuthData = opts.defaultAuthData || {};

    const warnFn = this.warnFn = console.warn;
    console.warn = function() {
      if (arguments.length === 0) {
        return;
      }

      if (arguments[0].startsWith('FIREBASE WARNING:')) {
        return;
      }

      warnFn.apply(console, arguments);
    };
  }

  /**
   * Restore console.warn.
   *
   * @return {undefined}
   */
  restore() {
    /*eslint no-console: 0*/
    console.warn = this.warnFn;
  }

  /**
   * Builds a Firebase object
   *
   * usage:
   *
   *    const firebaseId = 'firebase-id';
   *    const firebaseSecret = 'xxxx';
   *    const suite = new TestSuite({firebaseId, firebaseSecret});
   *
   *    // same than `new Firebase('https://firebase-id.firebaseio.com/foo/bar);`
   *    const ref = suite.ref(['foo', 'bar']);
   *
   * @param  {Array|String} paths
   * @return {Firebase}
   */
  ref(paths) {
    /* istanbul ignore next */
    if (paths && paths.constructor === Firebase) {
      return paths;
    }

    /* istanbul ignore next */
    return new Firebase(this.refPath(paths));
  }

  /**
   * @private
   * @param  {String|Array} paths
   * @return {String}
   */
  refPath(paths) {
    paths = paths || [];

    if (!paths.join) {
      paths = [paths];
    }

    return `https://${this.firebaseId}.firebaseio.com/${paths.join('/')}`;
  }

  /**
   * Generate the auth token
   *
   * @private
   */
  token(uid, opts, debug) {
    const tokenOpts ={
      debug: debug || false
    };

    this.currentUser = Object.assign(
      {}, this.defaultAuthData, opts || {}, {uid}
    );

    return this.generator.createToken(this.currentUser, tokenOpts);
  }

  /**
   * Logs user using signed token wth the Firebase auth secret.
   *
   * @param  {String}  uid   the user uid
   * @param  {Object}  opts  auth data
   * @param  {Boolean} debug to enable debug output from your security rules
   * @return {Promise}       Resolves when the user is logged in
   */
  login(uid, opts, debug) {
    const token = this.token(uid, opts, debug);

    return new Promise((resolve, reject) => {
      this.ref().authWithCustomToken(token, makeCallback(resolve, reject));
    });
  }

  /**
   * Logs user as Firebase admin.
   *
   * Only useful for setting up the initial state of the db; the security rules
   * do not apply to admin request.
   *
   * @return {Promise} resolves when the user is logged in.
   */
  logAsAdmin() {
    this.currentUser = {uid: 'DB Admin'};

    const token = this.generator.createToken(this.currentUser, {admin: true});

    return new Promise((resolve, reject) => {
      this.ref().authWithCustomToken(token, makeCallback(resolve, reject));
    });
  }

  /**
   * Log the user out.
   *
   * @return {undefined}
   */
  logout() {
    this.ref().unauth();
    this.currentUser = undefined;
  }

  /**
   * Set initial state of the DB.
   *
   * @param  {Object}  data
   * @return {Context}      Used to chain operation on the Firebase DB.
   */
  with(data) {
    data = data || null;

    return new Context(this, this.logAsAdmin().then(() => {
      return new Promise(
        (resolve, reject) => this.ref().set(data, makeCallback(resolve, reject))
      ).then(
        () => this.logout()
      );
    }));
  }
};


function makeCallback(resolve, reject) {
  return (err, data) => {
    // console.log(err, data);
    if (err) {
      reject(err);
    } else {
      resolve(data);
    }
  };
}
