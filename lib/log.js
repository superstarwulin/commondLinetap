colors = require('colors');

var fs = require('fs-extra');
var util = require('util');
var path = require('path');
var _ = require('lodash');
var LEVELS = ['all', 'info', 'warn', 'error'];

var logStream = void(0);
var showLevel = 0;
var debugMode = false;
var isChild   = false;

var OPTS = {
  stdoutLevel: 'all',
  stderrLevel: 'error'
};


colors.setTheme({
  all: 'grey',
  info: 'green',
  warn: 'yellow',
  error: 'red'
});


var _log = function(level) {
  return function(content,name, source) {
    if(typeof content !== 'string'){
      content = JSON.stringify(content);
    }
    if(!content.trim().length){
      return;
    }
    name = name || 'tap';
    if (source == 'custom') {
      content += '\n';
    } else {
      content = ('['+new Date().toLocaleTimeString()+'] ').grey
          + ('['+name+'] ').white
          + colors[LEVELS[level]](content.trim())
          + '\n';
    }

    if(!isChild){
      if(!logStream){
        return console.error("\n**logger未初始化**\n");
      }
      var ok = logStream.write(content.replace(/\u001b\[.*?m/g,''),'utf-8');
      if(!ok){
        console.error("\n**log系统发生了异常**\n");
      }
      if(level >= showLevel){
        process.stdout.write(content);
      }
    }else{
      process.stdout.write(content);
    }
  }
};

var log = function(){ // 默认log方法，兼容原API
  type = arguments[arguments.length - 1];
  if(~LEVELS.indexOf(type)){
    log[type](util.format.apply(null, [].slice.call(arguments,0,-1)), 'tap cli');
  }else{
    log.all(util.format.apply(null,arguments), 'tap cli');
  }
};

log.init = function(){
  if(!debugMode && !isChild){
    log.all = function(){};
  }
  return log;
};


log.all   = _log(0);
log.info  = _log(1);
log.warn  = _log(2);
log.error = _log(3);


log.initLogFile = function(logfile) {
  if(!logfile){
    fs.ensureDirSync(path.join(process.env.HOME,'.tap'));
    logfile = path.join(process.env.HOME,'.tap','tap.log');
  }
  logStream = fs.createWriteStream(logfile,{flags:'a'});
};

log.important = function(content){
  content = "\n********************\n".red + content + "\n********************\n".red;
  log.warn(content, '', 'custom');
};

log.setLevel = function(level) { // 设置日志打印到日志文件等级
  if(!level){
    level = 0;
  }
  showLevel = level;
  return log;
};

log.setDebug = function(debug) {
  debugMode = debug;
  return log;
};

log.setChild = function() { // server日志不打印在日志文件，直接在屏幕输出
  if(!logStream) {
    isChild = true;
  }
  return log;
};

var timeReg = /\s?\[\d\d:\d\d:\d\d\]\s?/;
//var typeReg = /\s?\[(warning|warn|debug|error|log)+?\]\s?/i;
var typeReg = /[^\w\d\-_.]+(\u001b\[.*?m)*(warning|warn|debug|error|log|info)(\u001b\[.*?m)*[^\w\d\-_.]+/i;
var nameMap = {
  log: 'all',
  debug: 'all',
  warning: 'warn',
  warn: 'warn',
  error: 'error',
  info: 'info'
};
var nameReg = /\[([\w\s-]{1,14})\]/;

function handleMessage(type, name, source, analyzer, opts) {
  return function(data){
    if (source == 'custom') { // 如果是自定义，来自子进程的log，则在这里输出
      return console.log(data.toString());
    }
    analyzer(data.toString()).forEach(function(rst) {
      (log[rst.type] ? log[rst.type] : log[opts[type]])(
          rst.content || '',
          rst.name || name
      );
    });
  }
}

log.pipeLog = function(childProcess, name, source, analyzer, opts) {
  opts = _.defaults({}, opts, OPTS);
  analyzer = analyzer || function(str){
    var ref;
    return str.split('\n').filter(function(line) {
      return line.replace(/\s+/, '');
    }).map(function(line) {
      return {
        type: (ref = line.match(typeReg)) ? nameMap[ref[2].toLowerCase()] : void(0),
        name: name = (ref = line.match(nameReg)) ? ref[1] : void(0),
        content: line.replace(timeReg,'').replace(nameReg,'')
      };
    });
  };
  name && log.all(name + " started");

  childProcess.stdout.on('data', handleMessage('stdoutLevel', name, source, analyzer, opts));

  childProcess.stderr.on('data', handleMessage('stderrLevel', name, source, analyzer, opts));

  name && childProcess.on('close',function(code){
    if(code){
      log.error(name + " exited with code " + code);
    }else{
      log.all(name + " finished successfully.");
    }
  });
  return log;
}

module.exports = log;
