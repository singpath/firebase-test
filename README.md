# firebase-test

[![Build Status](https://travis-ci.org/singpath/firebase-test.svg)](https://travis-ci.org/singpath/firebase-test)
[![Coverage Status](https://coveralls.io/repos/singpath/firebase-test/badge.svg?branch=master&service=github)](https://coveralls.io/github/singpath/firebase-test?branch=master)
[![Dependency Status](https://gemnasium.com/singpath/firebase-test.svg)](https://gemnasium.com/singpath/firebase-test)


Firebase rules test helper.


## Install

```
npm install firebase-test --save-dev
```


## Usage

A Firebase-test suite with its chainable method is used to define an initial
database, a sequence of operation and the expected result:

```js
const fbTest = require('firebase-test');

// Using Mocha BDD
describe('presence', function() {
  let suite;

  // The first live connection to firebase might timeout
  this.timeout(5000);

  beforeEach(function() {
    const rules = require('./rules.json');

    suite = fbTest.suite({rules});
  });

  it('should be readeable', function(done) {
    suite.startWith({
      // initial state of the Firebase DB
    }).as('bob').get('/people').ok(done);
  });

  it('should allow people to update their presence', function(done) {
    suite.startWith({}).as('bob').set('/people/bob', {'.sv': 'timestamp'}).ok(done);
  });

  it('should only allow people to update their own presence', function(done) {
    suite.startWith({}).as('alice').set('/people/bob', {'.sv': 'timestamp'}).shouldFails(done);
  });

});
```

Firebase test is framework agnostic and will work with any framework supporting
callback or promise based async assertions:

```js
it('should be readeable (using a callback)', function(done) {
  suite.startWith({}).as('bob').get('/people').ok(done);
});

it('should be readeable (using a promise)', function() {
  return suite.startWith({}).as('bob').get('/people').ok();
});
```

By default the operations are simulated (using [targaryen]). You can switch to
live test by providing a Firebase project ID and a Firebase secret, and setting
an alternative driver:

```shell
export FIREBASE_TEST_DRIVER_PROJECT_ID=my-project-id
export FIREBASE_TEST_DRIVER_SECRET=xxxxxx
FIREBASE_TEST_DRIVER_ID=live mocha -b path/to/assertions.js
```

When run live, you should make sure the different test runs are not run
concurrently. If you're using a CI service like [Travis] limit concurrent jobs
to one.


[Travis]: travis-ci.org
[Targaryen]: https://www.npmjs.com/package/targaryen
