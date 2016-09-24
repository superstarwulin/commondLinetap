require('colors');
var http = require('http');
var https = require('https');
var fs = require('fs');
var url = require('url');
var path = require('path');
var dns = require('dns');
var httpProxy = require('http-proxy');
var util = require('util');
var log = require('../lib/log').setChild();
var _ = require('lodash');
var Config = require('../lib/config');

var getDestUrl = function(req){
  var fwds = conf.server.monitor.proxy_pass;
  var mapedHost, mapedRewrite;
  var matched = fwds.some(function(fwd){
    fwd.hosts = fwd.server_name || fwd.hosts;
    if(typeof fwd.hosts === 'string'){
      fwd.hosts = fwd.hosts.split(/\s+/g);
    }

    var hosts = fwd.hosts;
    var inHosts = hosts.some(function(host){
      if(host === req.headers.host){
        mapedHost = host;
        return true;
      }
    });

    if(inHosts){
      var rewrites = fwd.rewrite;
      var inRewrite = rewrites.some(function(rewrite){
        if(rewrite.rule.test(req.url)){
          mapedRewrite = rewrite;
          return true;
        }
      });
      if(inRewrite){
        return true;
      }
    }
    return false;
  });

  if(matched){
    var result = req.url.match(mapedRewrite.rule);
    var target = mapedRewrite.target;
    if(result.length === 1){
      target = target.replace('$', result[0]);
    }else if(result.length > 1){
      result.forEach(function(content, key){
        if(key > 0){
          target = target.replace(new RegExp('\\$'+key, 'g'), content);
        }
      });

      target = target.replace('$', result[0]);
    }
    var parts = target.split('//');
    var part1 = parts.slice(0, 1);
    part1.push('//');
    var part2 = parts.slice(1);
    return part1.join('') + part2.join('/');
  }else{
    return null
  }
};

function dnsLook(host, callback){
  dns.resolve(host, function(err, result){
    if(err) return callback(err);
    callback(null, result[0]);
  });
}

function canDNSResolve(str){
  return /^[\d\.\:]$/.test(str)
}

function requestByDNSResolve(req, res, destUrl){
  var host = req.headers.host;
  dnsLook(host, function(err, ip){
    if(err){
      log('DNS resolve fail:', req.headers.host, 'error');
      return;
    }
    log('Forward to online server:', ip.magenta);
    proxy.web(req, res, {
      target: 'http://'+ip+'/'
    }, function(err){
      if(err){
        log('Get from online server error:', destUrl, 'error');
      }
    });
  });
}

var argv = require('optimist').argv;
var port = argv.port;
var sslPort = argv.sslPort;

var conf = Config.getConfig();;
Config.onChange(function(newConf){
  conf = newConf;
});

var proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('X-Special-Proxy-Header', 'tap');
  proxyReq.setHeader('X-WH-REQUEST-URI', req._originUrl);
});

var app = function(req, res) {
  var destUrl = getDestUrl(req);
  var host = req.headers.host;
  if(destUrl){
    var urlObj = url.parse(destUrl);
    req._originUrl = req.url;
    req.headers['X-WH-REQUEST-URI'] = req._originUrl;
    req.url = urlObj.path;
    proxy.web(req, res, {
      target: 'http://' + urlObj.host + '/'
    }, function(err){
      if(err){
        log(destUrl, err.toString(), 'warn');
        if(canDNSResolve(host)){
          requestByDNSResolve(req, res, destUrl);
        }else{
          var body = 'Not Found';
          res.writeHead(404, {
            'Content-Length': body.length,
            'Content-Type': 'text/plain' });
          res.write(body);
          res.end();
        }
      }
    });
  }else{
    if(canDNSResolve(host)){
      requestByDNSResolve(req, res);
    }
  }
};

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

http.createServer(app)
  .listen(port)
  .on('error',function(err){
  if (err.errno === 'EADDRINUSE') {
    log.error("port " + argv.port + " is in use. Please check if tap monitor is already running. (错误编号:E14)", "tap forward");
  } else {
    log.error(err, 'tap forward');
  }
});

https.createServer(sslOptions, app)
  .listen(sslPort)
  .on('error',function(err){
  if (err.errno === 'EADDRINUSE') {
    log.error("port " + argv.port + " is in use. Please check if tap monitor is already running. (错误编号:E14)", "tap forward");
  } else {
    log.error(err, 'tap forward');
  }
});

//log('Server config：', util.inspect(conf.server, false, null), 'debug');
log.info('Monitor server Listening on http://127.0.0.1:'+port+', https://127.0.0.1:'+sslPort, 'tap forward'); // CAUTION: 这行log非常重要不要修改
log.info('Current work directory ' + path.resolve()+'\n', 'tap forward');
