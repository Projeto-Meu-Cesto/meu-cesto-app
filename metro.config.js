// Polyfill for Array.prototype.toReversed (required for Node.js < 20)
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function () {
    return [...this].reverse();
  };
}

const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

module.exports = config;
