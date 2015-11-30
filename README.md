# firebase-test

[![Build Status](https://travis-ci.org/singpath/firebase-test.svg)](https://travis-ci.org/singpath/firebase-test)
[![Coverage Status](https://coveralls.io/repos/singpath/firebase-test/badge.svg?branch=master&service=github)](https://coveralls.io/github/singpath/firebase-test?branch=master)
[![Dependency Status](https://gemnasium.com/singpath/firebase-test.svg)](https://gemnasium.com/singpath/firebase-test)


Firebase rules test helper


## install

```
npm install firebase firebase-token-generator firebase-test --save-dev
```


## Mocha example

```js
const Firebase = require('firebase');
const fbTest = require('firebase-test');

describe('presence', function() {
  let suite;

  // The first connection to firebase might timeout
  this.timeout(5000);

  beforeEach(() => {
    suite = fbTest.testSuite({
      firebaseId: process.env.FIREBASE_ID,
      firebaseSecret: process.env.FIREBASE_SECRET,
      defaultAuthData: {
        isModerator: false
      }
    });
  });

  afterEach(() => {
    // The testsuite monkey patch console to filter out Firebase warning;
    // we need to restore it at then of each test
    suite.restore();
  });

  it('should be readeable', done => {
    suite.with({
      // initial state of the Firebase DB
    }).as('bob').get('/people').ok(done);
  });

  it('should allow people to update their presence', done=> {
    suite.with({}).as('bob').set('/people/bob', Firebase.ServerValue.TIMESTAMP).ok(done);
  });

  it('should only allow people to update their own presence', done=> {
    suite.with({}).as('alice').set('/people/bob', Firebase.ServerValue.TIMESTAMP).shouldFails(done);
  });

});
```

