'use strict';

var Option = require('./option');
var options = require('./options');
var commandNames = require('./command-names');
var NAME = Symbol('name');
var CODE = Symbol('code');
var OPTION = Symbol('option');
var re = /^(?:DO(?:NT)?|W(?:ILL|ONT)|SB)$/;

module.exports = Command;

function Command(code) {
  this[CODE] = code;
  this[NAME] = commandNames[code];
}

Command.prototype = {
  get code() {
    return this[CODE];
  },

  get name() {
    return this[NAME];
  },

  get option() {
    return this[OPTION];
  },

  toJSON: function () {
    var json = {};
    json.name = this.name;
    json.code = this.code;
    json.option && (json.option = this.option.name);
    return json;
  },

  toString: function () {
    return '<Command ' + this.name
      + (this.option ? ' | ' + this.option.name : '')
      + '>';
  },

  hasOption: function () {
    return re.test(this.name);
  },

  addOption: function (code) {
    this[OPTION] = new Option(code);
  }
};
