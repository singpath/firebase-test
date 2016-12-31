/**
 * Rest client.
 *
 * @todo put rest client in its own package.
 */

'use strict';

const path = require('./path');
const pkg = require('../package.json');
const querystring = require('querystring');
const request = require('request-promise-native');

const debug = require('debug')('firebase-test:context:rest:debug');
const log = require('debug')('firebase-test:context:rest');

const USER_AGENT = `firebase-test/${pkg.version}; ${process.tile}/${process.version}`;

/**
 * Rest Firebase client.
 */
class Client {

  /**
   * RestClient contructor.
   *
   * @param {string} options.projectId ID of the project to target
   */
  constructor({projectId}) {
    if (projectId == null || projectId === '') {
      throw new Error('A RestClient requires a project id');
    }

    this.projectId = projectId;
  }

  uri(paths, qs) {
    return `https://${this.projectId}.firebaseio.com/${path.join(paths)}.json?${querystring.stringify(qs)}`;
  }

  qs({auth = null, silent = false, shallow = false}) {
    const qs = {};

    if (auth != null) {
      qs.auth = auth;
    }

    if (silent) {
      qs.print = 'silent';
      return qs;
    }

    if (shallow) {
      qs.shallow = true;
    }

    return qs;
  }

  reqOps({uri, method, json, payload}) {
    const opts = {
      uri,
      method,
      json,
      resolveWithFullResponse: true,
      simple: true,
      timeout: 5000,
      headers: {'User-Agent': USER_AGENT}
    };

    if (payload !== undefined) {
      opts.body = payload;
    }

    return opts;
  }

  log(method, paths, qs, resp) {
    const code = (resp == null || resp.statusCode == null) ? '  0' : resp.statusCode;
    const uri = this.uri(paths, Object.keys(qs).reduce(
      (q, key) => {
        q[key] = key === 'auth' ? 'xxxx' : qs[key];

        return q;
      },
      {}
    ));

    debug(`${code} ${method} ${uri}`);

    if (
      resp == null ||
      resp.headers == null ||
      resp.headers['x-firebase-auth-debug'] == null
    ) {
      return;
    }

    log(resp.headers['x-firebase-auth-debug']);
  }

  req({paths, payload, json = true, method = 'GET', auth = null, silent = false, shallow = false}) {
    const qs = this.qs({auth, silent, shallow});
    const uri = this.uri(paths, qs);
    const opts = this.reqOps({uri, method, json, payload});

    return request(opts).then(
      resp => {
        this.log(method, paths, qs, resp);

        return resp.body;
      },
      e => {
        this.log(method, paths, qs, e.response);

        return Promise.reject(e);
      }
    );
  }

  /**
   * Deploy rules.
   *
   * @param  {object} options.rules  Rules to deploy
   * @param  {string} options.secret Legacy Firebase secret
   * @return {Promise<void,Error>}
   */
  rules({rules, secret}) {
    return this.req({
      auth: secret,
      method: 'PUT',
      paths: '.settings/rules',
      payload: rules
    });
  }

  /**
   * Fetch a Firebase database location.
   *
   * @param  {string}  [options.paths]   Location to fetch ("/" by default")
   * @param  {string}  [options.auth]    Token to authenticate the request
   * @param  {boolean} [options.silent]  Option to not get the response rendered
   * @param  {[type]}  [options.shallow] To only request the children names.
   * @return {Promise<void,Error>}
   */
  get({paths = '/', auth = null, silent = false, shallow = false} = {}) {
    const method = 'GET';

    return this.req({method, paths, auth, silent, shallow: shallow && !silent});
  }

  /**
   * Set a Firebase database location content.
   *
   * @param  {string}  options.paths     Location to set
   * @param  {object}  [options.payload] Content to set location with (null by default)
   * @param  {string}  [options.auth]    Token to authenticate the request
   * @param  {boolean} [options.silent]  Option to not get the response rendered
   * @return {Promise<void,Error>}
   */
  set({paths, auth = null, payload = null, silent = false}) {
    const method = 'PUT';

    if (paths == null) {
      return Promise.reject(new Error('RestClient#set require an explicit path'));
    }

    return this.req({method, paths, auth, payload, silent});
  }

  /**
   * Update multiple Firebase database location.
   *
   * @param  {string}  [options.paths]   Root of the locations ("/" by default")
   * @param  {string}  [options.auth]    Token to authenticate the request
   * @param  {boolean} [options.silent]  Option to not get response rendered
   * @param  {object}  [options.payload] Map of relative location to update
   * @return {Promise<void,Error>}
   */
  update({paths = '/', auth = null, payload = {}, silent = false} = {}) {
    const method = 'PATCH';

    return this.req({method, paths, auth, payload, silent});
  }

  /**
   * Push a new item at a Firebase database location.
   *
   * @param  {string}  [options.paths]   Collection locations ("/" by default")
   * @param  {string}  [options.auth]    Token to authenticate the request
   * @param  {boolean} [options.silent]  Option to not get response rendered
   * @param  {any}     [options.payload] Item data to push
   * @return {Promise<void,Error>}
   */
  push({paths = '/', auth = null, payload = null, silent = false} = {}) {
    const method = 'POST';

    return this.req({method, paths, auth, payload, silent});
  }

  /**
   * Delete Firebase database location.
   *
   * @param  {string}  options.paths     Location to delete
   * @param  {string}  [options.auth]    Token to authenticate the request
   * @param  {boolean} [options.silent]  Option to not get the response rendered
   * @return {Promise<void,Error>}
   */
  remove({paths, auth = null, silent = false}) {
    const method = 'DELETE';

    if (paths == null) {
      return Promise.reject(new Error('RestClient#remove require an explicit path'));
    }

    return this.req({method, paths, auth, silent});
  }

}

/**
 * Create a REST client for a Firebase database.
 *
 * @param  {string} options.projectId Firebase project id
 * @return {RestClient}
 */
exports.client = function({projectId}) {
  if (projectId == null) {
    throw new Error('The rest driver require a project id.');
  }

  log('Rest driver will use the default rest client.');

  return new Client({projectId});
};
