var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var argv = require('optimist').argv;
var env = process.env;
var cwd = process.cwd();
var async = require('async');
var log = require('../lib/log').setChild();

var phpURL = ' http://cn2.php.net/downloads.php ';

//检查php版本，若php不存在或版本低于5.4，无法启动本地http服务器，需要下载或更新
async.waterfall([
    function(callback) {
        exec('php --version', {
            env: env,
            cwd: cwd
        }, function(error, stdout, stderr) {
            if (error) {
                return callback(new Error('未安装PHP，请前往' + phpURL + '下载安装'));
            }
            callback(null, stdout);
        });
    },
    function(versionMessage, callback) {
        var version = versionMessage.split(' ')[1].split('.');
        if (version[0] < 5 || (version[0] === 5 && version[1] < 4)) {
            return callback(new Error('PHP本地服务需要的PHP最低版本为5.4.0，您的当前版本为' + version.join('.') + '，请前往' + phpURL + '下载安装'));
        }else{
            log.all('Checking PHP version: ' + version.join('.'), 'tap phpserver');
        }
        callback(null);
    }
], function(err, result) {
    if (err) {
        console.error(err.message);
        return;
    }

    log.pipeLog(
        spawn('php', ['-S', '127.0.0.1:' + argv.port, path.join(__dirname, 'index.php')], {
            env: env,
            cwd: cwd,
            stdio: 'pipe'
        }), 'tap phpserver'
    );

    log.info('php server Listening on http://127.0.0.1:'+argv.port+'\n', 'tap phpserver');
    log.info('Document root is ' + cwd.green + '\n', 'tap phpserver');
});