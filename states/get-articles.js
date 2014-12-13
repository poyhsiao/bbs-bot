'use strict';

var wait = require('co-wait');
var ansiRe = require('ansi-regex')();
var debug = require('debug')('states:get-articles');

var anyKeyRe = /請按任意鍵繼續/;
var boardRe = /看板《.*?》/;
var articleRe = /^(\S)?\s+(\d+)\s+(.*?)(\d{2}\/\d{2})\s+(\w+)\s+(\S+)\s+(.*)$/m;
var deletedRe = /\(已被\w+刪除\)/;

module.exports = function *() {
  debug('取得 %s 裡的文章', this.get('board'));

  // 等待一下子
  yield wait(1000);

  // 到文章列表
  debug('進版');
  this.writeLine('s' + this.get('board'));
  
  // 等待換頁
  yield this.waitForMoreData();
  var screen = this.read();

  // 任意鍵
  if (anyKeyRe.test(screen)) {
    debug('歡迎畫面');
    screen = '';
    this.writeLine('');

    // 需要 timeout 嗎？不確定
    let stop = false;
    while (stop) {
      stop = yield this.waitForData(boardRe);
    }
  }

  // 文章列表
  while (1) {
    // 等待
    yield wait(1000);
    screen = this.read();

    debug('列表換頁');
    screen = screen.replace(ansiRe, '');
    yield article.call(this, screen);
    this.up();
    yield this.waitForMoreData();

    // 檢查是否還在列表頁
    if (!boardRe.test(screen)) {
      debug('悲劇，不知道位什麼跳出列表頁了');
      this.state('boot');
      return;
    }
  }

  // 返回主功能表
  this.state('back-to-home');
};

function *article(screen) {
  var match = screen.match(articleRe);

  // 搞笑，這邊不是列表頁啦
  if (!match) {
    return;
  }

  if (deletedRe.test(match[0])) {
    debug('"%s" 已刪除', match[7]);
    return;
  }

  debug('進入 "%s"', match[7]);
  this.right();

  // 爬文，還沒實作

  debug('離開 "%s"', match[7]);
  this.left();
}
