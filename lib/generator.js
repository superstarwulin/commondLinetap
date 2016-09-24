
var fs = require('fs-extra');
var ejs = require('ejs')
var path = require('path');
var _ = require('lodash');
var Walker = require('walker');
var execSync = require('child_process').execSync;
var log = require('./log');

var cwd = process.cwd();
//var HOME = process.env.HOME;

var seps = cwd.split(path.sep);
var ctx = {
  CWD: cwd,
  DIRNAME: seps[seps.length-1]
};

var defaultOption = {
  cwd: cwd,
  stdio: 'inherit'
};

module.exports = function(entry, callback){
  var src = path.join(entry, 'content');
  var file = path.join(entry, 'index.js');
  if(fs.existsSync(file)){
    var initer = require(file);
    interactor(initer, function(){
      proceesure(src, initer, callback);
    });
  }else{
    proceesure(src, null, callback);
  }
};

function proceesure(src, initer, callback){
  Walker(src)
    .on('dir', function(dir, stat) {
      var rel = path.relative(src, dir);
      if(!rel){
        return;
      }
      var dest = path.resolve(cwd, rel);
      if(!fs.existsSync(dest)){
        log('create:', dest);
        try{
          fs.mkdirsSync(dest);
        }catch(e){
          callback && callback(e);
        }
      }else{
        log('exists:', dest, 'warn');
      }
    })
    .on('file', function(file, stat) {
      var rel = path.relative(src, file);
      var dest = path.resolve(cwd, rel);

      if(!fs.existsSync(dest)){
        log('create:', dest);
        try{
          var contents = fs.readFileSync(file, 'utf-8');
          return fs.writeFileSync(dest, parse(contents, ctx));
        }catch(e){
          callback && callback(e);
        }
      }else{
        if(initer.overwrite){
          var existsContents = fs.readFileSync(dest, 'utf-8');
          var contents = fs.readFileSync(file, 'utf-8');
          var newContents = initer.overwrite(existsContents, parse(contents, ctx));
          if(newContents){
            fs.writeFileSync(dest, contents);
            log('overwrite:', dest);
          }
        }
        return log('exists:', dest, 'warn');
      }
    })
    .on('end', function() {
      exec(initer, callback);
    });
}

function interactor(initer, cb){
  var variables = initer.variables;
  var keys = Object.keys(variables);
  function next(){
    if(keys && keys.length){
      var cur = keys.shift();
      var field = variables[cur];
      ask(field, function(raw){
        var data = _.trim(raw);
        var answer = data || field.default || '';
        ctx[cur] = parse(answer);
        if(keys.length){
          next();
        }else{
          process.stdin.destroy();
          cb && cb();
        }
      });
    }else{
      cb && cb();
    }
  }
  next();
}

function ask(field, callback){
  process.stdout.write('\033[90m' + parse(field.question) +  (field.default ? '(默认为' + parse(field.default) + ')' : '') + ':' + '\033[0m');
  process.stdin.setEncoding('utf8');
  process.stdin.once('data', callback).resume();
}

function parse(str){
  return ejs.render(str, ctx);
}

function exec(initer, callback){
  var commands = initer.commands;
  commands && commands.forEach(function(cmd){
    if(cmd.command){
      var command = parse(cmd.command);
      var options = {};
      if(command.slice(0,3) === 'tap'){
        command += ' --child'; // a hack to prevent multi-init
      }
      _.merge(options, defaultOption, cmd.options);
      for(var i in options){
        options[i] = parse(options[i]);
      }
      var stdout;
      try{
        stdout = execSync(command, options);
      }catch(e){
        //log(e.toString(), 'warn');
        return cmd.callback && cmd.callback(e);
      }
      return cmd.callback && cmd.callback(null, stdout);
    }

    if(typeof cmd.execute === "function"){
      cmd.execute(ctx);
    }
  });
  callback && callback();
}


