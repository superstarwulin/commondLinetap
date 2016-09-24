var path = require('path');
var fs = require('fs');
var os = require('os');
var spawn = require('child_process').spawn;
var cwd = process.cwd();
var log = require('./log');
require("colors");

function getRealCommand(cmd) {
	return process.platform === 'win32' ? cmd + '.cmd' : cmd;
}

function getRealTask(command, gulpfile){
  var temp = createTemp(gulpfile);
  var tasks = temp.tasks;
  if(tasks && (command === 'build' && !tasks['build'] && tasks['default'])){
    return 'default';
  }
  return command;
}

//拷贝用户的gulpfile文件，方便获取其中的任务列表，以及增加埋点统计
function createTemp(src) {
  var content = null,
      temp    = null;
	try{
    content = fs.readFileSync(src, 'utf-8');
  }catch(e){
    return null;
  }
	content += ';module.exports = gulp;delete require.cache[require.resolve("gulp")];'; // gulp会被缓存，多个文件的tasks都会合并到一起，所以需要delete掉gulp的缓存
  var timestamp = Date.now();
  var tmpDirectory = path.join(src, '..');
  var tempfile = path.join(tmpDirectory, 'gulpfile-'+timestamp+'.js');

  fs.writeFileSync(tempfile, content, 'utf-8');
  try{
    var temp = require(tempfile);
  }catch(e){
    log.error(e.stack.replace('-'+timestamp, ''));
  }

  try{
    fs.unlinkSync(tempfile);
  }catch(e){}
  return temp;
}

function getCustomGulpfile(command){
  var custom = path.join(cwd, 'gulpfile.js');
  var temp = createTemp(custom);
  if(!temp) return null;
  var tasks = temp.tasks;

  if(tasks && (tasks[command] || (command === 'build' && tasks['default']))){
    return custom;
  }else{
    return null;
  }
}

function getTemplateGulpfile(command){
  var custom = path.join(cwd, '.tap', 'gulpfile.js');
  var temp = createTemp(custom);
  if(!temp) return null;
  var tasks = temp.tasks;

  if(tasks && (tasks[command] || (command === 'build' && tasks['default']))){
    return custom;
  }else{
    return null;
  }
}

module.exports = function(command, cb) {
  var gulpfile = getCustomGulpfile(command) || getTemplateGulpfile(command);
  if (!gulpfile) {
    return cb && cb('NOTFOUND');
  }
  command = getRealTask(command, gulpfile);

  var args = [command, '--gulpfile', gulpfile, '--cwd', cwd];
  var ps = spawn(getRealCommand(path.resolve(__dirname, '../node_modules/.bin/gulp')), args, {
    env: process.env,
    cwd: cwd,
  });
  log.pipeLog(ps,'gulp');
  ps.on('exit', function(code, signal) {
    cb && cb(code || signal);
  });
}
