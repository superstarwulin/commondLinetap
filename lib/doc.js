require("colors");
var path = require("path");
var open = require("open");
var log = require("./log");
var utils = require("./util");

module.exports = {
  getMeta: function(){
    var meta = require('../meta/doc.json');
    return meta;
  },

  notFound: function(doc){
    console.log("不存在 "+doc+" 文档，执行 "+"tap doc".green+" 查看已有文档!");
  },

  browse: function(doc){
    var docs = this.getMeta();
    if(doc){
      var document = docs[doc];
      if(document){
        if(document.link){
          var origin = docs[document.link];
          if(origin && origin.url){
            open(origin.url);
          }else{
            this.notFound(doc);
          }
        }else{
          open(document.url);
        }
      }else{
        this.notFound(doc);
      }
    }else{
      console.log("执行 "+"tap doc".green+" <doc>".green+" 打开文档链接，添加文档链接请联系 @饭鱼");
      console.log("已有文档链接：", Object.keys(docs).join(', '));
    }
  }
}