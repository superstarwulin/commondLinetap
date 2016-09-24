var http = require('http');
var queryString = require('querystring');
//var trackUrl = 'http://127.0.0.1:8080/fanyu/taplog.php?local=1&';
var trackUrl = 'http://demo.tmall.net/u/fanyu/taplog.php?';
module.exports = function(param){
  var post_data = queryString.stringify(param);

  var post_options = {
    host: 'demo.tmall.net',
    port: '80',
    path: '/u/fanyu/taplog.php',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': post_data.length
    }
  };

//    var post_options = {
//        host: '127.0.0.1',
//        port: '8080',
//        path: '/fanyu/taplog.php?local=1&',
//        method: 'POST',
//        headers: {
//            'Content-Type': 'application/x-www-form-urlencoded',
//            'Content-Length': post_data.length
//        }
//    };

  var post_req = http.request(post_options);

  post_req.write(post_data);
  post_req.end();
}