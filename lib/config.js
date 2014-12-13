'use strict';

var fs = require('fs');
var deepFreeze = require('deep-freeze');
var config = require('../config.json');

// 禁止修改
module.exports = deepFreeze(config);
