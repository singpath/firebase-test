'use strict';

exports.wait = function(delay) {
  delay = delay || 0;

  return new Promise(
    resolve => setTimeout(resolve, delay)
  );
};
