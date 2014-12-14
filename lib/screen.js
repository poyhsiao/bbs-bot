'use strict';

var extend = require('extend.js');
var Terminal = require('terminal.js');
var HISTORY_STACK_SIZE = Symbol('historyStackSize');
var HISTORY_STACK = Symbol('historyStack');

var defaultOptions = {
  columns: 80,
  rows: 30
};

module.exports = Screen;

var proto = Screen.prototype;

function Screen(options) {
  options = extend(defaultOptions, options || {});
  this.term = new Terminal(options);
  this[HISTORY_STACK] = [];
  this[HISTORY_STACK_SIZE] = (options.historyStackSize || 1) | 0;
}

proto.write = function (data) {
  this.term.write(data);
  return this;
};

proto.read = function () {
  var data = this.term.toString('ansi');
  var stack = this[HISTORY_STACK];
  
  stack.unshift(data);
  
  if (stack.length > HISTORY_STACK_SIZE) {
    stack.pop();
  }
  
  return data;
};

proto.history = function (n) {
  return this[HISTORY_STACK][n];
};
