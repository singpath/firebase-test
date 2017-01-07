'use strict';

const once = require('lodash.once');

class MultipleError extends Error {

  constructor(errors = []) {
    const msg = errors.map(e => e.stack).join('/n/n');

    super(msg);

    this.errors = errors;
  }
}

/**
 * Create a promise like object.
 *
 * Unlike Promise.resolve, it takes a function returning a value and to action
 * takes place until one of the method is called
 *
 * @param  {function(): any} resolver Its returned value will be resolved as a promised
 * @return {{then: function(cb, cb): Promise, catch: function(cb): Promise, asCallback: function(done): void}}
 */
exports.thenable = function(resolver) {
  const cached = once(
    () => new Promise(resolve => resolve(resolver()))
  );

  return {
    then(onFulfilled, onRejected) {
      return cached().then(onFulfilled, onRejected);
    },

    catch(onRejected) {
      return cached().catch(onRejected);
    },

    asCallback(done) {
      if (done == null) {
        return this;
      }

      this.then(() => done(), done);

      return undefined;
    }
  };
};

/**
 * Attempt to run all thenable assertions sequentially.
 *
 * It will stop as soon as one assert fails.
 *
 * @example
 *   const suite = firebaseTest.suite({rules});
 *
 *   return firebaseTest.run(
 *     suite.as(null).set('/', true).shouldFail('unauthenticated user cannot write data'),
 *     suite.as({uid: bob}}).set('/', true).shouldFail('regular user cannot write root data'),
 *     suite.as({uid: alice, role: 'admin'}).set('/', true).ok('admin user can write root data'),
 *   );
 *
 * @param  {...Promise<void,Error>} thenables Thenables returned by Context#ok or Context#shouldFail
 * @return {Promise<void,Error>}
 */
exports.run = function(...thenables) {
  return [].concat(...thenables).reduce(
    (chain, thenable) => chain.then(() => thenable),
    Promise.resolve()
  );
};

/**
 * Run all thenable assertions sequentially.
 *
 * It will report any failed assertions.
 *
 * @example
 *   const suite = firebaseTest.suite({rules});
 *
 *   return firebaseTest.all(
 *     suite.as(null).set('/', true).shouldFail('unauthenticated user cannot write data'),
 *     suite.as({uid: bob}}).set('/', true).shouldFail('regular user cannot write root data'),
 *     suite.as({uid: alice, role: 'admin'}).set('/', true).ok('admin user can write root data'),
 *   );
 *
 * @param  {...Promise<void,Error>} thenables Thenables returned by Context#ok or Context#shouldFail
 * @return {Promise<void,Error>}
 */
exports.all = function(...thenables) {
  return [].concat(...thenables).reduce(
    (chain, thenable) => chain.then(failures => thenable.then(
      () => failures,
      err => failures.concat(err)
    )),
    Promise.resolve([])
  ).then(failures => {
    if (failures.length === 0) {
      return;
    }

    return Promise.reject(new MultipleError(failures));
  });
};
