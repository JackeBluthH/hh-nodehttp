
var Config = {
  logLevel: 'warning,error' // debug,info,warning,error
};

function log(type, s1, s2, s3)
{
    if (Config.logLevel.indexOf(type) != -1) {
        var aMsg = [];
        var now = new Date();
        //aMsg.push(now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate());
        aMsg.push(now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds());
        aMsg.push(s1);
        s2 && (aMsg.push(s2));
        s3 && (aMsg.push(s3));

      console.log(aMsg.join(' '));
    }
}

module.exports = {
  log: log,
  config: function (cfg) {
    if (undefined !== cfg.logLevel) {
      Config.logLevel = cfg.logLevel;
    }
  }
};
