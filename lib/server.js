var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var dns = require('dns');
var _ = require('lodash');
var log = require('./log');
var Config = require('./config');

var commandPrefixer = process.platform === 'win32' ? '' : 'sudo';

var servers = {
  assets: '../server/assetsserver.js',
  node: '../server/nodeserver.js',
  webx: '../server/webxserver.js',
  php: '../server/phpserver.js',
  proxy: '../server/proxyserver.js',
  forward: '../server/forward.js',
  default: '../server/default.js'
};

var checkHost = function(proxyPasses, cb){
  var count = 0;
  proxyPasses
    .filter(function(proxy){
      return proxy.rewrite.some(function(rewriter){
        return /^http:\/\/(127.0.0.1|localhost)/.test(rewriter.target);
      });
    })
    .map(function(proxy){
      return proxy.server_name;
    })
    .join(' ')
    .split(' ')
    .map(function(x){return x.trim()})
    .filter(function(x){return x})
    .forEach(function(server){
      count += 1;
      dns.lookup(server,function(err, addr){
        if(err || addr === '127.0.0.1'){ // on error just skip
          if(err){
            log.all('check host failed', 'tap server');
          }
          if(count === 1){
            cb();
          }
          return count -= 1;
        }
        cb('IP_INCORRECT');
        cb = function(){}; // disable following callbacks
      });
    });
}

module.exports = {
  start: function (config) {
    var cwd = process.cwd();
    var args = [];
    var type = config.type || 'default';
    delete config.type;

    if(type === 'default'){
      var cfg = Config.getConfig();
      if(_.isEmpty(cfg)){
        log.error('不存在tap server所需配置文件')
        log(fs.readFileSync(path.join(__dirname, '..', 'sample', 'tap.js'), 'utf-8'));
        process.exit(1);
      }

      checkHost(cfg.server.monitor.proxy_pass,function(err){ //如需强制，将后面的逻辑都移到回调函数里即可
        if(err){
          return log.important("域名解析IP不是本地IP，请检查Host文件是否已正确设置 (错误编号:E13)");
        }
      });

      return require(servers[type]).start(cfg);
    }

    _.each(config, function (value, key) {
      if (typeof value === 'boolean') {
        if (value) {
          args.push('--' + key);
        }
      } else {
        if (value && value.toString().trim()){
          args.push('--' + key, value.toString().trim());
        }
      }
    });

//      var nodeBin = path.join(__dirname, '..', 'node_modules', '.bin', 'node-dev');
//      nodeBin = getRealCommand(nodeBin);
    var nodeBin = 'node';

    if (type != 'assets' && type != 'webx' && config.port != 80) {
      commandPrefixer = '';
    }

    var program, arguments;
    if (commandPrefixer) {
      program = commandPrefixer;
      arguments = [nodeBin, '--harmony', path.resolve(__dirname, servers[type])].concat(args);
    } else {
      program = nodeBin;
      arguments = ['--harmony', path.resolve(__dirname, servers[type])].concat(args);
    }

    log('A child process started to run the command:',
      program.bold, arguments.join(' ').bold);

    log.pipeLog(
      spawn(program, arguments, {
        env: process.env,
        cwd: cwd,
        stdio: 'pipe'
      }),
      type,
      'custom'
    );

    // maybe should kill these sub process when process.on('SIGINT') ?
  }
};