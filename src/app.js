/**
 * 创建一个服务器
 */
// ===== 核心模块 =====
let http = require('http');
let path = require('path');
let url = require('url');
let fs = require('fs');

// 包装 api 成 promise 方法
let { promisify, inspect } = require('util');
let stat = promisify(fs.stat);
let readdir = promisify(fs.readdir);

// ===== 第三方包 =====
// 处理文件 mime 类型
let mime = require('mime');
// 模板引擎
let handlebars = require('handlebars');
// 给 console 添加样式
let chalk = require('chalk');
// 用于调试，替代 console 
process.env.DEBUG = 'static:*';
let debug = require('debug')('static:app');

// ===== 自定义 =====
let config = require('./config');

// 编译模板，等到一个渲染方法，使用时传入数据时可以得到渲染后的 HTML 
function list() {
    // 只有启动时执行了一次，可以使用同步 api ，影响不大
    let tmpl = fs.readFileSync(path.resolve(__dirname, 'template', 'fileList.html'), 'utf8');
    return handlebars.compile(tmpl);
}
class Server {
    constructor() {
        // 模板函数
        this.list = list();
    }
    // 服务器启动方法
    start() {
        let server = http.createServer();
        // 监听客户端请求，回调函数提取出去
        server.on('request', this.request.bind(this));
        // 监听启动，给与用户提示
        server.listen(config.port, () => {
            let url = `http://${config.host}:${config.port}`;
            debug(`server started at ${chalk.green(url)}`);
        });
    }
    // request 监听函数
    async request(req, res) {
        // 1. 静态资源访问
        // 1.1 需要先取到客户端请求的文件或文件夹路径，需判断
        let { pathname } = url.parse(req.url);
        let filepath = path.join(config.root, pathname);
        try {
            // 1.2 判断路径是否存在，存在的话是文件还是文件夹
            let statObj = await stat(filepath);
            if(statObj.isFile()) {
                // 1.3 请求文件
                this.sendFile(req, res, filepath, statObj);
            } else if(statObj.isDirectory()) {
                // 1.4 请求文件夹，需要用模板引擎返回文件列表
                let files = await readdir(filepath);
                files = files.map(file => ({
                    name: file,
                    url: path.join(pathname, file)
                }));
                let html = this.list({
                    title: pathname,
                    files
                });
                res.setHeader('Content-Type', 'text/html');
                res.end(html);
            }
        } catch(e) {
            debug(inspect(e));
            this.sendErr(req, res);
        }
    }
    // 发送静态文件给客户端
    sendFile(req, res, filepath, statObj) {
        // code 200 默认，可以不写，content-type 需要设置
        res.setHeader('Content-Type', mime.getType(filepath));
        fs.createReadStream(filepath).pipe(res);
    }
    // 发送静态文件目录给客户端
    sendFilePath(req, res, filepath, statObj) {
                    
    }
    // 返回错误给客户端
    sendErr(req, res) {
        res.statusCode = 500;
        res.end(`there is something wrong in the server! please try later!`)
    }
}

let server = new Server();
// 启动服务
server.start();