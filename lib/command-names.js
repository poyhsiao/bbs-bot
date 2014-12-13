'use strict';

var commands = require('./commands');
var names = module.exports;

Object.keys(commands).forEach(function (key) {
  names[commands[key]] = key;
});
