var router = require('./router');

var Config = {
    uploadPath: 'upload/'
};

var fs=require('fs');

var ErrCode = {
    SUCCESS: 0,
    PARAS_ERR: 10
};

var Messages = {};
Messages[ErrCode.SUCCESS] = 'OK';
Messages[ErrCode.PARAS_ERR] = '参数错误';

function dumpObj (obj, output) {
    for (var key in obj) {
        var s = key + ' = ' + obj[key];
        output(s);
    }
}

function copyFile (s, d) {
    // 创建读写流
    var readable = fs.createReadStream(s);
    var writable = fs.createWriteStream(d);

    // 通过管道来完成copy 动作
    readable.pipe( writable );
}

function moveFile (s, d) {
    d = Config.uploadPath + d;
    fs.rename(s, d, (err, data) => {
        if (err) {
            // rename 只能在同一个盘下面成功，因此失败时需要先做copy，再删除原文件
            copyFile(s, d);
            fs.unlink(s, (err, data) => {})
        }
    })
}

function saveFile(sFileName, sText) {
    sFileName = Config.uploadPath + sFileName;
    fs.writeFile(sFileName, sText, (err, data) => {});

    return ErrCode.SUCCESS;
}

function getJsonMessage (nErrCode) {
    var oResult = {
        "message": Messages[nErrCode],
        "errCode":nErrCode
    };
    return JSON.stringify(oResult);
}

function saveText (req, res) {
    /* oParas:
        text: 上传的文件内容
        tarFile: 保存的目标文件名
        overwrite: true/false
    */
    function checkPara (oParas) {
        if (!oParas.text || !oParas.tarFile) {
            return ErrCode.PARAS_ERR;
        }

        oParas.overwrite = ('true' === oParas.overwrite);
        return ErrCode.SUCCESS;
    }

    function procs (oParas) {
        res.header('html');

        var nErrCode = checkPara(oParas);
        if (ErrCode.SUCCESS === nErrCode) {
            // URL paras is OK
            nErrCode = saveFile(oParas.tarFile, oParas.text);
        }

        res.end(getJsonMessage(nErrCode));
    }

    req.getPostParas(procs);
}

function saveUrlFile (req, res)
{
    /* oParas:
        srcFile: 上传的文件名
        tarFile: 保存的目标文件名
        overwrite: true/false
    */
    function checkPara (oParas) {
        if (!oParas.srcFile) {
            return Messages[ErrCode.PARAS_ERR];
        }

        oParas.tarFile = oParas.tarFile || oParas.srcFile.srcFile;
        oParas.overwrite = !!oParas.overwrite;

        return null;
    }
    function procFiles (oParas) {
        res.header('html');

        var sMsg = checkPara(oParas);
        if (null === sMsg) {
            // URL paras is OK
            moveFile(oParas.srcFile.tempFile, oParas.tarFile);

            var aInfo = [
                '参数信息：',
                '<li>源文件名：' + oParas.srcFile.srcFile,
                '<li>保存为：' + oParas.tarFile,
                '<li>如果文件存在，则' + (oParas.overwrite ? '覆盖' : '不覆盖')
            ];
            sMsg = aInfo.join('');
        }

        res.end(sMsg);
    }

    req.getPostParas(procFiles);
}

router
    .config('/save/', function (req, res) {
        console.log('do save')
        saveText(req, res);
    })
    .config('/upload/', function (req, res) {
        saveUrlFile(req, res);
    });

module.exports = {
    config: function (oCfg) {
        for (var key in oCfg) {
            Config[key] = oCfg[key];
        }
    }
};
