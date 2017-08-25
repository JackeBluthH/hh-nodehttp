
var Config = {
    // 监听端口号
    PORT: 88,

    // 默认根目录
    DOCUMENT_ROOT: 'd:/wwwroot/',
    // DOCUMENT_ROOT: 'D:/wwwroot/boom-master/src',

    JSON_INDEX: 'index.json',

    uploadPath: 'upload/',
    uploadTemp: 'upload/temp/',

    // log 级别，支持info,error,debug,多个时用逗号(,)分隔
    log_level: 'info,error',

    // 虚目录映射 virtulDir: realDir
    VPath: {
        'tools': 'e:/tools',
        'online': 'E:/views/cplatform_online/dtonline',
        'sp': 'E:/work/SP/apaas/framework/src/main/webapp',
        'www.aliyun.com': 'D:/www.aliyun.com',
        'ued': 'D:/wwwroot/dt-angle',
        'react': 'E:/work/react/public',
        "706": 'E:/views/706/server/client'
    }
}

// 以上为配置信息，可以根据自己的爱好和使用环境进行修改
// =====================================================
// 以下为代码逻辑，不建议修改

var router = require('./libs/router');
var log = require('./libs/log');

// fs.stat(文件路径,回调函数(err.fs.Stats对象));
// fs.fstat(文件句柄fd,回调函数(err.fs.Stats对象));
// fs.lstat(链接路径,回调函数(err.fs.Stats对象));    

// function dumpObj(obj, level) {
//     var s = [];
//     for (var key in obj) {
//         var val = obj[key] + '';
//         if (val.indexOf('function ') === 0) {
//             var n = val.indexOf('{');
//             val = val.substring(0, n);
//         }
//         val = val.substring(0, 100);
//         s.push(key+' = ' + val);
//     }
//     return s.join('\r\n');
// }

/*
request.url = "/manage/control/globalDashboard/getAlarmNum?region=cn-hangzhou-am24"
oUrl = {
    "protocol":null,"slashes":null,"auth":null,"host":null,"port":null,"hostname":null,"hash":null,
    "search":"?region=cn-hangzhou-am24",
    "query":"region=cn-hangzhou-am24",
    "pathname":"/manage/control/globalDashboard/getAlarmNum",
    "path":"/manage/control/globalDashboard/getAlarmNum?region=cn-hangzhou-am24",
    "href":"/manage/control/globalDashboard/getAlarmNum?region=cn-hangzhou-am24"
}
*/

log.config({logLevel: Config.log_level});

// upload
var upload = require('./libs/upload');
upload.config({uploadPath: Config.uploadPath});

// dtcenter demo
require('./dtcenter/index');
router.addVPath('dtcenter', 'E:/views/cplatform_online/manage/target/manage');

router
    .setDocumentRoot(Config.DOCUMENT_ROOT)
    .addVPath(Config.VPath)
    .config({uploadTemp: Config.uploadTemp})
    .start(Config.PORT);
