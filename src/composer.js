'use strict';

var packageData = require('../package.json');
var BuildMail = require('buildmail');
var libmime = require('libmime');
var util = require('util');

module.exports = Composer;

function Composer(mail) {
    this.mail = mail || {};
    this.message = false;
}

Composer.prototype.compose = function() {
    this.alternatives = this.getAlternatives();
    this.htmlNode = this.alternatives.filter(function(alternative) {
        return /^text\/html\b/i.test(alternative.contentType);
    }).pop();
    this.attachments = this.getAttachments(!!this.htmlNode);

    this.useRelated = !!(this.htmlNode && this.attachments.related.length);
    this.useAlternative = this.alternatives.length > 1;
    this.useMixed = this.attachments.attached.length > 1 || (this.alternatives.length && this.attachments.attached.length === 1);

    if (this.useMixed) {
        this.message = this.createMixed();
    } else if (this.useAlternative) {
        this.message = this.createAlternative();
    } else if (this.useRelated) {
        this.message = this.createRelated();
    } else {
        this.message = this.createNode(false, [].concat(this.alternatives || []).concat(this.attachments.attached || []).shift());
    }

    // Add headers to the root node
    [
        'from',
        'to',
        'cc',
        'bcc',
        'reply-to',
        'in-reply-to',
        'references',
        'subject',
        'message-id',
        'date'
    ].forEach(function(header) {
        var key = header.replace(/-(\w)/g, function(o, c) {
            return c.toUpperCase();
        });
        if (this.mail[key]) {
            this.message.setHeader(header, this.mail[key]);
        }
    }.bind(this));

    if (this.mail.headers) {
        this.message.addHeader(this.mail.headers);
    }

    if (this.mail.envelope) {
        this.message.setEnvelope(this.mail.envelope);
    }
};

Composer.prototype.createMixed = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/mixed');
    } else {
        node = parentNode.createChild('multipart/mixed');
    }

    if (this.useAlternative) {
        this.createAlternative(node);
    } else if (this.useRelated) {
        this.createRelated(node);
    }

    [].concat(this.alternatives.length < 2 && this.alternatives || []).concat(this.attachments.attached || []).forEach(function(element) {
        this.createNode(node, element);
    }.bind(this));

    return node;
};

Composer.prototype.createAlternative = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/alternative');
    } else {
        node = parentNode.createChild('multipart/alternative');
    }

    this.alternatives.forEach(function(alternative) {
        if (this.useRelated && this.htmlNode === alternative) {
            this.createRelated(node);
        } else {
            this.createNode(node, alternative);
        }
    }.bind(this));

    return node;
};

Composer.prototype.createRelated = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/related; type="text/html"');
    } else {
        node = parentNode.createChild('multipart/related; type="text/html"');
    }

    this.createNode(node, this.htmlNode);

    this.attachments.related.forEach(function(alternative) {
        this.createNode(node, alternative);
    }.bind(this));
};

Composer.prototype.createNode = function(parentNode, element) {
    var node;

    if (!parentNode) {
        node = new BuildMail(element.contentType, {
            filename: element.filename
        });
    } else {
        node = parentNode.createChild(element.contentType, {
            filename: element.filename
        });
    }

    if (element.cid) {
        node.setHeader('Content-Id', '<' + element.cid.replace(/[<>]/g, '') + '>');
    }

    if (this.mail.encoding && /^text\//i.test(element.contentType)) {
        node.setHeader('Content-Transfer-Encoding', this.mail.encoding);
    }

    node.setContent(element.contents);

    return node;
};

Composer.prototype.getAttachments = function(findRelated) {
    var attachments = [].concat(this.mail.attachments || []).map(function(attachment, i) {
        var data = {
            contentType: attachment.contentType ||  
                libmime.detectMimeType(attachment.filename || attachment.filePath || attachment.href || 'bin')
        };

        if (attachment.filename) {
            data.filename = attachment.filename;
        } else {
            data.filename = (attachment.filePath || attachment.href || '').split('/').pop() || 'attachment-' + (i + 1);
            if (data.filename.indexOf('.') < 0) {
                data.filename += '.' + libmime.detectExtension(data.contentType);
            }
        }

        if (/^https?:\/\//i.test(attachment.filePath)) {
            attachment.href = attachment.filePath;
            attachment.filePath = undefined;
        }

        if (attachment.cid) {
            data.cid = attachment.cid;
        }

        if (attachment.filePath) {
            data.contents = {
                path: attachment.filePath
            };
        } else if (attachment.href) {
            data.contents = {
                href: attachment.href
            };
        } else {
            data.contents = attachment.contents || '';
        }

        return data;
    }.bind(this));

    if (!findRelated) {
        return {
            attached: attachments,
            related: []
        };
    } else {
        return {
            attached: attachments.filter(function(attachment) {
                return !attachment.cid;
            }),
            related: attachments.filter(function(attachment) {
                return !!attachment.cid;
            })
        };
    }
};

Composer.prototype.getAlternatives = function() {
    var alternatives = [];

    if (this.mail.text) {
        alternatives.push({
            contentType: 'text/plain; charset=utf-8',
            contents: this.mail.text
        });
    }

    if (this.mail.html) {
        alternatives.push({
            contentType: 'text/html; charset=utf-8',
            contents: this.mail.html
        });
    }

    [].concat(this.mail.alternatives || []).forEach(function(alternative) {
        var data = {
            contentType: alternative.contentType ||  
                libmime.detectMimeType(alternative.filename || alternative.filePath || alternative.href || 'txt')
        };

        if (alternative.filename) {
            data.filename = alternative.filename;
        }

        if (/^https?:\/\//i.test(alternative.filePath)) {
            alternative.href = alternative.filePath;
            alternative.filePath = undefined;
        }

        if (alternative.filePath) {
            data.contents = {
                path: alternative.filePath
            };
        } else if (alternative.href) {
            data.contents = {
                href: alternative.href
            };
        } else {
            data.contents = alternative.contents || '';
        }

        alternatives.push(data);
    }.bind(this));

    return alternatives;
};

Composer.prototype.send = function(transporter, callback) {
    var versionString = util.format(
        '%s (%s; +%s; %s/%s)',
        packageData.name,
        packageData.version,
        packageData.homepage,
        transporter.name,
        transporter.version
    );
    this.message.setHeader('X-Mailer', versionString);
    transporter.send(this.message, callback);
};