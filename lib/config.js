
var fs = require('fs');
var path = require('path');

var _ = require('lodash');

var log = require('./log');

var cwd = process.cwd();
var home = process.env.HOME;
var inited = false;

var projConf = path.join(cwd, 'tap.conf.js');
var gConf = path.join(home, '.tap', 'tap.conf.js');

function getGlobalConfig(){
  if(fs.existsSync(gConf)){
    log('Get global config file:'+gConf);
    return require(gConf);
  }
  return {};
}

function getProjectConfig(){
  if(fs.existsSync(projConf)){
    log('Get project config file:'+projConf);
    return require(projConf);
  }
  return {};
}

function fireChange(){
  cbs.forEach(function(cb){
    cb && cb(_.merge(getGlobalConfig(), getProjectConfig()));
  });
}

var cbs = [];
module.exports = {
  cbs: cbs,
  getGlobalConfig: getGlobalConfig,
  getProjectConfig: getProjectConfig,
  getConfig: function(){
    var conf = _.merge(getGlobalConfig(), getProjectConfig());
    this.init();
    return conf;
  },
  init: function(){
    if(!inited){
//      fs.watchFile(projConf, function(){
//        //log('Config file change:', projConf);
//        fireChange();
//      });
//
//      fs.watchFile(gConf, function(){
//        //log('Config file change:', gConf);
//        fireChange();
//      });
      inited = true;
    }
  },
  onChange: function(fn){
    this.init();
    this.cbs.push(fn);
  }
};