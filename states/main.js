'use strict';

var debug = require('debug')('states:main');

module.exports = function *() {
  // 主功能表後等待使用者指令
  this.state('pause');
};
