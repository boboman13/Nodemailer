'use strict';

var nodemailer = require('../src/nodemailer');

function StubTransport(){}

StubTransport.prototype.send = function(envelope, message, callback) {
    message.pipe(process.stdout, {end: false});
    message.on('end', function(){
        callback(null, true);
    })
}

var transport = nodemailer.createTransport(new StubTransport());
transport.sendMail({
    html: '<p>aaa <img src="cid:tere@tere"> bbb</p>\n',
    text: 'tere tere',
    attachments: [{
        filePath: __dirname + '/test.js'
    },{
        cid: 'tere@tere',
        filePath: __dirname + '/../assets/nm_logo_100x68.png'
    }]
}, function(){});

