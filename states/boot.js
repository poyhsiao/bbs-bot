'use strict';

var wait = require('co-wait');
var debug = require('debug')('states:boot');
var loginPageRe = /請輸入代號/;
var anyKeyRe = /按任意鍵繼續/;
var editorRecoverRe = /【\s*編輯器自動復原\s*】/;
var mainPageRe = /【主功能表】/;
var confirmRe = /\[Y\/n\]/i;

module.exports = function *() {
  // 等待事件
  var key = yield this.wait({
    cmds: this.waitForCommands(['WILL', 'DO', 'GA', 'SE']),
    timeout: wait(2000)
  });

  var screen = this.read();
  var page;

  // 判斷當前頁面
  switch (true) {
    case loginPageRe.test(screen):
      this.state('login');
      break;
    case anyKeyRe.test(screen):
      this.state('anykey');
      break;
    case confirmRe.test(screen):
      this.state('confirm');
      break;
    case mainPageRe.test(screen):
      this.state('main');
      break;
    case editorRecoverRe.test(screen):
      this.state('editor-recover');
      break;
    default:
      this.state('back-to-home');
  }
};
