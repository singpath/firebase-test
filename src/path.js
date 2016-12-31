'use strict';

exports.trim = function(path = '') {
  return path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
};

exports.join = function(...paths) {
  return [].concat(...paths).map(s => exports.trim(s)).join('/');
};
