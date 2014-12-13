'use strict';

var options = require('./options');
var names = module.exports;

Object.keys(options).forEach(function (key) {
  names[options[key]] = key;
});
