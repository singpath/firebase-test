'use strict';

exports.wait = function wait(delay) {
  delay = delay || 0;
  return new Promise((resolve) => {
    setTimeout(() => resolve(), delay);
  });
};
