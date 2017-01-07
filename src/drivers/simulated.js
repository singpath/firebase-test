'use strict';

const pathHelper = require('../path');
const targaryen = require('targaryen');

const defaultLog = require('debug')('firebase-test:context:targaryen');
let ID_COUNT = 0;

function defaultUniqID() {
  return `--firebase-test-id-${ID_COUNT++}--`;
}

function assertAllowed(result, {debug, log}) {
  if (debug) {
    log(result.info);
  }

  if (result.allowed !== true) {
    throw new Error('Operation failed');
  }

  return result.newDatabase == null ? result.database : result.newDatabase;
}

const rulesetKey = Symbol('ruleset');

/**
 * SimulatedDriver simulate firebase operations using targaryen.
 */
class SimulatedDriver {

  /**
   * Targaryen contructor.
   *
   * The options main use if for testing.
   *
   * @param  {function(): string}     options.uniqID Function returning unique ID for push operation
   * @param  {function(...any): void} options.log    Log operation debug info
   */
  constructor({uniqID = defaultUniqID, log = defaultLog} = {}) {
    this.uniqID = uniqID;
    this.log = log;
  }

  get id() {
    return 'targaryen';
  }

  /**
   * Check the rules are valid.
   *
   * @param  {Context} ctx Context to initialize
   */
  init(ctx) {
    ctx[rulesetKey] = targaryen.ruleset(ctx.rules);
  }

  /**
   * Simulate operations.
   *
   * Returns the content of the database at the end of sequence.
   *
   * @param  {Context} ctx Context holds the rules, seed and operation to simulate with
   * @return {any}
   */
  exec(ctx) {
    const {seed, ops} = ctx;
    const data = targaryen.store(seed);

    if (ops == null || ops.length == null || ops.length === 0) {
      return data.$value();
    }

    const initialDb = targaryen.database(ctx[rulesetKey], data).with({debug: true});
    const finalDb = ops.reduce(
      (database, operation) => {
        const {op, path = '/', value, auth = null, options: {debug = false} = {}} = operation;
        const db = database.as(auth).with({debug});
        let result, childPath;

        switch (op) {

        case 'get':
          result = db.read(path);
          break;

        case 'push':
          childPath = pathHelper.join(path, this.uniqID());
          result = db.write(childPath, value);
          break;

        case 'set':
          result = db.write(path, value);
          break;

        case 'update':
          result = db.update(path, value);
          break;

        default:
          throw new Error(`Unknown operation type "${op}"`);

        }

        return assertAllowed(result, {debug, log: this.log});
      },
      initialDb
    );

    return finalDb.root.$value();
  }

}

/**
 * Create a driver simulating a sequence of Firebase operation.
 *
 * @param  {object} opts Driver's options
 * @return {SimulatedDriver}
 */
exports.create = function(opts) {
  return new SimulatedDriver(opts);
};
