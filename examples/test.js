'use strict';

var nodemailer = require('../src/nodemailer');
var StubTransport = require('../src/stub-transport');

var transport = nodemailer.createTransport(new StubTransport());

transport.on('log', function(log) {
    console.error(
        '%s: %s',
        log.type,
        log.message.replace(/\r?\n$/, '').replace(/\n/g, '\n' + new Array(log.type.length + 3).join(' '))
    );
});

transport.sendMail({
    from: '"Sender Name" <sender@example.com>',
    to: ['"Receiver Name #1" <receiver1@example.com>', {
        name: 'kukemaku',
        address: 'receiver2@example.com'
    }],
    cc: 'receiver3@example.com',
    bcc: 'receiver4@example.com',
    replyTo: 'receiver5@example.com',
    inReplyTo: 'aaaaa@bbbbb.com',
    references: 'uuu@ii.com ooo@ooo.com uu@yyy.com',
    subject: 'uuu ooo öö',
    messageId: 'zzzz@ppp.com',
    date: new Date(2011, 2, 2, 12, 22),
    headers: {
        'x-my-key': 1,
        'x-my-other-key': 2
    },
    html: '<p>aaa <img src="cid:tere@tere"> bbb</p>\n',
    text: 'tere tere',
    attachments: [{
        filePath: __dirname + '/test.js'
    }, {
        cid: 'tere@tere',
        filePath: __dirname + '/../assets/nm_logo_100x68.png'
    }],
    encoding: 'quoted-printable'
}, function(err, message) {
    if (err) {
        console.log(err.stack);
    } else {
        console.log(message.toString());
    }
});