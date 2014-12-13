'use strict';

module.exports = function *() {
  this.writeLine(this.config.username);
  this.writeLine(this.config.password);
  this.state('boot');
};
