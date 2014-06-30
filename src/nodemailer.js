'use strict';

var Composer = require('./composer');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var packageData = require('../package.json');

// Export createTransport method
module.exports.createTransport = function(transporter) {
    return new Nodemailer(transporter);
};

// Export stub tranport for testing
module.exports.stubTransport = require('./stub-transport.js');

/**
 * Creates an object for exposing the Nodemailer API
 *
 * @constructor
 * @param {Object} transporter Transport object instance to pass the mails to
 */
function Nodemailer(transporter) {
    EventEmitter.call(this);

    if (!transporter || typeof transporter.on !== 'function') {
        this.emit('error', new Error('transporter object needs to be an EventEmitter'));
        return;
    }

    this.transporter = transporter;

    this.transporter.on('log', function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('log');
        this.emit.apply(this, args);
    }.bind(this));

    this.transporter.on('error', function(err) {
        this.emit('error', err);
    }.bind(this));
}
util.inherits(Nodemailer, EventEmitter);

/**
 * Sends an email using the preselected transport object
 *
 * @param {Object} mail E-mail description
 * @param {Function} callback Callback to run once the sending succeeded or failed
 */
Nodemailer.prototype.sendMail = function(mail, callback) {
    var versionString = util.format(
        '%s (%s; +%s; %s/%s)',
        packageData.name,
        packageData.version,
        packageData.homepage,
        this.transporter.name,
        this.transporter.version
    );

    var composer = new Composer(mail);
    var message = composer.compose();

    if (mail.Xmailer !== false) {
        message.setHeader('X-Mailer', mail.Xmailer || versionString);
    }

    this.transporter.send(message, callback);
};