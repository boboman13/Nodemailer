'use strict';

var nodemailer = require('../src/nodemailer');

function StubTransport(){}

StubTransport.prototype.send = function(envelope, message, callback) {
    console.log(envelope);
    message.pipe(process.stdout, {end: false});
    message.on('end', function(){
        console.log('stream ready');
        callback(null, true);
    })
}

var transport = nodemailer.createTransport(new StubTransport());
transport.sendMail({
    text: 'tere',
    alternatives: [{
        contentType: 'text/html',
        filePath: 'http://www.neti.ee/'
    }]
}, console.log);

