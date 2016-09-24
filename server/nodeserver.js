var koa = require('koa');
var demo = require('koa-demo');
var argv = require('optimist').argv;

var log = require('../lib/log').setChild();

var env = process.env;
var cwd = process.cwd();

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var loadUserConfig = function(){
  var userConfigFile = path.join(process.env.HOME, '.tap/demo.js');
  if(fs.existsSync(userConfigFile)){
    return require(userConfigFile);
  }
  return null;
};

var defaultCfg = {
  domains: ['localhost', '127.0.0.1'],
  path: cwd
};

var config = _.extend(defaultCfg, loadUserConfig());

log.info('koa(node) server Listening on http://127.0.0.1:'+argv.port+'\n', 'tap nodeserver');
log.info('Document root is ' + cwd.green + '\n', 'tap nodeserver');

var app = koa();
app.use(demo(config));
app.listen(argv.port);