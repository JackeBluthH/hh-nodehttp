var router = require('./router');

/*
logs {"a":"","t":1505802148321,"p":"INFO","g":"default","m":"info/request/start: /user/login?sid=179219479020638951&t=72
 [ 'info',\n  'request',\n  'start: /user/login?sid=179219479020638951&t=72' ]"}
logs {"a":"","t":1505802148336,"p":"INFO","g":"default","m":"info/request/end: /login?sid=179219479020638951&t=72 [ 'inf
o', 'request', 'end: /login?sid=179219479020638951&t=72' ]"}
logs {"a":"","t":1505802148336,"p":"INFO","g":"default","m":"error/login/用户admin 登录失败 [ 'error', 'login', '用户adm
in 登录失败' ]"}
*/
function formatDate(time) {
    var Y = time.getFullYear();
    var M = time.getMonth();
    var D = time.getDate();
    var h = time.getHours();
    var m = time.getMinutes();
    var s = time.getSeconds();
    var pad = (v) =>  v < 10 ? '0' + v : v;

    return `${Y}-${pad(M)}-${pad(D)} ${pad(h)}:${pad(m)}:${pad(s)}`;
}

router.config('/logs/', function (req, res) {
    req.getPostParas(function (oParas) {
        var oLog = JSON.parse(oParas.rawData);
        var sInfo = oLog.m.replace(/[\n\t]/g,'');
        var time = formatDate(new Date(oLog.t));
        var aLog = sInfo.match(/\[[\S ]*\]$/);

        if (!aLog) {
            sInfo = `${time}/${sInfo}`;
        } else {
            sInfo = aLog[0].replace(/\'/g, '"');
            var aInfo = JSON.parse(sInfo);
            sInfo = `${time}/${aInfo[0]}/${aInfo[1]}-${aInfo[2]}`;
        }

        console.log(sInfo);
        res.end('ok')
    });
});

