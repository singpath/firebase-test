'use strict';

const context = require('./context');
const drivers = require('./drivers');
const env = require('./env');
const q = require('./promise');

exports.drivers = drivers;
exports.run = q.run;
exports.all = q.all;

/**
 * Create a new test suite.
 *
 * If the driver is not provided, it will use FIREBASE_TEST_DRIVER_ID
 * environment variable to pick the test driver.
 *
 * By default, it will use a simulated driver; set FIREBASE_TEST_DRIVER_ID to
 * "live" to run the test against a live firebase DB.
 *
 * To set driver options, you can set the FIREBASE_TEST_DRIVER_* environment
 * variables; e.g. the live driver require FIREBASE_TEST_DRIVER_SECRET and
 * FIREBASE_TEST_DRIVER_PROJECT_ID to be set.
 *
 * @param  {object} options.rules    Firebase rules to test
 * @param  {object} options.driver   Driver to test with (default to a TargaryenDriver instance)
 * @return {Context}
 */
exports.suite = function({rules, driver} = {}) {

  if (rules == null) {
    throw new Error('A firebase test suite requires rules');
  }

  return context.create({
    rules,
    driver: driver == null ? exports.loadDriver() : driver
  });
};

/**
 * Try to instantiate one using environment variables.
 *
 * Expect FIREBASE_TEST_DRIVER_ID to be set a supported driver id ("live" or
 * "simulated" by default).
 *
 * @param  {object} src Environment variable (default to `process.env`)
 * @return {{init: function(ctx: Context): void, exec: function(ctx: Context): Promise<void,Error>}}
 */
exports.loadDriver = function({src} = {}) {
  const prefix = 'FIREBASE_TEST_DRIVER_';
  const opts = env.filter({prefix, src});
  const {id = 'simulated'} = opts;

  if (drivers[id] == null) {
    throw new Error(`Unknown driver "${id}".`);
  }

  return drivers[id].create(opts);
};
