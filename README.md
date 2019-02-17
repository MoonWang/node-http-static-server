# HTTP 静态服务器

> 学习使用

## 基本功能

1. 静态文件及文件夹目录访问

## 目录结构

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

## 启动

```bash
$ npm install

$ node src/app.js
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