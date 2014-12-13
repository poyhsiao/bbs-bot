'use strict';

var fs = require('fs');
var path = require('path');
var files = fs.readdirSync(__dirname);

files
  .filter(function (file) {
    return file !== 'index.js' && /\.js$/.test(file);
  })
  .forEach(function (file) {
    var name = path.basename(file, '.js');
    exports[name] = require(path.join(__dirname, file));
  });
