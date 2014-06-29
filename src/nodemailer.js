'use strict';

var Composer = require('./composer');
var EventEmitter = require('events').EventEmitter;
var utillib = require('util');

// Export createTransport method
module.exports.createTransport = function(transporter) {
    return new Nodemailer(transporter);
};

/**
 * Creates an object for exposing the Nodemailer API
 *
 * @constructor
 * @param {Object} transporter Transport object instance to pass the mails to
 */
function Nodemailer(transporter) {
    EventEmitter.call(this);
    this.transporter = transporter;

    this.transporter.on('log', function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('log');
        this.emit.apply(this, args);
    }.bind(this));
}
utillib.inherits(Nodemailer, EventEmitter);

/**
 * Sends an email using the preselected transport object
 *
 * @param {Object} mail E-mail description
 * @param {Function} callback Callback to run once the sending succeeded or failed
 */
Nodemailer.prototype.sendMail = function(mail, callback) {
    var sender = new Composer(mail);
    sender.compose();
    sender.send(this.transporter, callback);
};