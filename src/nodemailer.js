'use strict';

var MailSender = require('./mailsender');

// Export createTransport method
module.exports.createTransport = function(transporter) {
    return new Nodemailer(transporter);
};

function Nodemailer(transporter) {
    this.transporter = transporter;

    this.plugins = {
        html: [],
        text: [],
        message: []
    };
}

Nodemailer.prototype.use = function(plugin) {
    Object.keys(plugin || {}).forEach(function(key){
        if(key in this.plugins){
            this.plugins.push(plugin[key]);
        }
    }.bind(this));
};

Nodemailer.prototype.sendMail = function(mail, callback) {
    var sender = new MailSender(mail, this.plugins);
    sender.compose();
    sender.send(this.transporter, callback);
};