'use strict';

const camelCase = require('lodash.camelcase');

/**
 * Filter enviroment variables keeping the one starting with the prefix.
 *
 * Expect the the variables to use snake case.
 *
 * @param  {string} options.prefix Variables prefix
 * @param  {object} options.src    Environment variables
 * @return {object}
 */
exports.filter = function({prefix = 'FIREBASE_TEST_', src = process.env} = {}) {
  const startKey = prefix.length;

  return Object.keys(src)
    .filter(key => key.startsWith(prefix))
    .map(key => [key.slice(startKey), src[key]])
    .reduce(
      (env, [key, value]) => Object.assign(env, {[camelCase(key)]: value}),
      {}
    );
};
