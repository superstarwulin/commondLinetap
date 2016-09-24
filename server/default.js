var childProcess = require("child_process");
var ejs = require("ejs");
var log = require("../lib/log");

var pss = [];

function spawnExec(command, options) {
  commands = command.split(' ');
  var cmd = commands[0];
  var args = commands.slice(1);
  if(cmd === 'tap'){
    args.push('--child'); // a hack to prevent multi-init
  }
  log.all(command);
  var ps = childProcess.spawn(cmd, args, options);
  log.pipeLog(ps,cmd);
  return ps;
  //return childProcess.spawn('sh', ['-c', command], options); // this provides a more flexible usage
}

module.exports = {
  start: function(config){
    var commands = config.server.commands || [];
    if (commands.length) {
      commands.forEach(function (cmd) {
        cmd.options = cmd.options || {};
        if(!cmd.options.stdio){
          cmd.options.stdio = 'pipe';
        }
        log('执行同步命令:%s', cmd.command);
        log.all(childProcess.execSync(cmd.command, cmd.options)+'\n', cmd.command.split(' ')[0]);
      });
      log.all('同步命令执行完毕');
    }
    
    var workers = config.server.workers || [];
    var monitor = {
      command: 'tap monitor -p '+ (config.server.port || 80)
    };

    var ps = pss[0] = spawnExec(monitor.command, monitor.options);

    ps.stdout.on('data', function(trunk){
      var line = trunk.toString();
      if(~line.indexOf('Monitor server Listening on')) {
        workers.forEach(function(worker){
          var opts = worker.options || {};
          opts.cwd = opts.cwd || process.cwd();
          var variable = opts.variable;
          for(var i in opts){
            if(typeof opts[i] === 'string'){
              opts[i] = ejs.render(opts[i], variable);
            }
          }
          pss.push = spawnExec(ejs.render(worker.command, variable), opts);
        });
      }
    });

    log.pipeLog(ps,'monitor');

    process.on('exit', function(){
      pss.forEach(function(child){
        child.kill('SIGINT');
      })
    });

    process.on('SIGINT', function(){ // 如果不注册这个事件，Ctrl+C时exit事件不会被触发
      process.exit(2);
    });
  }
}
