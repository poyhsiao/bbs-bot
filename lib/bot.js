'use strict';

/**
 * Module dependencies.
 */

var co = require('co');
var util = require('util');
var debug = require('debug')('ptt:bot');
var Emitter = require('events').EventEmitter;
var Client = require('./client');
var config = require('./config');
var states = require('../states');

/**
 * Private properties.
 */

var DATA = Symbol('data');
var STATE = Symbol('state');
var WAITING = Symbol('waiting');
var WAITFORDATA = Symbol('waitWorData');
var LISTENERS = Symbol('listeners');
var PREV_STATE = Symbol('prevState');

/**
 * Expose `Bot`.
 */

module.exports = Bot;

/**
 * Bot prototype.
 */

var proto = Bot.prototype;

/**
 * Initialize a new `Bot`.
 *
 * @api public
 * @param {Number} port
 * @param {String} host
 * @param {{columns: Number, rows: Number, stdout: Stream, stderr: Stream} =} options
 */

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

/**
 * User configuration
 *
 * @api public
 */

proto.config = config;

/**
 * `error` event handler
 *
 * @api private
 * @param {Error} e
 */

proto._onError = function (e) {
  if (this.stderr) {
    var msg = util.format('%s: %s\n', new Date(), e.stack || e.message);
    this.stderr.write(msg);
  }
};

/**
 * `data` event handler
 *
 * @api private
 * @param {Buffer} data
 */

proto._onData = function (data) {
  if (this[WAITFORDATA]) {
    this[WAITFORDATA] = false;
    this.emit('moreData', data);
  }
};

/**
 * Add a listener for the event.
 *
 * @api public
 * @param {String} event
 * @return {thunk}
 */

proto.on = function (event) {
  return (function (cb) {
    Emitter.prototype.on.call(this.client, event, cb.bind(null, null));
  }).bind(this);
};


/**
 * Add a one time listener for the event.
 * By default listener will be removed after each `state` is done.
 * This is a useful default which helps preventing memory leak.
 *
 * @api public
 * @param {String} event
 * @param {Boolean} clear
 * @return {thunk}
 */

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

/**
 * Set `state` to `'pause'`.
 *
 * @api public
 * @return {Bot} self
 */

proto.pause = function () {
  this[STATE] = 'pause';
  return this;
};

/**
 * Emit `botResume` event.
 *
 * @api public
 * @return {Bot} self
 */

proto.resume = function () {
  this.emit('botResume');
  return this;
};

/**
 * Change state.
 *
 * @api public
 * @param {String} newState
 * @param {Object =} data
 */

proto.state = function (newState, data) {
  if (!newState) {
    return this[STATE];
  }
  this[STATE] = newState;
  this[DATA] = data || {};
};

/**
 * Get previous state.
 *
 * @api public
 * @return {String}
 */

proto.prevState = function () {
  return this[PREV_STATE];
};

/**
 * Start our bot.
 *
 * @api public
 * @return {String}
 */

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

/**
 * Wait for the given yieldable object(s).
 *
 * @api public
 * @param {GeneratorFunction|Generator|thunk|Promise|Object} gens
 * @return {String =}
 */

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

/**
 * @api public
 * @param {Array[String]} cmds
 */

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

/**
 * @api public
 */

proto.waitForMoreData = function *() {
  this[WAITFORDATA] = true;
  yield this.once('moreData');
};


/**
 * Example:
 *
 *     var stop = false;
 *     ar count = 0;
 *     while (stop && count < 5) {
 *       stop = this.waitForData(/text/);
 *       count += 1;
 *     }
 *
 * @api public
 * @param {RegExp} re
 * @return {Boolean}
 */
proto.waitForData = function *(re) {
  yield this.waitForMoreData();
  return re.test(this.read());
};

/**
 * @api public
 */

proto.get = function (key) {
  return this[DATA][key];
};

/**
 * @api public
 */

proto.up = function () {
  this.csin('A');
};

/**
 * @api public
 */

proto.down = function () {
  this.csin('B');
};

/**
 * @api public
 */

proto.right = function () {
  this.csin('C');
};

/**
 * @api public
 */

proto.left = function () {
  this.csin('D');
};

/**
 * @api public
 */

proto.pageUp = function () {
  this.write('P');
};

/**
 * @api public
 */

proto.pageDown = function () {
  this.write('N');
};

/**
 * @api private
 */

proto.csin = function (cmd) {
  this.write('\u001b[' + cmd);
};
