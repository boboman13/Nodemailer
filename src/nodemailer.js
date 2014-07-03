'use strict';

var Compiler = require('./compiler');
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

    this._plugins = {
        compile: [],
        send: []
    };

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

Nodemailer.prototype.use = function(compileStep, plugin) {
    compileStep = (compileStep || '').toString();
    if (!this._plugins.hasOwnProperty(compileStep)) {
        this._plugins[compileStep] = [plugin];
    } else {
        this._plugins[compileStep].push(plugin);
    }
};

/**
 * Sends an email using the preselected transport object
 *
 * @param {Object} data E-data description
 * @param {Function} callback Callback to run once the sending succeeded or failed
 */
Nodemailer.prototype.sendMail = function(data, callback) {
    var versionString = util.format(
        '%s (%s; +%s; %s/%s)',
        packageData.name,
        packageData.version,
        packageData.homepage,
        this.transporter.name,
        this.transporter.version
    );

    this._processPlugins('compile', {
        data: data
    }, function(err, mail) {
        if (err) {
            return callback(err);
        }

        var message = new Compiler(mail.data).compile();

        if (mail.data.Xmailer !== false) {
            message.setHeader('X-Mailer', mail.data.Xmailer || versionString);
        }

        this._processPlugins('send', {
            data: mail.data,
            message: message
        }, function(err, mail) {
            if (err) {
                return callback(err);
            }
            this.transporter.send(mail.message, callback);
        }.bind(this));
    }.bind(this));
};

Nodemailer.prototype._processPlugins = function(compileStep, mail, callback) {
    compileStep = (compileStep || '').toString();

    if (!this._plugins.hasOwnProperty(compileStep) || !this._plugins[compileStep].length) {
        return callback(null, mail);
    }

    var plugins = Array.prototype.slice.call(this._plugins[compileStep]);

    var processPlugins = function(mail) {
        if (!plugins.length) {
            return callback(null, mail);
        }
        var plugin = plugins.shift();
        plugin(mail, function(err, data) {
            if (err) {
                return callback(err);
            }
            processPlugins(data);
        });
    }.bind(this);

    processPlugins(mail);
};