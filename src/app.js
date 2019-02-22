/**
 * 创建一个服务器
 */
// ===== 核心模块 =====
let http = require('http');
let path = require('path');
let url = require('url');
let fs = require('fs');
let zlib = require('zlib');
let crypto = require('crypto');

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
// 本地调试时用，可以省略环境变量设置
process.env.DEBUG = 'static:*';
// 用于调试，替代 console 
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
    constructor(argv) {
        // 模板函数
        this.list = list();
        // 配合参数
        this.config = Object.assign({}, config, argv);
    }
    // 服务器启动方法
    start() {
        let server = http.createServer();
        // 监听客户端请求，回调函数提取出去
        server.on('request', this.request.bind(this));
        // 监听启动，给与用户提示
        server.listen(this.config.port, () => {
            let url = `http://${this.config.host}:${this.config.port}`;
            debug(`server started at ${chalk.green(url)}`);
        });
    }
    // request 监听函数
    async request(req, res) {
        // 1. 静态资源访问
        // 1.1 需要先取到客户端请求的文件或文件夹路径，需判断
        let { pathname } = url.parse(req.url);

        // 2.1 暂时屏蔽网站图标请求
        if (pathname == '/favicon.ico') return this.sendErr(req, res);

        let filepath = path.join(this.config.root, pathname);
        try {
            // 1.2 判断路径是否存在，存在的话是文件还是文件夹
            let statObj = await stat(filepath);
            if (statObj.isFile()) {
                // 1.3 请求文件
                this.sendFile(req, res, filepath, statObj);
            } else if (statObj.isDirectory()) {
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
        } catch (e) {
            debug(inspect(e));
            this.sendErr(req, res);
        }
    }
    // 发送静态文件给客户端
    async sendFile(req, res, filepath, statObj) {
        // 4.2 判断缓存是否可用，返回 true 则表示缓存可用
        let canUseCache = await this.handleCache(req, res, filepath, statObj);
        if (canUseCache) return;
        
        // 5.1 防盗链，有 refer 时，表明为页面引用，才需要判断是否命中防盗链
        // 且为指定 mime 类型(此处只判断了图片，根据具体需要来处理，正常情况下应该有单独的图片服务器)
        let refer = req.headers['referer'] || req.headers['refer'];
        let type = mime.getType(filepath);
        if (refer && /\bimage\b/.test(type)) {
            // 5.2 获取 refer 地址和请求源 url，判断是否相同，如果不同是否在白名单中
            let referHostname = url.parse(refer, true).hostname;
            let curretnHostName = url.parse(req.url, true).hostname;
            if (referHostname != curretnHostName && this.config.whiteList.indexOf(referHostname) == -1) {
                res.setHeader('Content-Type', 'image/jpg');
                fs.createReadStream(path.join(this.config.root, 'images', 'forbidden.jpg')).pipe(res);
                return;
            }
        }

        // code 200 默认，可以不写，content-type 需要设置
        res.setHeader('Content-Type', mime.getType(filepath));
        // 3.2 拿到可用压缩方法后，在输出前，使用方法处理文件流
        let encoding = this.getEncoding(req, res);
        if (encoding) {
            // eg: http://localhost:8080/test.html 查看压缩效果
            fs.createReadStream(filepath).pipe(encoding).pipe(res);
        } else {
            fs.createReadStream(filepath).pipe(res);
        }
    }
    // 返回错误给客户端
    sendErr(req, res) {
        res.statusCode = 500;
        res.end(`there is something wrong in the server! please try later!`)
    }
    // 3.1 根据请求头获取可用压缩方法
    getEncoding(req, res) {
        // eg: 请求头 Accept-Encoding: gzip, deflate
        let acceptEncoding = req.headers['accept-encoding'];
        if (/\bgzip\b/.test(acceptEncoding)) {
            res.setHeader('Content-Encoding', 'gzip');
            return zlib.createGzip();
        } else if (/\bdeflate\b/.test(acceptEncoding)) {
            res.setHeader('Content-Encoding', 'deflate');
            return zlib.createDeflate();
        } else {
            return null;
        }
    }
    // 4.1 判断缓存是否可用，判断过程可以参考 http://t.cn/EVsEAHh
    handleCache(req, res, filepath, statObj) {
        // http1.0 协商缓存 最后修改时间，对应响应头 Last-Modified
        let ifModifiedSince = req.headers['if-modified-since'];
        // http1.1 协商缓存 资源内容对应的 hash 标识，对应响应头 ETag
        let ifNoneMatch = req.headers['if-none-match'];

        // 读取文件用于获取 ETag
        let out = fs.createReadStream(filepath);
        let md5 = crypto.createHash('md5');
        return new Promise((resolve, reject) => {
            out.on('data', data => {
                md5.update(data);
            });
            out.on('end', () => {
                // 根据文件内容生成 信息摘要值 作为 ETag
                let etag = md5.digest('hex');
                let lastModified = statObj.ctime.toGMTString();
                
                // 先判断 ETag 再判断 Last-Modified
                if (ifNoneMatch && ifNoneMatch == etag ||
                    ifModifiedSince && ifModifiedSince == lastModified) {
                    res.writeHead(304);
                    res.end();
                    resolve(true);
                } else {
                    let cacheDuration = 30;
                    // 设置 http1.1 强缓存 资源有效期（有效时间长度）
                    res.setHeader('cache-control', `max-age=${cacheDuration}`);
                    // 设置 http1.0 强缓存 资源有效期（失效时间点）
                    res.setHeader('Expires', new Date(Date.now() + cacheDuration * 1000).toGMTString());
                    // 设置 协商缓存
                    res.setHeader('ETag', etag);
                    res.setHeader('Last-Modified', lastModified);
                    resolve(false);
                }
            });
            out.on('error', err => {
                debug(err);
                reject(err);
            });
        });
    }
}

// 本地调试时用， app.js + vscode 调试
let server = new Server();
// 启动服务
server.start();

// 命令行工具启动时用
// module.exports = Server;