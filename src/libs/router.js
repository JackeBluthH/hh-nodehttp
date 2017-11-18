var http = require('http');
var fs=require('fs');
var path=require('path');
var url = require('url');
var mine=require('./mine');
var log=require('./log').log;

var Configs = {
    documentRoot: './',
    documentIndex: 'index.html',
    jsonIndex: 'index.json',
    uploadTemp: 'upload/temp/',
    VPath: {}
}

function MyRouter () {
    var _oGetUrls = {};
    var _aUrl = [];

    var cfgUrl = function (sUrl, cb) {
        if (!_oGetUrls[sUrl]) {
            _aUrl.push(sUrl);
        }
        log('debug', 'add router:', sUrl)
        _oGetUrls[sUrl] = cb;
    };

    var cfgConfigs = function (oCfg) {
        for (var key in oCfg) {
            Configs[key] = oCfg[key];
        }
    };

    var cfgDefaultUrl = function () {
        cfgUrl('*/', function (req, res) {
            var sPathFile = req.pathname + Configs.documentIndex;
            oRouter.redirectServer(sPathFile, res);
        });
    }

    var oRouter = {
        config: function (url, cb) {
            if (undefined === cb) {
                cfgConfigs(url);
            } else {
                cfgUrl(url, cb);
            }
            return this;
        },
        setDocumentRoot: function (sDocumentRoot) {
            Configs.documentRoot = sDocumentRoot;
            return this;
        },
        addVPath: function (VPath, sRealPath) {
            if ('string' == typeof(VPath)) {
                Configs.VPath[VPath] = sRealPath;
            } else for (var key in VPath) {
                Configs.VPath[key] = VPath[key];
            }
            return this;
        },
        get: function (sUrl) {
            sUrl = matchUrl(_aUrl, sUrl);
            return _oGetUrls[sUrl] || StaticRouter;
        },
        start: function (nPort) {
            cfgDefaultUrl();
            http.createServer(function (req, res) {
                HttpServerThread(oRouter, req, res);
            }).listen(nPort, '0.0.0.0');
            log("info", "Server runing at port: " + nPort + ".");
        },
        redirectServer: checkAndOutputFile
    }
    return oRouter;
}

function UploadFile (sBasePath) {
    var fd = false;

    sBasePath = sBasePath || Configs.uploadTemp;

    var open = function (sFileName) {
        close();

        var sTempFileName = sBasePath + sFileName + Math.random();
        fd = fs.openSync(sTempFileName, 'w');
        return sTempFileName;
    };

    var write = function (data) {
        fs.writeSync(fd, data);
    }

    var isOpen = function () {
        return false !== fd;
    }

    var close = function () {
        if (fd) {
            fs.closeSync(fd);
            fd = false;
        }
    }

    this.open = open;
    this.write = write;
    this.isOpen = isOpen;
    this.close = close;
}

function parseUrlPara(sParas) {
    var oPara = {};

    if (!sParas) {
        return {};
    }

    var a = sParas.split('&');
    for (var i = 0; i < a.length; i++) {
        var aPara = a[i].split('=');
        var key = aPara[0];
        var val = aPara[1];
        oPara[key] = val;
    }
    return oPara;
}

function parseContentDisposition (sText) {
    if (!sText) {
        return false;
    }

    var aPair = sText.split('; ');
    var oPara = {};

    for (var i = 0; i < aPair.length; i++) {
        var sPair = aPair[i];
        var nKey = sPair.indexOf('=');
        if (0 < nKey) {
            var sVal = sPair.substring(nKey + 1);   // 1, skipe '='
            sVal = sVal.replace(/^\"/,'').replace(/\"$/,'');    // remove '"' at first and end
            oPara[sPair.substring(0, nKey)] = sVal;
        }
    }

    return oPara;
}
function parseMultipartLine (sLine, obj) {
    var a = (''+sLine).split(': ');
    obj[a[0].toLowerCase()] = a[1];
}

function getLine (oContext) {
    var line;
    var sText = oContext.data;
    var nLine = sText.indexOf('\r\n');

    if (-1 !== nLine) {
        line = sText.slice(0, nLine);
        oContext.data = sText.slice(nLine + 2);
    } else {
        line = Buffer.from('');
    }

    return line;
}

/**
------WebKitFormBoundaryB3MME0M9Q4SGU0q1
Content-Disposition: form-data; name="file"; filename="idea.txt"
Content-Type: text/plain

-server -XX:PermSize=256M -XX:MaxPermSize=1024M

------WebKitFormBoundaryB3MME0M9Q4SGU0q1
Content-Disposition: form-data; name="xxx"

abc
------WebKitFormBoundaryB3MME0M9Q4SGU0q1--

*/
function processMultipart (oContext, oPostParas) {
    var oHeader = {};
    var sBoundary = '--' + oContext.boundary;
    log('debug', 'processMultipart');

    // multipart中一块的开始
    var resetBoundary = function () {
        oHeader = {};
        oContext['paraName'] = false;
        oContext.file.close();
    }

    var updateUrlPara = function (data) {
        if (oContext.file.isOpen()) {
            oContext.file.write(data);
        } else if (oContext['paraName']) {
            oPostParas[oContext['paraName']] += data;
        }
    };

    // 保存URL参数，如果是文件，则把文件名保存到URL参数中
    var saveUrlPara = function (oDisposition) {
        if (!oDisposition) {
            return;
        }

        // save the current url para name
        oContext['paraName'] = oDisposition.name;

        // save the url param
        oPostParas[oDisposition.name] = '';
        if (oDisposition.filename) {
            oPostParas[oDisposition.name] = {
                tempFile: oContext.file.open(oDisposition.filename),
                srcFile: oDisposition.filename
            };
        }
    }

    var parseHeader = function () {
        getLine(oContext);  // boundary line
        log('debug', 'start a new part');
        resetBoundary();

        var sLine = getLine(oContext);
        while (Buffer.byteLength(sLine)) {
            parseMultipartLine(sLine, oHeader);
            sLine = getLine(oContext);
        }
    }

    /**
    * 文件打开时说明上一次的文件上传还没有完成。此时需要判断本次报文中是否存在boundary
    * 如果不存在，则本次的报文全部是数据，需要全部保存到文件中；
    * 如果存在，则本次的报文的前一段是数据，后面需要继续分析；
    */
    while (Buffer.byteLength(oContext.data)) {
        var nBoundary = oContext.data.indexOf(sBoundary);

        // 本次的报文全部是数据
        if (-1 === nBoundary) {
            log('debug', 'no boundary');
            updateUrlPara(oContext.data);
            return;
        }

        // 本次报文的前一段数据更新到URL参数中，并从新缓冲区删除
        if (0 < nBoundary) {
            updateUrlPara(oContext.data.slice(0, nBoundary - 2));    // 2: skip \r\n
            oContext.data = oContext.data.slice(nBoundary);
        }

        // multipart header. 每个头部肯定在一个报文中
        parseHeader();
        saveUrlPara(parseContentDisposition(oHeader['content-disposition']));

        log('debug', 'start next part');
    }
}

function isString(value) {return typeof value === 'string';}
function isFunction(value) {return typeof value === 'function';}
function isObject(value) {return value !== null && typeof value === 'object';}
function dumpObj (obj, output) {
    output = output || console.log;

    if (Array.isArray(obj)) {
        output('This data is array');
    } else if (isObject(obj)) {
        output('This data is object');
    }


    for (var key in obj) {
        var val = obj[key];
        if (isString(val)) {
        } else if (isObject(val)) {
            val = '[object]';
        }else if (isFunction(val)) {
            val = val.toString();
            var n = (''+val).indexOf('{');
            val = val.substring(0, n);
        }
        var s = key + ' = ' + val;
        output(s);
    }
}

// IE10: Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0)
// Chrome59: Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36
function parseUserAgent (sUserAgent) {

}

function HttpServerThread (router, request, response) {
    var oUrl = url.parse(request.url);
    var sUrl = oUrl.pathname;
    var qs = require('querystring');

    var oPostParas = {};
    var getPostParas = [];

    var oContext = {
        status: 'init', // 报文接收状态：init, recv, end
        file: new UploadFile(),    // 上传文件时的文件对象
        header: {},     // 单块的头
        boundary: '',   // multipart 报文的boundary串
        data: ''        // 报文数据
    };

    function doGeting () {
        getPostParas.forEach(function(cb) {
            cb(oPostParas);
        });
        getPostParas.length = 0;
    }

    log("debug", 'HttpServerThread start');
    log('url', sUrl);
    log('client', request.client.remoteAddress, request.headers['user-agent']);
    oUrl.query = decodeURI(oUrl.query || '');
    request.params = parseUrlPara(oUrl.query);
    request.pathname = oUrl.pathname;
    request.urlInfo = oUrl;

    // Content-Type:multipart/form-data; boundary=----WebKitFormBoundaryB3MME0M9Q4SGU0q1
    var sContentType = request.headers['content-type'] || '';
    oContext.boundary = sContentType.split('boundary=')[1];

    if ('POST' === request.method) {
        oContext.status = 'recv';

        // file upload:
        request.addListener("data", function (data) {
            log('debug', 'new data: ' + Buffer.byteLength(data));

            if (oContext.boundary) {
                oContext.data = data;
                processMultipart(oContext, oPostParas);
            } else {
                oContext.data += data;
            }
        });
        request.addListener("end", function () {
            log('debug', 'recv end');
            // 数据接收完毕，分析并调用使用者
            if (!oContext.boundary) {
                oPostParas = qs.parse(''+oContext.data);
                oPostParas.rawData = oContext.data;
            }

            // 通知需要参数的调用者开始工作
            doGeting();

            oContext.status = 'end';
        });
    } else {
        oContext.status = 'end';
    }

    request.getPostParas = function (cb) {
        if ('end' === oContext.status) {
            // body数据已经接收完毕
            cb(oPostParas);
        } else {
            // body数据还没有接收完，保存回调函数，用于在数据传完后调用
            getPostParas.push(cb);
        }
    }
    response.header = function (sType) {
        responseHeader(response, sType);
    }

    // if (sUrl.indexOf('topbar-menu.json') > 0) {
    //     console.log('response delay for topbar-menu.json')
    //     setTimeout(function() {
    //         router.get(sUrl)(request, response);
    //     }, 2000)
    // } else 
    router.get(sUrl)(request, response);
}

function matchUrl (aUrl, sUrl) {
    var sMatcher;
    var sFound = sUrl;

    for (var i = 0; i < aUrl.length; i++) {
        sMatcher = aUrl[i];
        log('debug', sMatcher);

        if (sMatcher.indexOf('*') !== -1) {
            // *xx, xx*, xx*xx
            var sReg = sMatcher.replace('*', '\\S*');
            var reg = new RegExp('^' + sReg + '$');
            if (reg.test(sUrl)) {
                log('debug', 'found ' + sMatcher);
                sFound = sMatcher;
                break;
            }
        } else if (sMatcher.indexOf(':') !== -1) {
            // paras match
        } else if (sMatcher === sUrl) {
            log('debug', 'found');
            sFound = sMatcher;
            break;
        }
    }

    log('debug', 'matchUrl end: ' + sFound)
    return sFound;
}

function getRealPath(sPathName)
{
    var a = sPathName.split('/');

    var sAbsPath = Configs.VPath[a[1]];
    if (sAbsPath)
    {
        a.splice(0,2);
        sPathName = a.join('/');
    }
    else
    {
        sAbsPath = Configs.documentRoot;
    }

    return path.join(sAbsPath, sPathName);
}

function StaticRouter (req, res) {
    var sPathName = req.pathname;
    var sPathFile = getRealPath(sPathName);

    log("debug", '[' + sPathFile + ']');
    fs.exists(sPathFile, function (exists) {
        if (!exists) {
            res.writeHead(404, {
                'Content-Type': 'text/plain'
            });

            log("error", "Not found: " + sPathName);
            res.end("This request URL " + sPathName + " was not found on this server.");
        } else {
            fs.stat(sPathFile, function (err, stat)
            {
                if (stat.isDirectory())
                {
                    sPathFile = getDefaultFile(sPathName);
                    log("debug", "dir path: " + sPathFile)
                    redirectTo(res, sPathFile);
                    return true;
                }

                response200(sPathFile, res);
            })
        }
    });
}

function getDefaultFile(sPath)
{
    var cLastChar = sPath.charAt(sPath.length-1);
    if (( cLastChar !== '/') && ( cLastChar !== '\\'))
    {
        sPath = sPath + '/';
    }

    return sPath + Configs.documentIndex;
}

function redirectTo (response, sUrl) {
    // var contentType = mine["html"];
    // var html = '<script>window.location.href="'+sUrl+'"</script>'

    // response.writeHead(200, {
    //     'Content-Type': contentType
    // });
    // response.write(html, "binary");
    // response.end();
    // return;

    response.writeHead(301, {
        'Content-Type': 'text/plain',
        'Server': "NodeJS HDX",
        'Location': sUrl
    });

    log("debug", "redirect to: " + sUrl);
    response.write("remove to " + sUrl)
    response.end();
}

function response404 (sPathFile, res) {
    res.writeHead(404, {
        'Content-Type': 'text/plain'
    });

    log("error", "Not found: " + sPathFile);
    res.end("This request URL " + sPathFile + " was not found on this server.");
}

const ONE_HOURE = 60 * 60;
const ONE_DAY = ONE_HOURE * 24;
const ONE_WEEK = ONE_DAY * 7;

function responseHeader (res, sType) {
    var contentType = mine[sType] || (sType ? 'application/'+sType : 'application');
    var oHeader = {
        'Date': 'Fri, 24 Feb 2017 02:54:17 GMT',
        'HttpServer': 'hdx NodeJS 1.0.0',
        'CopyRight': 'DtDream'
    };
    if (contentType) {
        oHeader['Content-Type'] = contentType;
    }
    if (sType) {
        oHeader['Cache-Control'] = 'max-age=' + ONE_WEEK;
        oHeader['Program'] = 'public';
        oHeader['Expires'] = 'Wed Nov 01 2017 10:01:01 GMT';
    }
    res.writeHead(200, oHeader);
}

function response200 (sPathFile, res) {
    var ext = path.extname(sPathFile);
    ext = ext ? ext.slice(1) : 'unknown';
    responseHeader(res, ext);
    outputFile(sPathFile, res);
}

function outputFile(sPathFile, res)
{
    var rOption = {
        flags : 'r',
        encoding : null,
        mode : 0666
    }
    var fileReadStream = fs.createReadStream(sPathFile, rOption);
    var nReadCount = 0;
    fileReadStream.on('data',function(data){
        nReadCount++;
        res.write(data);
    });
    fileReadStream.on('end',function(){
        res.end('', null, function () {
            log('debug', 'response end');
        });

        if (nReadCount > 150) {
            // big file, filesize > 65505 * 150
            log('info', 'big file: ' + sPathFile);
        }
    });
}

function checkAndOutputFile (sPathName, res) {
    var sPathFile = getRealPath(sPathName);
    fs.exists(sPathFile, function (exists) {
        if (!exists) {
            console.log('404', sPathName)
            response404(sPathFile, res);
        } else {
            fs.stat(sPathFile, function (err, stat)
            {
                if (stat.isDirectory())
                {
                    sPathFile = getDefaultFile(sPathName);
                    log("debug", "dir path: " + sPathFile)
                    redirectTo(res, sPathFile);
                    return true;
                }

                response200(sPathFile, res);
            })
        }
    });
}

module.exports = MyRouter();
