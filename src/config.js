/**
 * 灵活配置文件
 */
let path = require('path');
module.exports = {
    // 设置监听主机
    host: 'localhost',  
    // 设置监听端口
    port: '8080',       
    // 设置静态服务器根目录
    root: path.resolve(__dirname, '..', 'public')
};