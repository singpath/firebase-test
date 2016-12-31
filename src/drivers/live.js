/**
 * Rest driver.
 *
 * @todo put rest client in its own package.
 */

'use strict';

const FirebaseTokenGenerator = require('firebase-token-generator');
const hash = require('object-hash');
const rest = require('../rest');

const log = require('debug')('firebase-test:context:rest');

// admin auth data
const adminAuth = {uid: 'DB Admin'};

const noop = () => {};

/**
 * Rest driver.
 *
 * Test operation by applying them to a live database.
 *
 */
class LiveDriver {

  /**
   * Create token generator and rest client.
   *
   * @param {{secret: string, projectId: string}} options Driver options
   */
  constructor(options = {}) {
    if (options.secret == null) {
      throw new Error('No Firebase secret provided.');
    }

    this.client = exports.client(options);
    this.generator = exports.tokenGenerator(options);
    this.secret = options.secret;
  }

  get id() {
    return 'rest';
  }

  /**
   * Placeholder for init hook - nothing to initialize on the Context object.
   */
  init() {}

  /**
   * Enqueue testing the operation can be applied.
   *
   * @param  {Context} ctx Context holding rules, initial datas and the operations to test
   * @return {Promise<void,Error>}
   */
  exec(ctx) {
    return lock(this.client, () => this.runOps(ctx));
  }

  /**
   * Test the operation can be applied.
   *
   * @param  {Context} ctx Context holding rules, initial datas and the operations to test
   * @return {Promise<void,Error>}
   */
  runOps(ctx) {
    const {ops, seed, rules} = ctx;
    const tokens = new Tokens(this.generator);

    const adminToken = tokens.get(adminAuth, {admin: true});
    const setup = Promise.all([
      deployRules({rules, client: this.client, secret: this.secret}),
      this.client.set({paths: '', payload: seed, auth: adminToken, silent: true})
    ]);

    return ops.reduce(
      (chain, operation) => {
        const {op, path: paths, value, auth: authData = null, options: {debug = false, silent = true} = {}} = operation;
        const auth = authData == null ? null : tokens.get(authData, {debug});

        switch (op) {

        case 'get':
          return chain.then(() => this.client.get({paths, auth, silent}));

        case 'push':
        case 'set':
        case 'update':
          return chain.then(() => this.client[op]({paths, payload: value, auth, silent: true}));

        default:
          return chain.then(() => Promise.reject(new Error(`Unknown operation type "${op}"`)));

        }
      },
      setup
    );
  }

}

/**
 * Cache auth tokens
 */
class Tokens {

  constructor(generator) {
    this.generator = generator;
    this.tokens = new Map();
  }

  /**
   * Get token from the cache or generate it if it doesn't exist.
   *
   * @param  {object} auth Auth data
   * @param  {object} opts token object
   * @return {string}
   */
  get(auth, opts) {
    const key = hash({auth, opts});

    if (this.tokens.has(key) === false) {
      this.tokens.set(key, this.generator.createToken(auth, opts));
    }

    return this.tokens.get(key);
  }

}

/**
 * Create the rest driver.
 *
 * @param {{secret: string, projectId: string}} opts Driver options
 * @return {LiveDriver}
 */
exports.create = function(opts) {
  return new LiveDriver(opts);
};

/**
 * Create a REST client for a Firebase database.
 *
 * @param  {string} options.projectId Firebase project id
 * @return {RestClient}
 */
exports.client = function({projectId, client}) {
  if (client != null) {
    log('Rest driver will use the provided client.');

    return client;
  }

  return rest.client({projectId});
};

/**
 * Create a Firebase legacy token generator
 *
 * @param  {string}                   options.secret          Secret to generate token with
 * @return {{createToken: function(data: object, opt: object): string}}
 */
exports.tokenGenerator = function({secret, tokenGenerator}) {
  if (tokenGenerator != null) {
    log('Rest driver will use the provided token generator.');

    return tokenGenerator;
  }

  if (secret == null) {
    throw new Error('The rest driver require a firebase secret');
  }

  log('Rest driver will use the default token generator.');

  return new FirebaseTokenGenerator(secret);
};

/**
 * Rules deployment cache.
 *
 * @type {Map<string,Promise<string>>}
 */
const rulesRequests = new Map();

/**
 * Sequence chains - used synchronize sequence execution.
 *
 * One sequence shouldn't run while an other (targeting the same project) does.
 *
 * @type {Map<string,Promise<void>>}
 */
const sequences = new Map();

/**
 * Reset rules deployment cache and sequence chain.
 *
 * Only useful for tests.
 */
exports.reset = function() {
  rulesRequests.clear();
  sequences.clear();
};

/**
 * Deploy rules for a database project.
 *
 * It deploy the rules only if the previous deployed rules were different.
 *
 * @param  {object}     options          Request options
 * @param  {RestClient} options.client   Client
 * @param  {object}     options.rules    Rules to deploy
 * @param  {string}     options.secret   Secret to authenticate the request
 * @return {Promise<void,Error>}
 */
function deployRules({client, rules, secret}) {
  const lastRequest = rulesRequests.get(client.projectId);

  return Promise.resolve(lastRequest).then(oldRulesHash => {
    const newRuleHash = hash(rules);

    if (oldRulesHash === newRuleHash) {
      return oldRulesHash;
    }

    const request = client.rules({rules, secret});

    rulesRequests.set(client.projectId, request.then(
      () => newRuleHash,
      () => oldRulesHash
    ));

    return request;
  });
}

/**
 * Run a sequence once the previous sequence for that project id ends.
 *
 * @param  {{projectId: string}}             client   Rest client
 * @param  {function(): Promise<void,Error>} sequence Sequence to run
 * @return {Promise<void,Error>}
 */
function lock(client, sequence) {
  const lastSequence = sequences.get(client.projectId);

  return Promise.resolve(lastSequence).then(() => {
    const result = sequence();

    sequences.set(client.projectId, result.then(noop, noop));

    return result;
  });
}
