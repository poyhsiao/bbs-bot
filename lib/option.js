'use strict';

var optionNames = require('./option-names');
var NAME = Symbol('name');
var CODE = Symbol('code');

module.exports = Option;

function Option(code) {
  this[CODE] = code;
  this[NAME] = optionNames[code];
}

Option.prototype = {
  get code() {
    return this[CODE];
  },

  get name() {
    return this[NAME];
  },

  toString: function () {
    return '<Option ' + this.name + '>';
  }
};
