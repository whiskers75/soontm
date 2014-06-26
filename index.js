/*jslint node: true*/
"use strict";

var net = require('net'),
readline = require('readline'),
tls = require('tls'),
EventEmitter = require('events').EventEmitter;

var Soon = {
    /** 
     * Returns an action CTCP message to be passed to privmsg. (shorthand for Soon.ctcp('action');
     * @param {string} text - Text to action.
     */
    action: function(text) {
        return this.ctcp('ACTION', text);
    }, 
    /**
     * Returns a CTCP message.
     * @param {string} type - Type of message (VERSION, ACTION, PING)
     * @param {string} text - Parameters to the message.
     */
    ctcp: function(type, text) {
        if (!text) return '\x01' + type + '\x01';
        return '\x01' + type + ' ' + text + '\x01';
    }
};
/**
 * Create a new IRC connection.
 * @constructor
 * @param {object} options - Object of options.
 * @param {string} options.host - IRC server host to connect to.
 * @param {number} options.port - Port number to connect to.
 * @param {boolean} options.tls - Whether to enable TLS (SSL).
 * @param {string} options.nick - IRC nickname.
 * @param {string=} options.user - IRC SASL username.
 * @param {string=} options.ident - IRC 'ident' string.
 * @param {string=} options.realname - IRC realname (gecos).
 * @param {string=} options.password - IRC server or SASL password.
 * @param {boolean=} options.sasl - Whether to enable SASL.
 * @param {string} options.version - A custom CTCP VERSION reply.
 * @param {boolean=} options.debug - Whether to log protocol debug messages.
 * @param {array=} options.channels - Array of channels to autojoin.
 * @param {boolean=} options.sloppy - Whether to care about security.
 */
Soon.Client = function (options) {
    options = {
        host: options.host,
        port: options.port,
        nick: options.nick,
        user: options.user || options.nick,
        ident: options.ident || options.user || options.nick,
        realname: options.realname || options.nick,
        sasl: options.sasl || false,
        password: options.password || '',
        tls: options.tls || false,
        version: options.version || 'soontm irc library by whiskers75',
        debug: options.debug || false,
        channels: options.channels || [],
        sloppy: options.sloppy || false
    };
    if (options.tls) {
        /**
         * Raw IRC socket. NEVER USE THIS! Use send() instead.
         *
         * @private
         */
        this.sock = tls.connect({
            host: options.host,
            port: options.port
        });
    } else {
        this.sock = net.connect({
            host: options.host,
            port: options.port
        });
    }
    /**
     * Raw readline interface. NEVER USE THIS! Use send() instead.
     *
     * @private
     */
    this.rl = readline.createInterface({
        input: this.sock,
        output: this.sock
    });
    /**
     * Indicates whether the client is connected.
     */
    this.connected = false;
    /*
     * Object mapping nicknames to accountnames.
     *
     * @example
     * bot.accounts["^whiskers75"] // "whiskers75"
     */
    this.accounts = {};
    var self = this;
    /**
     * Send a raw IRC line.
     *
     * @param {string} line - Line to send.
     * @example
     * bot.send("REMOVE #botwar whiskers75 :get out");
     */
    this.send = function send(line) {
        line = line.replace(/\r?\n|\r/g, '');
        if (options.debug) console.log('<<< ' + line);
        self.sock.write(line + '\r\n');
    };
    /**
     * Send a message.
     *
     * @param {string} target - Person or channel to message.
     * @param {string} message - Message to send.
     */
    this.privmsg = function (target, message) {
        message = message.replace(/\r?\n|\r/g, '\n');
        message.split('\n').forEach(function(bit) {
            self.send('PRIVMSG ' + target + ' :' + bit);
        });
    };
    /**
     * Send a NOTICE.
     *
     * @param {string} target - Person or channel to notice.
     * @param {string} message - Notice to send.
     */
    this.notice = function(target, message) {
        self.send('NOTICE ' + target + ' :' + message);
    };
    /**
     * Join a channel.
     *
     * @param {string} target - Channel to join.
     */
    this.join = function(target) {
        self.send('JOIN ' + target);
    };
    /**
     * Part a channel.
     * @param {string} target - Channel to part.
     * @param {string=} message - Part message.
     */
    this.part = function(target, message) {
        if (!message) message = "";
        self.send('PART ' + target + ' :' + message);
    };
    /**
     * Quit and disconnect from the IRC server. (After this, you may want to exit. Reconnection isn't currently possible.)
     *
     * @param {string=} message - Quit message.
     */
    this.quit = function(message) {
        if (!message) message = "";
        self.send('QUIT :' + message);
    };
    /**
     * Stream of raw data. See the "???" event for more details.
     */
    this.raw = new EventEmitter();
    // IRC parser bit
    this.rl.on('line', function (_line) {
        var line = {tokens: String(_line).split(' ')};

        if (line.tokens[0][0] === ':') {
            line.prefix = line.tokens[0].replace(':', '');
            line.tokens.shift();
        }
        else {
            line.prefix = '';
        }

        line.command = line.tokens[0];
        line.tokens.shift();

        line.args = [];

        for (var i = 0; i < line.tokens.length; ++i) {
            if (line.tokens[i][0] === ':') {
                line.args.push(line.tokens.slice(i).join(' ').slice(1));
                break;
            }
            line.args.push(line.tokens[i]);
        }
        
        /**
         * Raw data from the IRC parser.
         *
         * @namespace line
         * @property {string} prefix - The prefix to the line (server or hostmask).
         * @property {string} command - The IRC command or numeric.
         * @property {array} args - Arguments to the IRC command.
         * @property {nick=} nick - The IRC nickname that the command is related to.
         * @property {ident=} ident - The ident of the IRC user that the command is related to.
         * @property {host=} host - The host of the IRC user that the command is related to.
         * @property {account=} account - The IRC accountname of the IRC user that the command is related to.
         */
        if (line.prefix.indexOf('@') != -1) {
            line.nick = line.prefix.split('@')[0].split('!')[0];
            line.ident = line.prefix.split('@')[0].split('!')[1];
            line.host = line.prefix.split('@')[1];
            if (self.accounts[line.nick]) {
                line.account = self.accounts[line.nick];
            }
        }
        if (options.debug) console.log('>>> ' + _line);
        if (line.command === '001') {
            /**
             * Event emitted when the client connects.
             *
             * @memberof Soon.Client
             * @event registered
             */
            self.emit('registered');
            self.connected = true;
            self.send('CAP REQ :extended-join account-notify');
            if (options.channels) options.channels.forEach(self.join);
        }
        if (line.command === 'CAP') {
            if (line.args[1] === 'ACK' && line.args[2].indexOf('sasl') != -1) {
                self.send('AUTHENTICATE PLAIN');
            }
        }
        if (line.command === '904' || line.command === '905') {
            self.emit('error', new Error('SASL authentication failed.'));
            self.send('CAP END');
        }
        if (line.command === '903') {
            if (options.debug) console.log('SASL successful!');
            self.send('CAP END');
        }
        if (line.command === '354') {
            // a WHOX reply, we're assuming it's %na
            if (line.args[2] === '0') return delete self.accounts[line.args[1]];
            self.accounts[line.args[1]] = line.args[2];
        }
        if (line.command === "ACCOUNT") {
            // account-notify CAP extension
            if (line.args[0] === '*') return delete self.accounts[line.nick];
            self.accounts[line.nick] = line.args[0];
        }
        if (line.command === 'PING') {
            self.send(String('PONG ' + line.tokens.join(' ')));
        }
        if (line.command === 'ERROR') {
            console.log('Error from server: ' + line.args.join(' '));
            process.exit(1);
        }
        if (line.command === 'AUTHENTICATE' && line.args[0] === '+') {
            self.send('AUTHENTICATE ' + new Buffer(options.user + '\0' + options.user + '\0' + options.password).toString('base64'));
        }
        /**
         * Message event.
         *
         * @event privmsg
         * @memberof Soon.Client
         * @property {string} nick - The nickname that said the message.
         * @property {string} target - The target the message was said to (channel or your nick).
         * @property {string} message - The message said.
         * @property {object} line - The raw line data. See the line namespace.
         * @property {array=} line.ctcp - If the message is a CTCP query, the query.
         */
        if (line.command === 'PRIVMSG' && line.nick) {

            if (line.args[1][0] === '\u0001' && line.args[1][line.args[1].length - 1] === '\u0001') {
                line.ctcp = line.args[1].slice(1, line.args[1].length - 1).split(' ');
                if (line.ctcp[0].toLowerCase() === 'version') {
                    return self.send('NOTICE ' + line.nick + ' :\x01VERSION ' + options.version + '\x01');
                }
                if (line.ctcp[0].toLowerCase() === 'ping') {
                    return self.send('NOTICE ' + line.nick + ' :\x01PING ' + line.ctcp.slice(1, line.ctcp.length).join(' ') + '\x01');
                }
            }
            self.emit('privmsg', line.nick, line.args[0], line.args[1], line);
        }
        /**
         * NOTICE event.
         *
         * @event notice
         * @memberof Soon.Client
         * @property {string} nick - The nickname that emitted the notice..
         * @property {string} target - The target that was noticed (channel or your nick).
         * @property {string} message - The notice.
         * @property {object} line - The raw line data. See the line namespace.
         * @property {array=} line.ctcp - If the message is a CTCP reply, the reply.
         */
        if (line.command === 'NOTICE' && line.nick) {
            if (line.args[1][0] === '\u0001' && line.args[1][line.args[1].length - 1] === '\u0001') {
                line.ctcp = line.args[1].slice(1, line.args[1].length - 1).split(' ');
            }
            self.emit('notice', line.nick, line.args[0], line.args[1], line);
        }
        if (line.command === 'JOIN' && line.nick) {
            if (line.args[1]) {
                if (line.args[1] === '*') {
                    delete self.accounts[line.nick];
                }
                else {
                self.accounts[line.nick] = line.args[1];
                }
            }
            if (line.nick === options.nick) {
                self.send('WHO ' + line.args[0] + ' %na');
            }
            /**
             * JOIN event.
             *
             * @event join
             * @memberof Soon.Client
             * @property {string} nick - The nickname that joined.
             * @property {string} channel - The channel that was joined.
             * @property {string=} account - The account that joined. (extended-join)
             * @property {string=} gecos - The realname (gecos) of the user that joined (extended-join)
             * @property {object} line - The raw line data. See the line namespace.
             */
            self.emit('join', line.nick, line.args[0], line.args[1], line.args[2], line);
        }
        /**
         * PART event.
         *
         * @event part
         * @memberof Soon.Client
         * @property {string} nick - The nickname that parted.
         * @property {string} channel - The channel that the user parted.
         * @property {string=} message - The part message that was given.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === 'PART' && line.nick) self.emit('part', line.nick, line.args[0], line.args[1], line);
        /**
         * QUIT event. Emitted when a user leaves IRC.
         *
         * @event quit
         * @memberof Soon.Client
         * @property {string} nick - The nickname that left.
         * @property {string} message - The quit message that was given.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === 'QUIT' && line.nick) self.emit('quit', line.nick, line.args[0], line);
        /**
         * Invite event. Emitted when the client recieves an /invite.
         *
         * @event invite
         * @memberof Soon.Client
         * @property {string} nick - The nickname which is inviting you.
         * @property {string} channel - The channel you are being invited to.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === 'INVITE') self.emit('invite', line.nick, line.args[1], line);
        /**
         * RPL_TOPIC - emitted when the client recieves a topic reply.
         *
         * @event topic
         * @memberof Soon.Client
         * @since 0.2.0
         * @property {string} channel - The channel of which you're getting a topic for
         * @property {string} topic - The topic itself.
         */
        if (line.command === '332') self.emit('topic', line.args[1], line.args[2]);
        /**
         * Raw event. Emitted on every properly-formatted IRC line.
         * Replace "???" with the IRC command or numeric.
         *
         * @event ???
         * @memberof Soon.Client.raw
         * @property {object} line - The raw line data. See the line namespace.
         * @since 0.2.0
         * @example
         * bot.raw.on('376', function(line) {doThings()});
         */
        self.raw.emit(line.command, line);
        return this;
    });
    if (options.sasl) {
        if (!options.tls && !options.sloppy) self.emit('error', new Error('Are you seriously trying to send a password over plaintext? ಠ_ಠ'));
        self.send('CAP REQ :sasl');
    }
    else if (options.password) {
        if (!options.tls && !options.sloppy) self.emit('error', new Error('Are you seriously trying to send a password over plaintext? ಠ_ಠ'));
        this.send('PASS ' + options.password);
    }
    this.send('NICK ' + options.nick);
    this.send('USER ' + options.ident + ' X X :' + options.realname);
};
// cf. http://tools.ietf.org/html/rfc2812#section-2.2
Soon.toLowerCase = function (string) {
    return string.toLowerCase().replace(/\[/g, '{')
                               .replace(/\]/g, '}')
                               .replace(/\\/g, '|')
                               .replace(/~/g, '^');
} 
require('util').inherits(Soon.Client, EventEmitter);
module.exports = Soon;
