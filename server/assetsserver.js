var http = require('http');
var https = require('https');

var koa = require('koa');
var join = require('koa-join');
var assets = require('@ali/koa-assets');
var argv = require('optimist').argv;
var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var log = require('../lib/log').setChild();
var Config = require('../lib/config');

var conf = Config.getConfig();

var configFile = path.join(process.env.HOME, '.tap', 'tap.js');
if(fs.existsSync(configFile)){
  var globalConfig = require(configFile);
}

var env = process.env;
function resolveHome(p) {
  return p.replace(/^~/, process.env.HOME);
}

//var defaultRoot = globalConfig && globalConfig.assetsRoot ? resolveHome(globalConfig.assetsRoot) : process.cwd();
var defaultRoot = globalConfig && globalConfig.assetsRoot ? resolveHome(globalConfig.assetsRoot) : path.join(process.env.HOME, '.tap', 'LocalCDNPath');
var cwd = fs.existsSync(argv.root) ? argv.root : defaultRoot;

var loadUserConfig = function () {
  var userConfigFile = path.join(process.env.HOME, '.tap/assets.js');
  if (fs.existsSync(userConfigFile)) {
    return require(userConfigFile);
  }
  return null;
};
var defaultCfg = {
  urls: [
    {
      rule: /([\S]+?)\/([\S]+?)\/[\d\.]*/, //url规则：group/仓库/版本号，例如g.tbcdn.cn/tm/detail/1.2.3
      dest: cwd + '/$1/$2/'         //本地目录规则：当前执行的路径，例如~/gitlab/tm/detail/
    }
  ],
  hosts: {
    //'g.tbcdn.cn': '115.238.23.250',
    'g.tbcdn.cn': '10.101.73.189',
    'g.alicdn.com': '10.101.73.189',
    'g.assets.daily.taobao.net': '10.101.73.189',
    'g-assets.daily.taobao.net': '10.101.73.189',
    's.tbcdn.cn': '10.101.73.189',
    's.assets.daily.taobao.net': '10.101.73.189',
    'a.tbcdn.cn': '10.101.73.189',
    'assets.daily.taobao.net': '10.101.73.189'
  }
};


function loadConfig(conf){
  var cfg = {};
  var urls = defaultCfg.urls.concat();
  var userConfig = conf.assets;
  userConfig && userConfig.urls && userConfig.urls.length && userConfig.urls.forEach(function(_url){
    urls.unshift(_url);
  });
  cfg.urls = urls;
  cfg.hosts = _.merge(_.clone(defaultCfg.hosts), userConfig && userConfig.hosts);
  return cfg;
}

var checkLength = function*(next){
  yield next;
  if(this.response.length > 204800){
    log.warn("请求的资源超过200k url: " + this.request.url, 'tap assets');
  }
}

var config = loadConfig(conf);
Config.onChange(function(newConf){
  config = loadConfig(newConf);
  assets.setConfig(config);
});

var app = koa();

//检查资源大小
app.use(checkLength);

//拆分combo请求
app.use(join());

//assets代理规则
app.use(assets(config));

var httpServerErrorHandler = function(err){
  if (err.errno === 'EADDRINUSE') {
    log.error("port " + argv.port + " is in use. Please check if Tap-assets is already running. (错误编号:E14)", "tap assets");
  } else {
    log.error(err, 'tap assets');
  }
}

if(+argv.sslPort){
  var sslOptions = {
    requestCert: false,
    rejectUnauthorized: false
  };

  try{ // 如果存在用户证书，就用用户证书，否则使用内置证书
    sslOptions.key  = fs.readFileSync(path.join(process.env.HOME, '.tap', 'cert/server.key'));
    sslOptions.cert = fs.readFileSync(path.join(process.env.HOME, '.tap', 'cert/server.crt'));
  }catch(e){
    sslOptions.key  = fs.readFileSync(path.join(__dirname, 'cert/server.key'));
    sslOptions.cert = fs.readFileSync(path.join(__dirname, 'cert/server.crt'));
  }
  https.createServer(sslOptions, app.callback())
    .listen(argv.sslPort)
    .on('error', httpServerErrorHandler);
  log.info('Tap-assets server Listening on https://127.0.0.1:'+argv.sslPort, 'tap assets');
}

http.createServer(app.callback())
  .listen(argv.port)
  .on('error', httpServerErrorHandler);

log.info('Tap-assets server Listening on http://127.0.0.1:'+argv.port, 'tap assets');
log.info('Local CDN web root is ' + cwd + '\n', 'tap assets');
