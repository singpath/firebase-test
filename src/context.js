'use strict';

const {thenable} = require('./promise');
const path = require('./path');

class FailureError extends Error {

  constructor(msg, error) {
    const isError = error != null && error.stack != null;

    super(`${msg}: ${isError ? error.stack : error}`);

    this.original = error;
  }

}

/**
 * function doing nothing and returning undefined.
 *
 * @return {void}
 */
function noop() {}

/**
 * A context describe a sequence of firebase operation.
 */
class Context {

  constructor({rules, driver} = {}) {
    if (rules == null) {
      throw new Error('No rules provided.');
    }

    if (driver == null) {
      throw new Error('No driver provided to the context.');
    }

    this.driver = driver;
    this.rules = rules;
    this.ops = [];
    this.auth = null;
    this.seed = null;

    // setup driver with this ctx
    this.driver.init(this);
  }

  /**
   * Fork the sequence.
   *
   * @param  {object} opts Properties to overwrite the fork sequence with.
   * @return {Context}
   */
  fork(opts = {}) {
    const fork = Object.create(this);
    const {driver, rules} = this;

    return Object.assign(fork, opts, {

      // Make sure those values do not get overwritten.
      driver,
      rules,

      // copy the sequence
      ops: this.ops.slice()

    });
  }

  /**
   * Set database initial data.
   *
   * @param  {any} seed Initial data
   * @return {Context}
   */
  startWith(seed) {
    const fork = this.fork({seed});

    fork.ops = [];

    return fork;
  }

  /**
   * Fork the sequence to authenticate the current user.
   *
   * @param  {string|null} uid    Current user UID
   * @param  {object|void} [opts] Current user data
   * @return {Context}
   */
  as(uid, opts) {
    if (!uid) {
      return this.asGuest();
    }

    const auth = Object.assign({}, opts, {uid});

    return this.fork({auth});
  }

  /**
   * Fork the sequence to log off the current user.
   *
   * @return {Context}
   */
  asGuest() {
    return this.fork({auth: null});
  }

  /**
   * Fork and add a new operation.
   *
   * @param  {string}                            options.op      Operation type (get, set, update, push)
   * @param  {string|array}                      options.paths   A path or his segment to join
   * @param  {any}                               options.value   Value to update the database with
   * @param  {{silent: boolean, debug: boolean}} options.options Operation options
   * @return {Context}
   */
  append({op, paths, value, options = {}}) {
    const fork = this.fork();
    const {auth = null} = this;

    fork.ops.push({op, path: path.join(paths), value, auth, options});

    return fork;
  }

  /**
   * Enqueue a fetch operation of the database location.
   *
   * The operation which should throw or return a rejected promise if the
   * operation fails.
   *
   * The database location can be given as path (e.g "\`/users/${uid}\`") or an
   * array of path fragment (e.g. "['/users', uid]").
   *
   *
   * @param  {string|array} paths  Database location
   * @param  {Object}       [opts] Query options
   * @return {Context}
   */
  get(paths, opts) {
    return this.append({op: 'get', paths, options: opts});
  }

  /**
   * Enqueue an operation to replace the database location value.
   *
   * The operation which should throw or return a rejected promise if the
   * operation fails.
   *
   * @param  {string|array} paths  Database location
   * @param  {any}          value  Value to set
   * @param  {Object}       [opts] Query options
   * @return {Context}
   */
  set(paths, value = null, opts = {}) {
    return this.append({op: 'set', paths, value, options: opts});
  }

  /**
   * Enqueue an operation to update the database location.
   *
   * The operation which should throw or return a rejected promise if the
   * operation fails.
   *
   * @param  {string|array} paths  Database location
   * @param  {any}          patch  Patch
   * @param  {Object}       [opts] Query options
   * @return {Context}
   */
  update(paths, patch = {}, opts = {}) {
    return this.append({op: 'update', paths, value: patch, options: opts});
  }

  /**
   * Enqueue an operation to push a new value to the database location.
   *
   * The operation which should throw or return a rejected promise if the
   * operation fails.
   *
   * @param  {string|array} paths  Database location
   * @param  {any}          value  Value to push
   * @param  {Object}       [opts] Query options
   * @return {Context}
   */
  push(paths, value = null, opts = {}) {
    return this.append({op: 'push', paths, value, options: opts});
  }

  /**
   * Enqueue an operation to remove a database location.
   *
   * The operation which should throw or return a rejected promise if the
   * operation fails.
   *
   * @param  {string|array} paths  Database location
   * @param  {Object}       [opts] Query options
   * @return {Context}
   */
  remove(paths, opts = {}) {
    return this.append({op: 'set', paths, value: null, options: opts});
  }

  /**
   * Run the Operation in sequence.
   *
   * @return {Promise<any,Error>}
   */
  chain() {
    return new Promise(
      resolve => resolve(this.driver.exec(this))
    );
  }

  /**
   * Run the operations in sequence and and chain the provided callbacks.
   *
   * @param  {function} onFulfilled Called if the sequence run successfully.
   * @param  {function} onRejected  Called if the sequence failed.
   * @return {Promise<any,Error>}
   */
  then(onFulfilled, onRejected) {
    return this.chain().then(onFulfilled, onRejected);
  }

  /**
   * Run the sperations in sequence and chain the provided callback if the
   * sequence failed.
   *
   * @param  {function} onRejected  Called if the sequence failed.
   * @return {Promise<any,Error>}
   */
  catch(onRejected) {
    return this.chain().catch(onRejected);
  }

  /**
   * Add to the sequence an assertion that no operation should failed.
   *
   * if a callback is provided the sequence will be run and the callback will be
   * called at the end with an eventual error.
   *
   * If no callback is provided, it returns a thenable object, which will delay
   * running the sequence until `then` or `catch` method is called.
   *
   * @param  {String}                      options.msg  Error message
   * @param  {function(err: ?Error): void} options.done Async callback
   * @return {void|Promise<void,Error>}
   */
  ok({msg = 'Operation should not have failed', done} = {}) {
    return thenable(
      () => this.catch(err => Promise.reject(new FailureError(msg, err)))
    ).asCallback(done);
  }

  /**
   * Add to the sequence an assertion that one of the operation should failed.
   *
   * if a callback is provided the sequence will be run and the callback will be
   * called at the end with an eventual error.
   *
   * If no callback is provided, it returns a thenable object, which will delay
   * running the sequence until `then` or `catch` method is called.
   *
   * @param  {String}                      options.msg  Error message
   * @param  {function(err: ?Error): void} options.done Async callback
   * @return {void|Promise<void,Error>}
   */
  shouldFail({msg = 'Operation should have failed', done} = {}) {
    return thenable(() => this.then(
      () => Promise.reject(new Error(msg)),
      noop
    )).asCallback(done);
  }

}

exports.create = function(opts) {
  return new Context(opts);
};
