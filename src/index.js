'use strict';

const TestSuite = require('./testsuite').TestSuite;


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
 * @return {TestSuite}
 */
exports.testSuite = function testSuite(opts) {
  return new TestSuite(opts);
};
