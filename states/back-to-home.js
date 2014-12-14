'use strict';

var wait = require('co-wait');
var mainPageRe = /【主功能表】/;

module.exports = function *() {
  while (1) {
    let screen = this.read();

    if (mainPageRe.test(screen)) {
      break;
    }

    // 返回前一頁
    this.left();

    // 等待更多資料
    let key = yield this.wait({
      cmds: this.waitForMoreData(),
      timeout: wait(2000)
    });

    // 不知道發生了什麼意外，讓他回到 boot 狀態
    if (key === 'timeout') {
      this.state('boot');
      return;
    }

    yield wait(500);
  }

  this.state('main');
};
