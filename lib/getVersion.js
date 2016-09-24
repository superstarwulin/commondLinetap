var exec = require('child_process').exec;

module.exports = function(callback){
  exec('git status', function (err, stdout, stderr) {
    var res = stdout.match(/branch daily\/(\d+\.\d+\.\d+)/);
    var bVersion = res ? res[1] : '';
    if (bVersion) {
      callback(bVersion);
    }else{
      callback();
    }
  });
};
