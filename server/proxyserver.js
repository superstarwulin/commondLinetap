require('colors');
var http = require('http');
var fs = require('fs');
var parse_url = require('url').parse;
var path = require('path');
var dns = require('dns');
var httpProxy = require('http-proxy');
var argv = require('optimist').argv;
var util = require('../lib/util');

var log = require('../lib/log').setChild();

function parseUrl(url) {
  // need to consider the combo url,
  // such as 'http://a.b.c/??d.js,e.js,f.js?t=1234'
  var obj = parse_url(url.replace(/\?\?/, '__COMBO_TAG__'));
  obj.path && (obj.path = obj.path.replace(/__COMBO_TAG__/, '??'));
  obj.pathname && (obj.pathname = obj.pathname.replace(/__COMBO_TAG__/, '??'));
  return obj;
}

function resolveHome(p) {
  return p.replace(/^~/, process.env.HOME);
}

function concatRule(config1, config2) {
  return (config2 || []).concat(config1 || []);
}

var config = {},
  watched1 = false,
  watched2 = false;
function pullConfig() {
  var globalConfig, projectConfig;

  var globalConfigFilePath = path.resolve(resolveHome('~/.tap/tap.js'));
  if (fs.existsSync(globalConfigFilePath)) {
    var contents = fs.readFileSync(globalConfigFilePath, 'utf-8');

    //防止修改过程中语法错误
    try {
      globalConfig = eval(contents).proxy;
      if (globalConfig && !(globalConfig instanceof Array)) {
        return log.error('配置文件 '+globalConfigFilePath+' 字段格式有误，请参考：'+fs.readFileSync(path.resolve(__dirname, '../sample/tap.js'), 'utf-8'), 'tap proxyserver');
      }
      log.all('Build/update proxy rules from the customized proxy config file ' + globalConfigFilePath + ' successfully!', 'tap proxyserver');
    } catch (e) {
    }

    if (!watched1) {
      fs.watchFile(globalConfigFilePath, function () {
        pullConfig();
      });
      watched1 = true;
    }
  }

  var projectConfigFilePath = path.join(process.cwd(), 'tap.js');
  if (fs.existsSync(projectConfigFilePath)) {
    var contents = fs.readFileSync(projectConfigFilePath, 'utf-8');
    try {
      projectConfig = eval(contents).proxy;
      if (projectConfig && !(projectConfig instanceof Array)) {
        return log.error('配置文件 '+projectConfigFilePath+' 字段格式有误，请参考：'+fs.readFileSync(path.resolve(__dirname, '../sample/tap.js'), 'utf-8'), 'tap proxyserver');
      }
      log.all('Build/update proxy rules from the proxy config file tap.js in your project directory successfully!', 'tap proxyserver');
    } catch (e) {
    }

    if (!watched2) {
      fs.watchFile(projectConfigFilePath, function () {
        pullConfig();
      });
      watched2 = true;
    }
  }

  if (!globalConfig && !projectConfig) {
    return log.error(globalConfigFilePath + ' 和 ' + projectConfigFilePath + ' 配置必须至少有一个！', 'tap proxyserver');
  }

  // rebuild the config
  var lastConfig = config;
  config = {};

  var rules = concatRule(globalConfig, projectConfig);
  rules.forEach(function (rule) {
    var hosts = rule.hosts;
    delete rule.hosts;
    hosts.forEach(function (host) {
      config[host] = rule;
    });
  });

  // empty config check
  if (lastConfig != config && Object.keys(config).length == 0) {
    log.warn('转发配置内容为空，请先手动在项目根目录或全局目录（~/.tap/）下创建并配置文件(tap.js)，配置规则参考 http://gitlab.alibaba-inc.com/tap/tap/blob/master/sample/tap.js','tap proxyserver');
  }

  // recycle the cache and free the memory
  if (lastConfig != config /* config changed */
    // average request count per web page is 200 at most,
    // and the usage of memory for 'cache' is about range from 45kb to 90kb.
    || Object.keys(cache) > 200 /* to avoid too heavy usage of memory */
    || (+new Date) - lastTime > 20 * 60 * 1000 /* more than 20 minutes */) {
    cache = {};
    lastTime = +new Date;
  }

  return config;
}

pullConfig();

var cache = {},
  lastTime = +new Date;

// rewrite request url.
function router(req, callback) {
  var host = req.headers.host,
    rule = config[host],
    srcUrl = 'fake://'
      + host + (req.url == '/' ? '' : req.url), // use 'fake:' because the protocol can't be fetched from 'req'.
    tarUrl = srcUrl,
    hostChanged = false;

  if (cache[srcUrl]) {
    if (!cache[srcUrl].tarUrl.length) {
      log.warn(srcUrl.replace(/fake:/, '') + 'skips the proxy service because of no rules for it in tap.js', 'tap proxyserver');
    }
    return callback(cache[srcUrl]); // visited, so directly return.
  }

  if (rule) {
    if (rule.urls && rule.urls.length) {
      rule.urls.forEach(function (it) {
        if (!(it.rule instanceof RegExp)) {
          it.rule = new RegExp(util.requote(it.rule.toString()));
        }

        tarUrl = tarUrl.replace(it.rule, it.dest);
        if (tarUrl !== srcUrl) {
          hostChanged = parse_url(tarUrl).host !== host;
          if (hostChanged) {
            return false;
          }
        }
      });
    }

    if (rule.ips && rule.ips.length) {
      var a = !hostChanged ? [] : [tarUrl];
      var _host = parse_url(tarUrl).host;
      rule.ips.forEach(function (ip) {
        a.push(tarUrl.replace(_host, ip)); // maybe host has changed above, so use `parse_url(tarUrl).host`.
      });
      tarUrl = a;
    }
  }

  if (!(tarUrl instanceof Array)) {
    tarUrl = tarUrl === srcUrl ? [] : [tarUrl];
  }

  function canDNSResolve(str){
    return typeof str === 'string' ? /^[\d\.\:]$/.test(str) : false;
  }

  if(canDNSResolve(host)){
    // use online DNS server to resolve the host.
    dns.resolve(host, function (err, addrs) {
      if (!err) {
        var last = tarUrl[tarUrl.length - 1];
        var _host = parse_url(last || '').host; // maybe is 'null', but it doesn't matter.
        addrs.forEach(function (ip) {
          if (last) {
            tarUrl.push(
              last.replace(_host, ip),
              srcUrl.replace(host, ip) /* a backup */
            );
            if (tarUrl[tarUrl.length - 1] == tarUrl[tarUrl.length - 2]) { // when the backup is equal to the last but one.
              tarUrl.pop();
            }
          } else {
            tarUrl.push(srcUrl.replace(host, ip)); // directly to push a backup.
          }
        });
      } else {
        log.warn('Online DNS server can\'t resolve the host ' + host.yellow);
      }

      if (!tarUrl.length) {
        log.warn(srcUrl.replace(/fake:/, '') + 'skips the proxy service because of no rules for it in tap.js', 'tap proxyserver');
      }

      callback(cache[srcUrl] = {
        srcUrl: srcUrl,
        tarUrl: tarUrl
      });
    });
  }else{
    if(tarUrl.length){
      callback(cache[srcUrl] = {
        srcUrl: srcUrl,
        tarUrl: tarUrl
      });
    }else{
      callback(null);
    }
  }
}

var proxy = httpProxy.createProxyServer();
http
  .createServer(function (req, res) {
    router(req, function (r) {
      if(!r){
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        return res.end('not dns resolved!');
      }

      var srcUrl = r.srcUrl;
      var tarUrl = r.tarUrl;

      function recurse(i, len, err, req, res) {
        if (i < len) { // try again.
          if (i == 0) {
            log.info('尝试代理请求：' + srcUrl.replace(/fake:/, '').green + ' => '
              + tarUrl[i].replace(/fake:/, '').green, 'tap proxyserver');
          } else {
            log.info('再试代理请求：' + srcUrl.replace(/fake:/, '').grey + ' => '
              + tarUrl[i].replace(/fake:/, '').grey, 'tap proxyserver');
          }

          var obj = parseUrl(tarUrl[i]);
          req.url = obj.path || ((obj.pathname || '') + (obj.search || '')) || req.url;
          proxy.web(req, res, {
            target: {
              host: obj.hostname || obj.host.replace(/:\d+$/, ''),
              port: obj.port || 80
            }
          }, function (err, req, res) {
            log.warn('代理请求失败：' + srcUrl.replace(/fake:/, '').red + ' => '
              + tarUrl[i].replace(/fake:/, '').red, 'tap proxyserver');
            recurse(++i, len, err, req, res); // retry
          });
        } else {
          if (err) {
            if (err.code === 'ECONNREFUSED') {
              log.error('代理请求失败：' + srcUrl.replace(/fake:/, '').red + ' => '
                + tarUrl[0].replace(/fake:/, '').red + ' ... '
                + tarUrl[tarUrl.length - 1].replace(/fake:/, '').red, 'tap proxyserver');
            }

            res.writeHead(500, {
              'Content-Type': 'text/plain'
            });
            res.end(err.message);
          }
        }
      }

      recurse(0, tarUrl.length, undefined, req, res);
    });
  })
  .listen(argv.port);

log.info('Monitor server Listening on http://127.0.0.1:'+argv.port+'\n', 'tap proxyserver');
log.info('Current work directory ' + path.resolve()+'\n', 'tap proxyserver');

