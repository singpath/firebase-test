'use strict';

const fakeserver = require('./fakeserver');

exports.server = fakeserver.create;

exports.wait = function(delay) {
  delay = delay || 0;

  return new Promise(
    resolve => setTimeout(resolve, delay)
  );
};
