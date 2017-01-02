/**
 * Load rules with it modified JSON encoding.
 */

'use strict';

const path = require('path');
const json = require('firebase-json');

const rulesPath = path.join(__dirname, './rules.json');

module.exports = json.loadSync(rulesPath, 'utf8');
