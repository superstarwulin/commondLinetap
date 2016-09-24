var fs = require('fs-extra');
var path = require('path');
var os = require("os");
var util = require("util");
var _ = require("lodash");
var spawnSync = require("child_process").spawnSync;
var execSync = require("child_process").execSync;

var log = require('./log');

var requote_reg = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g;


var cwd = process.cwd();
var seps = cwd.split(path.sep);
var HOME = process.env.HOME;
var tmpDirectory = path.join(os.tmpDir(), 'taptmp', String((+new Date)));


module.exports = {
  spawnSync: function(command, options) {
    var defaultOption = {
      cwd: cwd,
      stdio: 'inherit'
    };
//    command = command.split(' ');
//    var cmd = command[0];
//    var args = command.slice(1);
//    console.log(cmd, args.join(' '));
    log(command);
    var opts = _.merge(defaultOption, options);
    return execSync(command, opts);
  },

  cloneRepoTemp: function(repo){
    var groupAndDir = repo.split(':')[1];
    var rname = groupAndDir.split('/')[1];
    var dname= rname.split('.')[0];
    fs.ensureDir(tmpDirectory);
    var stdout = this.spawnSync(util.format('git clone %s', repo), {
      cwd: tmpDirectory
    });
    return path.join(tmpDirectory, dname);
  },

  Version: function(versionStr){
    this.str = versionStr;
    this.arr = versionStr.split('.').slice(1).map(Number);
    this.num = this.arr[0]*1000+this.arr[1];
  },

  /**
   * 将字符串转义成可在正则表达式中使用的格式。
   * 如 requote('$'); // return "\$"
   * @param s
   * @returns {*}
   */
  requote: function (s) {
    return s.replace(requote_reg, "\\$&");
  },
  extractHost: function (url) {
    var matches = url.match(/^.*?\/\/([a-z0-9\.@_:-]+).*?$/i);
    return matches ? matches[1] : '';
  },
  extractHostName: function (url) {
    var matches = url.match(/^.*?\/\/([a-z0-9\.@_-]+).*?$/i);
    return matches ? matches[1] : '';
  },
  extractIP: function (url) {
    var matches = url.match(/^.*?\/\/((\d{1,3}\.){3}\d{1,3}).*?$/);
    return matches ? matches[1] : '';
  },
  extractPort: function (url) {
    var mateches = url.match(/^.*?\/\/[a-z0-9\.@_-]+(:(\d+))?.*?$/i);
    return mateches && mateches[2] ? mateches[2] : '80';
  }
};