'use strict';

var net = require('net');
var util = require('util');
var debug = require('debug')('client');
var assert = require('assert');
var Emitter = require('events').EventEmitter;
var iconv = require('iconv-lite');
var Screen = require('./screen');
var Command = require('./command');
var commands = require('./commands');
var COMMAND_MODE = Symbol('commandMode');
var WAIT = Symbol('wait');
var BUFFER = Symbol('buffer');
var CHANGED = Symbol('changed');
var shift = Array.prototype.shift;
var splice = Array.prototype.splice;
var indexOf = Array.prototype.indexOf;

module.exports = Client;

util.inherits(Client, Emitter);

var proto = Client.prototype;

function Client(port, host, options) {
  Emitter.call(this);
  options || (options = {});

  var conn = this.conn = net.connect(port, host);
  this.screen = new Screen(options);
  this.encoding = 'Big5';
  this.stdout = options.stdout;
  this[BUFFER] = new Buffer(0);
  this[CHANGED] = false;
  this[WAIT] = null;
  this[COMMAND_MODE] = null;

  this.history = this.screen.history.bind(this.screen);
  this.destroy = this.conn.destroy.bind(conn);
  conn.on('data', this._onData.bind(this));
  conn.on('error', this._onError.bind(this));
  conn.on('close', this.emit.bind(this, 'close'));
}

proto._onData = function (data) {
  this[BUFFER] = data;

  // 正在等待 option
  if (this[WAIT]) {
    this.parseCommand();
  } else {
    var index = indexOf.call(data, commands.IAC);

    if (~index) {
      // 清掉不必要的資料
      let trash = splice.call(data, 0, index);
      this._write(trash);
      this.parseCommand();

      // 把剩餘資料畫到畫面上
      if (this[COMMAND_MODE] !== 'SB') {
        this._write(data);
      }
    } else {
      this._write(data);
    }
  }
};

proto._onError = function (err) {
  this.conn.destroy();
  this.emit('error', err);
};

proto._write = function (data) {
  if (!Buffer.isBuffer(data)) {
    data = new Buffer(data);
  }

  data = this.decode(data);

  this[CHANGED] = true;
  this.screen.write(data);
  this.stdout && this.stdout.write(data);
  this.emit('data', data);
};

proto.encode = function (data) {
  return iconv.encode(data, this.encoding);
};

proto.decode = function (data) {
  return iconv.decode(data, this.encoding);
};

proto.parseCommand = function () {
  this[WAIT] = false;

  var data = this[BUFFER];
  assert(data.length);
  assert(data[0] === commands.IAC);
  var command = new Command(data[1]);

  // 我們目前不需要處理 option
  // 只有 debug 的時候想知道到底收到了哪些選項，內容不用管
  if (command.hasOption()) {
    if (data.length < 3) {
      // 需要額外 1 byte
      this[WAIT] = true;
      return;
    }
    command.addOption(splice.call(data, 2, 1));
  }

  splice.call(data, 0, 2);

  // 如果指令是 SB 那我們要等待 SE 指令
  // 他們中間所有資料全部忽略
  if (command.name === 'SB') {
    this[COMMAND_MODE] = 'SB';
  }

  // 清除 commandMode
  if (command.name === 'SE') {
    this[COMMAND_MODE] = null;
  }

  debug(command.toString());
  this.emit('command', command);
  this.emit(command.name, command);
};

proto.read = function () {
  if (this[CHANGED]) {
    this[CHANGED] = false;
    return this.screen.read();
  }
  return this.screen.history(0);
};

proto.write = function (data) {
  this.conn.write(this.encode(data));
  return this;
};

proto.writeLine = function (data) {
  this.write(data + '\r\n');
  return this;
};
