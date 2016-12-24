'use strict';

const http = require('http');

function defaultResponse() {
  return [400, {error: 'unexpected'}];
}

class FakeServer {

  constructor({returns = defaultResponse, port = 8080} = {}) {
    this.returns = returns;
    this.port = port;
    this.server = undefined;
    this.calls = [];
  }

  get uri() {
    return `http://localhost:${this.port}`;
  }

  start() {
    this.server = http.createServer((req, resp) => this.handler(req, resp));
    this.server.listen(this.port);
    return this;
  }

  stop() {
    this.server.close();
  }

  handler(req, resp) {
    this.calls.push(req);

    const [code, result] = this.returns(req, resp);

    if (code === 0) {
      return;
    }

    resp.writeHead(code, {'Content-Type': 'application/json'});
    resp.end(code === 204 ? undefined : JSON.stringify(result));
    return;
  }
}

exports.create = opts => new FakeServer(opts);
