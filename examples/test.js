'use strict';

var nodemailer = require('../src/nodemailer');
var transport = nodemailer.createTransport(nodemailer.stubTransport());
var markdown = require('nodemailer-markdown').markdown;

var stream = require('stream');
var Transform = stream.Transform;

var compileplugin = function(mail, callback) {
    if (!mail.data.headers) {
        mail.data.headers = {};
    }
    mail.data.headers['X-SSS'] = 'õuaõua';
    return callback(null, mail);
};

var sendplugin = function(mail, callback) {
    var transform = new Transform();
    var chunks = [];
    var chunklen = 0;

    transform._transform = function(chunk, encoding, done) {
        if (encoding !== 'buffer') {
            chunk = new Buffer(chunk, encoding);
        }

        chunks.push(chunk);
        chunklen += chunk.length;
        done();
    };

    transform._flush = function(done) {
        var message = Buffer.concat(chunks, chunklen).toString('binary');
        this.push(message.replace(/[a-z]/g, 'z'));
        done();
    };

    mail.message.use(transform);
    return callback(null, mail);
};

transport.on('log', function(log) {
    console.error(
        '%s: %s',
        log.type,
        log.message.replace(/\r?\n$/, '').replace(/\n/g, '\n' + new Array(log.type.length + 3).join(' '))
    );
});

transport.use('compile', markdown({
    useEmbeddedImages: true
}));
transport.use('compile', compileplugin);
transport.use('send', require('nodemailer-dkim').signer({
    domainName: 'node.ee',
    keySelector: 'dkim',
    privateKey: require('fs').readFileSync(__dirname + '/test_private.pem')
}));
//transport.use('send', sendplugin);

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
    markdown: '# Nodemailer\n\n![alt](' + __dirname + '../../assets/nm_logo_100x68.png)',
    attachments: [{
        filePath: __dirname + '/test.js'
    }],
    encoding: 'quoted-printable'
}, function(err, message) {
    if (err) {
        console.log(err.stack);
    } else {
        console.log(message.toString());
    }
});