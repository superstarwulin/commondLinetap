var childProcess = require('child_process');
var os = require('os');
var fs = require('fs-extra');
var path = require('path');
var urllib = require('urllib');
var _ = require('lodash');
var log = require('./log');
require('colors');

var Version = require('./util').Version;
var templateInfoUrl = "http://dip.alibaba-inc.com/api/v2/services/schema/mock/5704";

var copyNewVersion = function(targetVer, templateInfo, cb){
  var tmpDirectory = path.join(os.tmpDir(), 'taptmp', String(+new Date));
  fs.ensureDirSync(tmpDirectory);
  var tplName = 'template-'+templateInfo.name;
  var tplDir = path.join(tmpDirectory, tplName);
  var ps = childProcess.spawn('git', ['clone', 'git@gitlab.alibaba-inc.com:tap/' + tplName + '.git'], {
    cwd: tmpDirectory,
    stdio: 'pipe'
  });
  log.pipeLog(ps,'git clone',null,null,{stderrLevel:'all'});
  ps.on('exit', function (err) {
    if(err) {
      log.error('git clone failed, abort updating!', 'tap update');
      return cb(err);
    }
    try{
      if(targetVer === 'latest'){
        var versions = ('' + childProcess.execSync("git tag -l ", {
          cwd: tplDir,
        }))
          .split('\n')
          .filter(_.identity)
          .map(function(x){return new Version(x)});

        if(!versions.length){
          return log.error('该Template尚未加入版本系统，无法使用tap进行升级','tap update');
        }

        targetVer = _.max(versions,'num').str;
        if(targetVer <= templateInfo.version){
          log.info('已是最新版本，无需再升级','tap update');
          return cb();
        }
      }

      childProcess.execSync("git checkout "+targetVer, {
        cwd: tplDir,
      });
      childProcess.execSync("cp -r -f " + tplDir + '/tap/ ' + process.cwd() + '/.tap');
      childProcess.execSync("tnpm install", {
        cwd: path.join(process.cwd(), '.tap'),
        stdio: 'inherit'
      });
    }catch(e){
      log.error('unexpected error:'+e.stack);
      return cb(e);
    }
    cb(null, targetVer);
  });
}

var updater = function(opts){
  var templateInfo = require(path.join(process.cwd(),'package.json')).tapTemplate;
  if(!templateInfo){
    return log.error('package.json中没有tapTemplate字段, 可能是因为Template版本过低。','tap update');
  }

  var registeredInfo = null;
  urllib.request(templateInfoUrl, function (err, data, res) {
    if (err) {
      return log.error('Get templateInfo failed. Can you connect to DIP?', 'tap update');
    }
    try{
      registeredInfo = _.find(JSON.parse(data.toString()),'name',templateInfo.name);
    }catch(e){
      return log.error('parse templateInfo failed.');
    }
    continuous();
  });

  var continuous = function(){
    if(!registeredInfo){
      return log.error('该Template尚未加入版本系统，无法使用tap进行升级','tap update');
    }

    var currentVer = new Version(templateInfo.version);
    var manual = registeredInfo.manual.map(function(x){
      return {
        version: new Version(x.version),
        url: x.url
      };
    });

    if(opts.fix){
      if(!opts.override && fs.existsSync(path.join(process.cwd(),'.tap'))){
        return log.error('Template已经存在');
      }
      return copyNewVersion(currentVer.str, templateInfo, function(){
        log.info('Template安装完成');
      });
    }

    manual = manual.filter(function(x){
      return x.version.num > currentVer.num;
    });

    if(manual.length && !opts.override){
      var nextManual = manual.sort(function(x,y){return x.version.num > y.version.num})[0];
      if(opts.force){
        var updateToNewest = manual.length === 1;
        var targetVer = nextManual.version.str;
        if(updateToNewest){
          targetVer = 'latest';
        }
        copyNewVersion(targetVer, templateInfo, function(err,newVersion){
          if(!err && newVersion){
            // 更新package.json中的版本号
            var pkgFile = path.join(process.cwd(),'package.json');
            var pkg = require(pkgFile);
            pkg.tapTemplate.version = newVersion;
            fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 4), 'utf-8');
            
            log.info('升级成功~ 现在Template版本为 '+newVersion);
            if(updateToNewest){
              log.info('Template版本已升级到最新');
            }else{
              var next2 = manual.sort(function(x,y){return x.version.num > y.version.num})[1];
              log.warn('Template版本 '+next2.version.str+' 仍需要进行手动升级，请参考 '+next2.url+' 继续进行升级');
            }
          }
        });
      }else{
        log.info('Template版本 '+nextManual.version.str+' 需要进行手动升级，请参考 '+nextManual.url.yellow);
        log.info('如果已经执行完链接中的步骤，使用 tap update -f 来完成升级');
      }
    }else{
      copyNewVersion('latest', templateInfo, function(err, newVersion){
        if(!err && newVersion){
          // 更新package.json中的版本号
          var pkgFile = path.join(process.cwd(),'package.json');
          var pkg = require(pkgFile);
          pkg.tapTemplate.version = newVersion;
          fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 4), 'utf-8');
          log.info('升级成功~ 现在Template版本为 '+newVersion,'tap update');
        }
      });
    }
  }
};

module.exports = updater;