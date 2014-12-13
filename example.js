'use struct';

// buffer 要清，有點麻煩

var co = require('co');
var Bot = require('./lib/bot');

// debug 的時候印出 debug 訊息而不是畫面
var bot = new Bot(23, 'ptt.cc', {
  stdout: process.env.DEBUG ? null : process.stdout
});

// bot
co(function *() {
  yield bot.go();
}).catch(errorHandler);

// 使用者操作
// 可以放到 server handler 裡面跑
co(function *() {
  while (1) {
    // 等待 bot 能夠接收指令
    // 第二個參數代表不要被 bot 自動清除，自動清除是為了避免 memory leak
    yield bot.once('ready', false);

    bot.state('get-articles', {
      board: 'beauty',
      from: new Date('2014-10-01')
    });

    bot.resume();
  }
}).catch(errorHandler);

// 讓 error 顯示的比較漂亮
function errorHandler(err) {
  console.log();
  console.log(err.stack.replace(/^/gm, '  '));
  console.log();
}
