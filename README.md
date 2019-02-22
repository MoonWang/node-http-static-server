# HTTP 静态服务器

> 使用原生 Node.js 实现一个 HTTP 静态资源服务器，作为学习加深理解之用

## 基本功能

1. 静态文件及文件夹目录访问
2. 通过可执行文件启动服务
    - 创建 bin/www 可执行脚本文件，配置命令行工具参数，添加服务器启动
    - 修改 package.json ，添加 bin ，用于 npm link 环境变量后，可以直接作为命令使用
    - 发布成 npm 包，可以安装当做工具使用
3. 压缩功能
    - 根据 Accept-Encoding 请求头获取浏览器支持的压缩方式
    - 根据结果选择对应的压缩方法，在输出前处理文件流
4. 缓存功能
    - 能放到服务器，说明强缓存失效，所以需要判断的只有协商缓存是否可用
        - http1.1 规范，请求头 if-none-match 和文件内容生成的 ETag 对比
        - http1.0 规范，请求头 if-modified-since 和文件最后修改时间 Last-Modified 对比
    - 缓存可用，则返回 304
    - 缓存不可用，则设置4个缓存相关响应头，然后正常返回资源
5. 多语言（项目未处理）
    - 基于 Accept-Language 请求头实现
        - Accept-Language: zh-CN,zh;q=0.9,en;q=0.8 
        - 逗号区分语言，分号后是语言权重，默认权重1
    - 拿到权重表后，从高到低遍历，然后查找服务器是否存在响应的语言包，找到权重最高的语言包来应用
6. 防盗链
    - 基于 Referer 请求头，判断请求来源页面的 URL 
        - 从一个网站跳转，或者网页引用到某个资源文件时，会带有该请求头
        - 直接用浏览器访问图片地址是没有 Referer 的
        - 该请求头可能是 Referer 或 Refer
    - 先判断是否为本域名请求，本域名内自然是正常请求
    - 再检查源域名是否在白名单内，在则正常响应，不在则做错误提示

## 目录结构

```bash
├── README.md
├── bin
├── package.json
├── public 静态文件，项目访问根目录
│   ├── css
│   │   └── index.css
│   ├── images
│   │   ├── array.jpg
│   │   └── common
│   │       └── proto.jpg
│   └── index.html
└── src
    ├── app.js 入口文件
    ├── config.js 服务配置文件
    └── template 模板文件
        └── fileList.html 文件夹目录展示模板
```

## 启动

```bash
$ npm install

$ npm link

$ set DEBUG=static:*    // window 设置启动 debug
$ export DEBUG=static:* // mac/linux 设置启动 debug

$ static-server
```

## 第三方包说明

- [chalk](https://github.com/chalk/chalk) 
    - 给终端 console 添加样式
    - eg:
        ```javascript
        const chalk = require('chalk');

        console.log(chalk.blue('Hello world!'));
        console.log(chalk.blue.bgRed.bold('Hello world!'));
        console.log(chalk.red.bold.underline('Hello', 'world'););
        ```
- [debug](https://github.com/visionmedia/debug)
    - Node.js 调试用，根据环境变量来决定是否输出 console
        - 直接在命令行中设定环境变量，只影响当前次启动
            ```bash
            $ DEBUG='static:app' node app.js
            ```
        - shell 设置环境，只影响当前终端窗口
            - window: set DEBUG=static:*
            - mac/linux: export DEBUG=static:* 
        - app.js 中使用脚本修改
            - process.env.DEBUG = 'static:*'
    - 由环境变量中的 DEBUG 值是否等于参数 'static:app' 来决定是否在控制台打印
        ```javascript
        let debug = require('debug')('static:app');
        ```
    - 参数约定格式「项目名:模块名」
        - 可以通过模块名来区分不同类型模块
        - 打印某一模块调试信息，设定环境变量为「项目名:模块名」
        - 打印所有模块调试信息，设定环境变量为「项目名:*」
- [mime](https://github.com/broofa/node-mime)
    - 可以根据文件路径获取 mime 类型
        ```javascript
        const mime = require('mime');
        console.log(mime.getType(filepath));
        ```
- [handlebars](http://handlebarsjs.com/)
    - 模板引擎
- [yargs](https://github.com/yargs/yargs)
    - 获取命令行参数

## 调试

- [supervisor](https://github.com/petruisfan/node-supervisor)
    - 监听修改自动重启
        - 开发期间不甚好用，报错就中止进程了
    - 全局安装
        ```bash
        $ npm i supervisor -g
        ```
    - 使用
        ```bash
        $ supervisor node app.js
        ```
- 使用 vscode 调试功能

## 将项目发布成 npm 包

- npm login/adduser
    - 使用 npm 站的登录
- npm publish 发布包
    - 常见错误
        1. 非 npm 源，如使用 nrm 管理源且切换到了非 npm 源
        2. 权限不足，根据提示进行操作
        3. 包名字不能使用，更换
        4. 同一版本不能再次发布，可以更新版本号后发布，或使用 `npm updata`
- npm update 更新包
