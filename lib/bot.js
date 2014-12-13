'use strict';

var co = require('co');
var util = require('util');
var debug = require('debug')('ptt:bot');
var Emitter = require('events').EventEmitter;
var Client = require('./client');
var config = require('./config');
var states = require('../states');
var DATA = Symbol('data');
var STATE = Symbol('state');
var WAITING = Symbol('waiting');
var WAITFORDATA = Symbol('waitWorData');
var LISTENERS = Symbol('listeners');
var PREV_STATE = Symbol('prevState');

module.exports = Bot;

Bot.config = config;

var proto = Bot.prototype;

function Bot(port, host, options) {
  var client = this.client = new Client(port, host, options);
  this.stderr = options.stderr;
  this[PREV_STATE] = null;
  this[STATE] = 'boot';
  this.emit = client.emit.bind(client);
  this.write = client.write.bind(client);
  this.writeLine = client.writeLine.bind(client);
  this.read = client.read.bind(client);
  this.history = client.history;
  this[WAITING] = false;
  this[WAITFORDATA] = false;
  this[LISTENERS] = [];
  client.on('error', this._onError.bind(this));
  client.on('data', this._onData.bind(this));
}

proto.config = config;

proto._onError = function (e) {
  if (this.stderr) {
    var msg = util.format('%s: %s\n', new Date(), e.stack || e.message);
    this.stderr.write(msg);
  }
};

proto._onData = function (data) {
  if (this[WAITFORDATA]) {
    this[WAITFORDATA] = false;
    this.emit('moreData', data);
  }
};

proto.on = function (event) {
  return (function (cb) {
    Emitter.prototype.on.call(this.client, event, cb.bind(null, null));
  }).bind(this);
};

proto.once = function (event, clear) {
  return (function (cb) {
    var listener = cb.bind(null, null);

    // wait 的時候事件可能不會被觸發
    // 所以當 wiat 結束時要將所有一次性 listener 移除
    // 避免 memory leak
    if (this[WAITING] && clear !== false) {
      this[LISTENERS].push({
        event: event,
        listener: listener
      });
    }

    Emitter.prototype.once.call(this.client, event, listener);
  }).bind(this);
};

proto.pause = function () {
  this[STATE] = 'pause';
  return this;
};

proto.resume = function () {
  this.emit('botResume');
  return this;
};

proto.state = function (newState, data) {
  if (!newState) {
    return this[STATE];
  }
  this[STATE] = newState;
  this[DATA] = data || {};
};

proto.prevState = function () {
  return this[PREV_STATE];
};

proto.go = function *() {
  debug('start');

  while (1) {
    while (this[STATE] !== 'pause') {
      let prevState = this[STATE];
      debug('state %s => %s', this[PREV_STATE], this[STATE]);
      yield states[this[STATE]].call(this);
      this[PREV_STATE] = prevState;
    }

    process.nextTick(function () {
      debug('ready');
      this.emit('ready');
    }.bind(this));

    yield this.once('botResume', false);
  }
};

proto.wait = function (gens) {
  this[WAITING] = true;

  var keys = Object.keys(gens);
  debug('wait %s', keys);

  return (function (cb) {
    var done = (function (err, key) {
      if (done.called) {
        return;
      }

      done.called = true;
      this[WAITING] = false;

      // 移除一次性 listener
      this[LISTENERS].forEach(function (data) {
        this.client.removeListener(data.event, data.listener);
      }.bind(this));

      cb(err, key);
    }).bind(this);

    keys.forEach(function (key) {
      // 這邊不用接收回傳資料是因為這個 method 只是用來等待某個事件完成而已
      co.call(this, function *() {
        yield gens[key];
      })
        .then(function () {
          done(null, key);
        }, function (err) {
          done(err, key);
        });
    }.bind(this));
  }).bind(this);
};

proto.waitForCommands = function (cmds) {
  return (function (cb) {
    this.once('command')(function (err, command) {
      if (err) {
        return cb(err);
      }
      if (~cmds.indexOf(command.name)) {
        cb();
      }
    });
  }).bind(this);
};

proto.waitForMoreData = function *() {
  this[WAITFORDATA] = true;
  yield this.once('moreData');
};

// var stop = false;
// var count = 0;
// while (stop && count < 5) {
//   stop = this.waitForData(/text/);
//   count += 1;
// }
proto.waitForData = function *(re) {
  let data = yield this.waitForMoreData();
  data = this.decode(data);
  return res.test(data);
};

proto.get = function (key) {
  return this[DATA][key];
};

proto.up = function () {
  this.csin('A');
};

proto.down = function () {
  this.csin('B');
};

proto.right = function () {
  this.csin('C');
};

proto.left = function () {
  this.csin('D');
};

proto.pageUp = function () {
  this.write('P');
};

proto.pageDown = function () {
  this.write('N');
};

proto.csin = function (cmd) {
  this.write('\u001b[' + cmd);
};
