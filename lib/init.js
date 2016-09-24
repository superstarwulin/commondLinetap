require('colors');
var fs = require('fs-extra');
var path = require('path');
var _ = require('lodash');
var cwd = process.cwd();
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;
var util = require('./util');
var log = require('./log');
var gen = require('./generator');
var os = require('os');

var HOME = process.env.HOME;
var tmpDirectory = path.join(os.tmpDir(), 'taptmp', String((+new Date)));

module.exports = {
  exec: function(prog, localTplDir) {
    var tpl = 'template-default';
    if(localTplDir){
      gen(localTplDir, function (err) {
        if (err) {
          return log(err.stack, 'error');
        }
      });
    }else{
      if (typeof prog === 'string') {
        tpl = 'template-' + prog;
      }
      fs.ensureDirSync(tmpDirectory);
      var tplDir = path.join(tmpDirectory, tpl);
      var ps = spawn('git', ['clone', 'git@gitlab.alibaba-inc.com:tap/' + tpl + '.git'], {
        cwd: tmpDirectory,
        stdio: 'pipe'
      });
      log.pipeLog(ps,'git clone',null,null,{stderrLevel:'all'});
      ps.on('exit', function (err) {
        if (err) return;
        gen(tplDir, function (err) {
          if (err) {
            return log(err.stack, 'error');
          }
        });
      });
    }
  }
}


