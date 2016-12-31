'use strict';

const jsonBody = require('body/json');
const context = require('../../src/context');
const path = require('../../src/path');
const querystring = require('querystring');
const live = require('../../src/drivers/live');
const utils = require('../utils');

describe('live', function() {

  describe('client', function() {

    it('should take a project id option', function() {
      const client = live.client({projectId: 'foo'});

      expect(client).to.have.property('projectId', 'foo');
    });

    it('should should throw if teh project id is missing', function() {
      expect(() => live.client()).to.throw();
      expect(() => live.client({})).to.throw();
      expect(() => live.client({projectId: ''})).to.throw();
    });

    describe('#uri', function() {

      it('should build a rest url', function() {
        const client = live.client({projectId: 'foo'});

        expect(client.uri()).to.equal('https://foo.firebaseio.com/.json?');
        expect(client.uri('/bar/')).to.equal('https://foo.firebaseio.com/bar.json?');
        expect(client.uri('bar/baz')).to.equal('https://foo.firebaseio.com/bar/baz.json?');
        expect(client.uri('bar/baz', {print: 'pretty', auth: 'qux'})).to.equal('https://foo.firebaseio.com/bar/baz.json?print=pretty&auth=qux');
      });

    });

    describe('#qs', function() {

      it('should clean up query string option', function() {
        const client = live.client({projectId: 'foo'});

        expect(client.qs({auth: null})).to.deep.equal({});
        expect(client.qs({auth: 'xxxx'})).to.deep.equal({auth: 'xxxx'});
      });

      it('should handle silent option', function() {
        const client = live.client({projectId: 'foo'});

        expect(client.qs({silent: true})).to.deep.equal({print: 'silent'});
        expect(client.qs({silent: false})).to.deep.equal({});
        expect(client.qs({})).to.deep.equal({});
      });

      it('should handle shallow option', function() {
        const client = live.client({projectId: 'foo'});

        expect(client.qs({shallow: true})).to.deep.equal({shallow: true});
        expect(client.qs({shallow: false})).to.deep.equal({});
        expect(client.qs({})).to.deep.equal({});
        expect(client.qs({silent: true, shallow: true})).to.deep.equal({print: 'silent'});
      });

    });

    describe('#req', function() {
      const port = 6000;
      let server, client;

      beforeEach(function() {
        server = utils.server({port}).start();
        client = live.client({projectId: 'foo'});
        client.uri = (paths, qs) => `${server.uri}/${path.join(paths)}.json?${querystring.stringify(qs)}`;
      });

      afterEach(function() {
        server.stop();
      });

      it('should send a request a firebase resource', function() {
        const paths = 'foo/bar';

        server.returns = () => [200, {baz: true}];

        return client.req({paths}).then(resp => {
          expect(resp).to.deep.equal({baz: true});
          expect(server.calls).to.have.length(1);

          const [{url, method}] = server.calls;

          expect(url).to.equal('/foo/bar.json?');
          expect(method).to.equal('GET');
        });
      });

      it('should handle payload', function() {
        const paths = 'foo/bar';
        const payload = {baz: true};
        const method = 'PUT';
        const bodies = [];

        server.returns = function(req, resp) {
          jsonBody(req, (err, body) => {
            bodies.push({err, body});

            resp.writeHead(200, {'Content-Type': 'application/json'});
            resp.end(JSON.stringify(body));
          });

          return [0];
        };

        return client.req({paths, payload, method}).then(resp => {
          expect(resp).to.deep.equal(payload);
          expect(server.calls).to.have.length(1);

          const [{url, method}] = server.calls;
          const [{err, body}] = bodies;

          expect(url).to.equal('/foo/bar.json?');
          expect(method).to.equal(method);
          expect(err).to.be.null();
          expect(body).to.deep.equal(payload);
        });
      });

      it('should handle raw payload', function() {
        const paths = 'foo/bar';
        const payload = {baz: true};
        const method = 'PUT';
        const bodies = [];

        server.returns = function(req, resp) {
          jsonBody(req, (err, body) => {
            bodies.push({err, body});

            resp.writeHead(200, {'Content-Type': 'application/json'});
            resp.end(JSON.stringify(body));
          });

          return [0];
        };

        return client.req({paths, method, payload: JSON.stringify(payload), json: false}).then(() => {
          const [{err, body}] = bodies;

          expect(err).to.be.null();
          expect(body).to.deep.equal(payload);
        });
      });

      it('should handle authentication', function() {
        const paths = 'foo/bar';
        const auth = 'some-token';

        server.returns = () => [200, {baz: true}];

        return client.req({paths, auth}).then(() => {
          const [{url}] = server.calls;

          expect(url).to.equal('/foo/bar.json?auth=some-token');
        });
      });

      it('should handle silent request', function() {
        const paths = 'foo/bar';

        server.returns = () => [204, null];

        return client.req({paths, silent: true}).then(resp => {
          const [{url}] = server.calls;

          expect(url).to.equal('/foo/bar.json?print=silent');
          expect(resp).to.be.undefined();
        });
      });

      it('should handle shallow request', function() {
        const paths = 'foo/bar';

        server.returns = () => [200, {baz: true}];

        return client.req({paths, shallow: true}).then(() => {
          const [{url}] = server.calls;

          expect(url).to.equal('/foo/bar.json?shallow=true');
        });
      });

      it('should handle failure (1/2)', function() {
        const paths = 'foo/bar';

        server.returns = function(req, resp) {
          resp.setHeader('x-firebase-auth-debug', 'Read was denied.');

          return [400, {error: 'failed'}];
        };

        return client.req({paths}).then(
          () => Promise.reject(new Error('unexpected')),
          () => {}
        );
      });

      it('should handle failure (2/2)', function() {
        const paths = 'foo/bar';

        client.uri = () => 'http://firebase.test.localhost/--no--where';

        return client.req({paths}).then(
          () => Promise.reject(new Error('unexpected')),
          () => {}
        );
      });

    });

    describe('aliases', function() {
      let client, result;

      beforeEach(function() {
        client = live.client({projectId: 'foo'});
        result = {};

        sinon.stub(client, 'req');
        client.req.returns(Promise.resolve(result));
      });

      describe('rules', function() {

        it('should upload the rules', function() {
          const rules = {};
          const secret = 'xxxx';

          return client.rules({rules, secret}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              auth: secret,
              method: 'PUT',
              paths: '.settings/rules',
              payload: rules
            });
          });
        });

      });

      describe('get', function() {

        it('should send a GET request', function() {
          return client.get().then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths: '/',
              method: 'GET',
              auth: null,
              silent: false,
              shallow: false
            });
          });
        });

        it('should fetch a resource', function() {
          const paths = 'foo/bar';

          return client.get({paths}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              method: 'GET',
              auth: null,
              silent: false,
              shallow: false
            });
          });
        });

        it('can authenticate request', function() {
          const paths = 'foo/bar';
          const auth = 'xxxx';

          return client.get({paths, auth}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              auth,
              method: 'GET',
              silent: false,
              shallow: false
            });
          });
        });

        it('can send silent request', function() {
          const paths = 'foo/bar';
          const silent = true;

          return client.get({paths, silent}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              silent,
              method: 'GET',
              auth: null,
              shallow: false
            });
          });
        });

        it('can send a shallow request', function() {
          const paths = 'foo/bar';
          const shallow = true;

          return client.get({paths, shallow}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              shallow,
              method: 'GET',
              auth: null,
              silent: false
            });
          });
        });

        it('cannot send a silent and shallow request', function() {
          const paths = 'foo/bar';
          const silent = true;
          const shallow = true;

          return client.get({paths, silent, shallow}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              silent,
              method: 'GET',
              auth: null,
              shallow: false
            });
          });
        });

      });

      describe('set', function() {

        it('should send a PUT request', function() {
          return client.set({paths: '/'}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              auth: null,
              method: 'PUT',
              paths: '/',
              payload: null,
              silent: false
            });
          });
        });

        it('should reject if no path is provided', function() {
          return client.set({}).then(
            () => Promise.reject(new Error('unexpected')),
            () => {}
          );
        });

        it('should set a resource', function() {
          const paths = 'foo/bar';
          const payload = true;

          return client.set({paths, payload}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              payload,
              auth: null,
              method: 'PUT',
              silent: false
            });
          });
        });

        it('can authenticate request', function() {
          const paths = 'foo/bar';
          const auth = 'xxxx';

          return client.set({paths, auth}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              auth,
              method: 'PUT',
              payload: null,
              silent: false
            });
          });
        });

        it('can send silent request', function() {
          const paths = 'foo/bar';
          const silent = true;

          return client.set({paths, silent}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              silent,
              auth: null,
              method: 'PUT',
              payload: null
            });
          });
        });

      });

      describe('push', function() {

        it('should send a POST request', function() {
          return client.push().then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              auth: null,
              method: 'POST',
              paths: '/',
              payload: null,
              silent: false
            });
          });
        });

        it('should add a resource to a collection', function() {
          const paths = 'foo/bar';
          const payload = true;

          return client.push({paths, payload}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              payload,
              auth: null,
              method: 'POST',
              silent: false
            });
          });
        });

        it('can authenticate request', function() {
          const paths = 'foo/bar';
          const auth = 'xxxx';

          return client.push({paths, auth}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              auth,
              method: 'POST',
              payload: null,
              silent: false
            });
          });
        });

        it('can send silent request', function() {
          const paths = 'foo/bar';
          const silent = true;

          return client.push({paths, silent}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              silent,
              auth: null,
              method: 'POST',
              payload: null
            });
          });
        });

      });

      describe('update', function() {

        it('should send a PATCH request', function() {
          return client.update().then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              auth: null,
              method: 'PATCH',
              paths: '/',
              payload: {},
              silent: false
            });
          });
        });

        it('should update multiple locations', function() {
          const paths = 'foo/bar';
          const payload = {baz: true, qux: true};

          return client.update({paths, payload}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              payload,
              auth: null,
              method: 'PATCH',
              silent: false
            });
          });
        });

        it('can authenticate request', function() {
          const paths = 'foo/bar';
          const auth = 'xxxx';

          return client.update({paths, auth}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              auth,
              method: 'PATCH',
              payload: {},
              silent: false
            });
          });
        });

        it('can send silent request', function() {
          const paths = 'foo/bar';
          const silent = true;

          return client.update({paths, silent}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              silent,
              auth: null,
              method: 'PATCH',
              payload: {}
            });
          });
        });

      });

      describe('remove', function() {

        it('should send a DELETE request', function() {
          return client.remove({paths: '/'}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              auth: null,
              method: 'DELETE',
              paths: '/',
              silent: false
            });
          });
        });

        it('should reject if no path is provided', function() {
          return client.remove({}).then(
            () => Promise.reject(new Error('unexpected')),
            () => {}
          );
        });

        it('can authenticate request', function() {
          const paths = 'foo/bar';
          const auth = 'xxxx';

          return client.remove({paths, auth}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              auth,
              method: 'DELETE',
              silent: false
            });
          });
        });

        it('can send silent request', function() {
          const paths = 'foo/bar';
          const silent = true;

          return client.remove({paths, silent}).then(r => {
            expect(r).to.equal(result);
            expect(client.req).to.have.been.calledOnce();
            expect(client.req).to.have.been.calledWith({
              paths,
              silent,
              auth: null,
              method: 'DELETE'
            });
          });
        });

      });

    });

  });

  describe('tokenGenerator', function() {

    it('should create a firebase token generator', function() {
      expect(live.tokenGenerator({secret: 'xxxx'})).respondTo('createToken');
    });

    it('should throw if the firebase secret was not provided', function() {
      expect(() => live.tokenGenerator()).to.throw();
      expect(() => live.tokenGenerator({})).to.throw();
    });

  });

  describe('create', function() {

    beforeEach(function() {
      live.reset();
    });

    it('should create a firebase-test driver', function() {
      const secret = 'xxxx';
      const projectId = 'foo';
      const driver = live.create({secret, projectId});

      expect(driver.id).to.equal('rest');
      expect(driver.secret).to.equal(secret);
      expect(driver).to.have.property('client');
      expect(driver).to.have.property('generator');
      expect(driver).respondTo('init');
      expect(driver).respondTo('exec');
    });

    it('should use provided client and tokenGenerator', function() {
      const secret = 'xxxx';
      const client = {};
      const tokenGenerator = {};
      const driver = live.create({secret, client, tokenGenerator});

      expect(driver.client).to.equal(client);
      expect(driver.generator).to.equal(tokenGenerator);
    });

    it('should throw is no client and no projectId are not provided', function() {
      const secret = 'xxxx';
      const projectId = 'xxxx';
      const client = {};

      expect(() => live.create()).to.throw();
      expect(() => live.create({secret})).to.throw();
      expect(() => live.create({secret, projectId})).not.to.throw();
      expect(() => live.create({secret, client})).not.to.throw();
    });

    it('should throw if the secret is missing', function() {
      const secret = 'xxxx';
      const projectId = 'foo';
      const tokenGenerator = {};

      expect(() => live.create()).to.throw();
      expect(() => live.create({secret, projectId})).not.to.throw();
      expect(() => live.create({secret, projectId, tokenGenerator})).not.to.throw();
      expect(() => live.create({projectId, tokenGenerator})).to.throw();
      expect(() => live.create({projectId})).to.throw();
    });

    describe('init', function() {

      it('should not throw', function() {
        const secret = 'xxxx';
        const client = {};
        const driver = live.create({secret, client});

        expect(() => driver.init()).to.not.throw();
      });

    });

    describe('#exec', function() {
      const secret = 'xxxx';
      let client, generator, driver;

      beforeEach(function() {
        client = {
          rules: sinon.stub(),
          get: sinon.stub(),
          set: sinon.stub(),
          update: sinon.stub(),
          push: sinon.stub()
        };
        client.rules.returns(Promise.resolve());
        client.get.returns(Promise.resolve());
        client.set.returns(Promise.resolve());
        client.update.returns(Promise.resolve());
        client.push.returns(Promise.resolve());

        generator = {createToken: sinon.stub()};
        generator.createToken.returns('some-token');

        driver = live.create({secret, client, tokenGenerator: generator});
      });

      it('should run operations in order', function() {
        const rules = {
          rules: {
            '.read': true,
            '.write': true
          }
        };
        const ctx = context.create({rules, driver})
          .get('/foo')
          .update('/', {foo: false, bar: true})
          .push('/baz', true);

        return driver.exec(ctx).then(() => {
          expect(client.rules).to.have.been.calledOnce();
          expect(client.rules).to.have.been.calledWith({rules, secret});

          expect(client.set).to.have.been.calledOnce();
          expect(client.set).to.have.been.calledWith({
            auth: 'some-token',
            paths: '',
            payload: null,
            silent: true
          });

          expect(client.get).to.have.been.calledOnce();
          expect(client.get).to.have.been.calledAfter(client.rules);
          expect(client.get).to.have.been.calledAfter(client.set);
          expect(client.get).to.have.been.calledWith({
            auth: null,
            paths: 'foo',
            silent: true
          });

          expect(client.update).to.have.been.calledOnce();
          expect(client.update).to.have.been.calledAfter(client.get);
          expect(client.update).to.have.been.calledWith({
            auth: null,
            paths: '',
            payload: {foo: false, bar: true},
            silent: true
          });

          expect(client.push).to.have.been.calledOnce();
          expect(client.push).to.have.been.calledAfter(client.update);
          expect(client.push).to.have.been.calledWith({
            auth: null,
            paths: 'baz',
            payload: true,
            silent: true
          });
        });
      });

      it('should authenticate request', function() {
        generator.createToken.withArgs({uid: 'bob'}).returns('bob-token');

        const rules = {
          rules: {
            '.read': true,
            '.write': true
          }
        };
        const ctx = context.create({rules, driver})
          .as('bob')
          .get('/foo');

        return driver.exec(ctx).then(() => {
          expect(generator.createToken).to.have.calledTwice();

          expect(client.get).to.have.been.calledOnce();
          expect(client.get).to.have.been.calledWith({
            auth: 'bob-token',
            paths: 'foo',
            silent: true
          });
        });
      });

      it('should reuse tokens', function() {
        let id = 0;

        generator.createToken = () => `token-${id++}`;

        const rules = {
          rules: {
            '.read': true,
            '.write': true
          }
        };
        const ctx = context.create({rules, driver})
          .as('bob')
          .get('/foo')
          .get('/bar')
          .as('alice')
          .get('/baz');

        return driver.exec(ctx).then(() => {
          expect(client.get).to.have.been.calledThrice();
          expect(client.get).to.have.been.calledWith({
            auth: 'token-1',
            paths: 'foo',
            silent: true
          });
          expect(client.get).to.have.been.calledWith({
            auth: 'token-1',
            paths: 'bar',
            silent: true
          });
          expect(client.get).to.have.been.calledWith({
            auth: 'token-2',
            paths: 'baz',
            silent: true
          });
        });
      });

      it('should reject on unknown operation type', function() {
        const rules = {};
        const seed = null;
        const ops = [{op: 'foo'}];

        return driver.exec({rules, seed, ops}).then(
          () => Promise.reject('unexpected'),
          () => {}
        );
      });

      it('should skip deploying the same rule set', function() {
        const rules = {};
        const ctx = context.create({rules, driver});
        const exec = () => driver.exec(ctx);

        return exec().then(exec).then(
          () => expect(client.rules).to.have.been.calledOnce()
        );
      });

      it('should no skip deploying the same rule set after error', function() {
        const rules = {};
        const ctx = context.create({rules, driver});
        const exec = () => driver.exec(ctx).then(
          () => Promise.reject(new Error('unexpected')),
          () => {}
        );

        client.rules.returns(Promise.reject(new Error()));

        return exec().then(exec).then(
          () => expect(client.rules).to.have.been.calledTwice()
        );
      });

    });

  });

});
