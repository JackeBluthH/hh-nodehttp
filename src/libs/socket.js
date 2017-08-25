var net = require('net');

var Config = {
    host: '127.0.0.1',
    port: 6666
};

function onRecieveData (sock, data) {
    console.log('DATA ' + sock.remoteAddress + ': ' + data);
    // 回发该数据，客户端将收到来自服务端的数据
    sock.write('You said "' + data + '"');
}

// http://cnodejs.org/topic/4fb1c1fd1975fe1e1310490b
// 创建一个TCP服务器实例，调用listen函数开始监听指定端口
// 传入net.createServer()的回调函数将作为”connection“事件的处理函数
// 在每一个“connection”事件中，该回调函数接收到的socket对象是唯一的
function start () {
    net.createServer(function(sock) {
        var oMySock = new MySocket(sock);
        oMySock.

        // 我们获得一个连接 - 该连接自动关联一个socket对象
        console.log('CONNECTED: ' +
            sock.remoteAddress + ':' + sock.remotePort);

        // 为这个socket实例添加一个"data"事件处理函数
        sock.on('data', function(data) {
            return onRecieveData (sock, data);
        });

        // 为这个socket实例添加一个"close"事件处理函数
        sock.on('close', function(data) {
            onCloseSocket(data);
            console.log('CLOSED: ' +
                sock.remoteAddress + ' ' + sock.remotePort);
        });

    }).listen(PORT, HOST);
}

console.log('Server listening on ' + HOST +':'+ PORT);
module.exports = {
    config: function (oCfg) {
        for (var key in oCfg) {
            Config[key] = oCfg[key];
        }
    }
};
