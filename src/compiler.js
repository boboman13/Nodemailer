'use strict';

var BuildMail = require('buildmail');
var libmime = require('libmime');

module.exports = Compiler;

/**
 * Creates the object for composing a BuildMail instance out from the mail options
 *
 * @constructor
 * @param {Object} mail Mail options
 */
function Compiler(mail) {
    this.mail = mail || {};
    this.message = false;
}

/**
 * Builds BuildMail instance
 */
Compiler.prototype.compile = function() {
    this._alternatives = this._getAlternatives();
    this._htmlNode = this._alternatives.filter(function(alternative) {
        return /^text\/html\b/i.test(alternative.contentType);
    }).pop();
    this._attachments = this._getAttachments(!!this._htmlNode);

    this._useRelated = !!(this._htmlNode && this._attachments.related.length);
    this._useAlternative = this._alternatives.length > 1;
    this._useMixed = this._attachments.attached.length > 1 || (this._alternatives.length && this._attachments.attached.length === 1);

    // Compose MIME tree
    if (this._useMixed) {
        this.message = this._createMixed();
    } else if (this._useAlternative) {
        this.message = this._createAlternative();
    } else if (this._useRelated) {
        this.message = this._createRelated();
    } else {
        this.message = this._createContentNode(false, [].concat(this._alternatives || []).concat(this._attachments.attached || []).shift());
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

    // Add custom headers
    if (this.mail.headers) {
        this.message.addHeader(this.mail.headers);
    }

    // Sets custom envelope
    if (this.mail.envelope) {
        this.message.setEnvelope(this.mail.envelope);
    }

    return this.message;
};

/**
 * Builds multipart/mixed node. It should always contain different type of elements on the same level
 * eg. text + attachments
 *
 * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
 * @returns {Object} BuildMail node element
 */
Compiler.prototype._createMixed = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/mixed');
    } else {
        node = parentNode.createChild('multipart/mixed');
    }

    if (this._useAlternative) {
        this._createAlternative(node);
    } else if (this._useRelated) {
        this._createRelated(node);
    }

    [].concat(this._alternatives.length < 2 && this._alternatives || []).concat(this._attachments.attached || []).forEach(function(element) {
        this._createContentNode(node, element);
    }.bind(this));

    return node;
};

/**
 * Builds multipart/alternative node. It should always contain same type of elements on the same level
 * eg. text + html view of the same data
 *
 * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
 * @returns {Object} BuildMail node element
 */
Compiler.prototype._createAlternative = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/alternative');
    } else {
        node = parentNode.createChild('multipart/alternative');
    }

    this._alternatives.forEach(function(alternative) {
        if (this._useRelated && this._htmlNode === alternative) {
            this._createRelated(node);
        } else {
            this._createContentNode(node, alternative);
        }
    }.bind(this));

    return node;
};

/**
 * Builds multipart/related node. It should always contain html node with related attachments
 *
 * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
 * @returns {Object} BuildMail node element
 */
Compiler.prototype._createRelated = function(parentNode) {
    var node;

    if (!parentNode) {
        node = new BuildMail('multipart/related; type="text/html"');
    } else {
        node = parentNode.createChild('multipart/related; type="text/html"');
    }

    this._createContentNode(node, this._htmlNode);

    this._attachments.related.forEach(function(alternative) {
        this._createContentNode(node, alternative);
    }.bind(this));
};

/**
 * Creates a regular node with contents
 *
 * @param {Object} parentNode Parent for this note. If it does not exist, a root node is created
 * @param {Object} element Node data
 * @returns {Object} BuildMail node element
 */
Compiler.prototype._createContentNode = function(parentNode, element) {
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

/**
 * List all attachments. Resulting attachment objects can be used as input for BuildMail nodes
 *
 * @param {Boolean} findRelated If true separate related attachments from attached ones
 * @returns {Object} An object of arrays (`related` and `attached`)
 */
Compiler.prototype._getAttachments = function(findRelated) {
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

/**
 * List alternatives. Resulting objects can be used as input for BuildMail nodes
 *
 * @returns {Array} An array of alternative elements. Includes the `text` and `html` values as well
 */
Compiler.prototype._getAlternatives = function() {
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