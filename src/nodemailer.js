'use strict';

var MailSender = require('./mailsender');

// Export createTransport method
module.exports.createTransport = function(transporter) {
    return new Nodemailer(transporter);
};

function Nodemailer(transporter) {
    this.transporter = transporter;

    //this.transporter.on('log', console.log);
}

Nodemailer.prototype.sendMail = function(mail, callback) {
    var sender = new MailSender(mail);
    sender.compose();
    sender.send(this.transporter, callback);
};