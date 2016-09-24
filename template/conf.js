
var assetsPort = 9000;
var whPort = 3000;

module.exports = {
  commands: [
    {
      command: 'tap assets -p ' + assetsPort
    },
    {
      commands: 'wh-cli -p ' + whPort
    }
  ],

  forward: [ //端口转发配置
    {
      hosts: 'g.tbcdn.cn g.assets.daily.taobao.net',  //assets
      rewrite: [
        {
          rule: /^(.*)$/,
          target: 'http://127.0.0.1:'+assetsPort+'/$1'
        }
      ]
    },
    {
      hosts: 'vip.tmall.com',   //wormhole服务
      rewrite: [
        {
          rule: /^(.*)$/,
          target: 'http://127.0.0.1:'+whPort+'/$1'
        }
      ]
    }
  ],

  assets: [
    {
      urls: [
        {
          rule: /([\S]+?)\/([\S]+?)\/[\d\.]*/, //url规则：group/仓库/版本号，例如g.tbcdn.cn/tm/detail/1.2.3
          dest: cwd + '/$1/$2/'         //本地目录规则：当前执行的路径，例如~/gitlab/tm/detail/
        }
      ],
      hosts: {
        //'g.tbcdn.cn': '115.238.23.250',
        'g.tbcdn.cn': '10.101.73.189',
        'g.assets.daily.taobao.net': '10.101.73.189',
        's.tbcdn.cn': '10.101.73.189',
        's.assets.daily.taobao.net': '10.101.73.189',
        'a.tbcdn.cn': '10.101.73.189',
        'assets.daily.taobao.net': '10.101.73.189'
      }
    }
  ]
};