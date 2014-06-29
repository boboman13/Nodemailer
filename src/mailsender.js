'use strict';

var BuildMail = require('buildmail');
var libmime = require('libmime');

module.exports = MailSender;

function MailSender(mail) {
    this.mail = mail || {};
    this.message = {};
}

MailSender.prototype.compose = function() {
    this.message.alternatives = this.getAlternatives();
    this.message.htmlNode = this.message.alternatives.filter(function(alternative) {
        return /^text\/html\b/i.test(alternative.contentType);
    }).pop();
    this.message.attachments = this.getAttachments(!!this.message.htmlNode);

    this.message.useRelated = !!(this.message.htmlNode && this.message.attachments.related.length);
    this.message.useAlternative = this.message.alternatives.length > 1;
    this.message.useMixed = this.message.alternatives.length + this.message.attachments.attached.length > 1;

    if (this.message.useMixed) {
        this.message.builder = this.createMixed();
    } else if (this.message.useAlternative) {
        this.message.builder = this.createAlternative();
    } else if (this.message.useRelated) {
        this.message.builder = this.createRelated();
    } else {
        this.message.builder = this.createNode(false, [].concat(this.message.alternatives || []).concat(this.message.attachments.attached || []).shift());
    }
};

MailSender.prototype.createMixed = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/mixed');
    } else {
        node = parentNode.createChild('multipart/mixed');
    }

    if (this.message.useAlternative) {
        this.createAlternative(node);
    } else if (this.message.useRelated) {
        this.createRelated(node);
    }

    [].concat(this.message.alternatives.length < 2 && this.message.alternatives || []).concat(this.message.attachments.attached || []).forEach(function(element) {
        this.createNode(node, element);
    }.bind(this));

    return node;
};

MailSender.prototype.createAlternative = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/alternative');
    } else {
        node = parentNode.createChild('multipart/alternative');
    }

    this.message.alternatives.forEach(function(alternative) {
        if (this.message.useRelated && this.message.htmlNode === alternative) {
            this.createRelated(node);
        } else {
            this.createNode(node, alternative);
        }
    }.bind(this));

    return node;
};

MailSender.prototype.createRelated = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/related; type="text/html"');
    } else {
        node = parentNode.createChild('multipart/related; type="text/html"');
    }

    node.createChild(this.message.htmlNode.contentType).setContent(this.message.htmlNode.contents);

    this.message.attachments.related.forEach(function(alternative) {
        this.createNode(node, alternative);
    }.bind(this));
};

MailSender.prototype.createNode = function(parentNode, element) {
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

    node.setContent(element.contents);

    return node;
};

MailSender.prototype.getAttachments = function(findRelated) {
    var attachments = [].concat(this.mail.attachments || []).map(function(attachment) {
        var data = {
            contentType: attachment.contentType ||  
                libmime.detectMimeType(attachment.filename || attachment.filePath || attachment.href || 'bin')
        };

        if (attachment.filename) {
            data.filename = attachment.filename;
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
            data.contents = data.contents || '';
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

MailSender.prototype.getAlternatives = function() {
    var alternatives = [];

    if (this.mail.html) {
        alternatives.push({
            contentType: 'text/html; charset=utf-8',
            contents: this.mail.html
        });
    }

    if (this.mail.text) {
        alternatives.push({
            contentType: 'text/plain; charset=utf-8',
            contents: this.mail.text
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
            data.contents = data.contents || '';
        }

        alternatives.push(data);
    }.bind(this));

    return alternatives;
};

MailSender.prototype.send = function(transporter, callback) {
    transporter.send(this.message.builder.getEnvelope(), this.message.builder.createReadStream(), callback);
};