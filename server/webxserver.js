var server = require('@ali/webx-server');
var path = require('path');
var cwd = process.cwd();
var pkg = require(path.join(cwd, 'package.json'));
var argv = require('optimist').argv;
if(!argv.port){
    argv.port = 80;
}

var dir = (argv.root && argv.root !== true) ? argv.root : 'tmp';
var config = {
    port: argv.port,
    root: path.join(cwd, dir),
    type: 'java',
    rewrite: false,
    timeout: 15,
    comboRule: 'tm/' + pkg.name + '/' + pkg.version
};

//TODO: webx支持多种类型，需要配置类型
if(argv.java) {
    config.type = 'java';
} else if(argv.php) {
    config.type = 'php';
} else if(argv.node) {
    config.type = 'node';
}

server.start(config);