/*jslint node: true, devel: true*/

'use strict';

var net = require('net'),
    readline = require('readline'),
    tls = require('tls'),
    EventEmitter = require('events').EventEmitter;

var soontm = {
    /**
     * Returns a CTCP message.
     *
     * @param {string} type - Type of the message (e.g. ACTION, PING, VERSION).
     * @param {string} text - Parameters to the message.
     */
    makeCtcp: function (type, text) {
        if (!text) { return '\u0001' + type + '\u0001'; }
        return '\u0001' + type + ' ' + text + '\u0001';
    },

    /**
     * Returns the lowercased version of the given nick or channel name
     * according to IRC rules.
     * http://tools.ietf.org/html/rfc2812#section-2.2
     *
     * @param {string} string - nick or channel name to lowercase
     */
    toLowerCase: function (string) {
        return string.toLowerCase().replace(/\[/g, '{')
            .replace(/\]/g, '}')
            .replace(/\\/g, '|')
            .replace(/~/g, '^');
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
soontm.Client = function (options) {
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
     * bot.accounts['^whiskers75'] // 'whiskers75'
     */
    this.accounts = {};
    this.awaystatus = {};
    /*
     * Indicates whether away notify is enabled.
     */
    this.awaynotify = false;
    /*
     * List of capabilities to request.
     */
    this.capabilities = '';
    var self = this;
    /**
     * Send a raw IRC line.
     *
     * @param {string} line - Line to send.
     * @example
     * bot.send('REMOVE #botwar whiskers75 :get out');
     */
    this.send = function send(line) {
        line = line.replace(/\r?\n|\r/g, '');
        if (options.debug) { console.log('<<< ' + line); }
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
        message.split('\n').forEach(function (bit) {
            self.send('PRIVMSG ' + target + ' :' + bit);
        });
    };
    /**
     * Send a CTCP request.
     *
     * @param {string} target - Person or channel to message.
     * @param {string} type - Type of message (e.g. ACTION, PING, VERSION).
     * @param {string} text - Parameters to the message.
     */
    this.ctcp = function (target, type, text) {
        self.privmsg(target, soontm.makeCtcp(type, text));
    };
    /**
     * Send a CTCP ACTION (/me).
     *
     * @param {string} target - Person or channel to message.
     * @param {string} message - Message to send.
     */
    this.action = function (target, message) {
        self.ctcp(target, 'ACTION', message);
    };
    /**
     * Send a NOTICE.
     *
     * @param {string} target - Person or channel to notice.
     * @param {string} message - Notice to send.
     */
    this.notice = function (target, message) {
        self.send('NOTICE ' + target + ' :' + message);
    };
    /**
     * Send a CTCP reply.
     *
     * @param {string} target - Person or channel to message.
     * @param {string} type - Type of message (e.g. ACTION, PING, VERSION).
     * @param {string} text - Parameters to the message.
     */
    this.ctcpReply = function (target, type, text) {
        self.notice(target, soontm.makeCtcp(type, text));
    };
    /**
     * Join a channel.
     *
     * @param {string} target - Channel to join.
     */
    this.join = function (target) {
        self.send('JOIN ' + target);
    };
    /**
     * Part a channel.
     * @param {string} target - Channel to part.
     * @param {string=} message - Part message.
     */
    this.part = function (target, message) {
        if (!message) { message = ''; }
        self.send('PART ' + target + ' :' + message);
    };
    /**
     * Quit and disconnect from the IRC server. (After this, you may want to exit. Reconnection isn't currently possible.)
     *
     * @param {string=} message - Quit message.
     */
    this.quit = function (message) {
        if (!message) { message = ''; }
        self.send('QUIT :' + message);
    };
    /**
     * Stream of raw data. See the '???' event for more details.
     */
    this.raw = new EventEmitter();
    // IRC parser bit
    this.rl.on('line', function (rawLine) {
        var line = {tokens: String(rawLine).split(' ')}, i;

        if (line.tokens[0][0] === ':') {
            line.prefix = line.tokens[0].replace(':', '');
            line.tokens.shift();
        } else {
            line.prefix = '';
        }

        line.command = line.tokens[0];
        line.tokens.shift();

        line.args = [];

        for (i = 0; i < line.tokens.length; i += 1) {
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
         * @property {status=} status - The status (away/here) of the IRC user that the command is related to. (H = here; G = gone)
         */
        if (line.prefix.indexOf('@') !== -1) {
            line.nick = line.prefix.split('!')[0];
            line.ident = line.prefix.split('@')[0].split('!')[1];
            line.host = line.prefix.split('@')[1];
            if (self.accounts[line.nick]) {
                line.account = self.accounts[line.nick];
            }
            if (self.awaynotify && self.awaystatus[line.nick]) {
                line.status = self.awaystatus[line.nick];
            }
        }
        if (options.debug) { console.log('>>> ' + rawLine); }
        if (line.command === '001') {
            /**
             * Event emitted when the client connects.
             *
             * @memberof soontm.Client
             * @event registered
             */
            self.emit('registered');
            self.connected = true;
            if (options.channels) { options.channels.forEach(self.join); }
        }
        if (line.command === 'CAP') {
            if (line.args[1] === 'LS') {
                if (line.args[2].indexOf('away-notify') !== -1) {
                    self.capabilities += 'away-notify ';
                }
                if (line.args[2].indexOf('account-notify') !== -1 && line.args[2].indexOf('extended-join') !== -1) {
                    self.capabilities += 'extended-join account-notify ';
                }
                if (line.args[2].indexOf('multi-prefix') !== -1) {
                    self.capabilities += 'multi-prefix ';
                }
                if (options.sasl && options.password && line.args[2].indexOf('sasl') !== -1) {
                    if (!options.tls && !options.sloppy) { self.emit('error', new Error('Are you seriously trying to send a password over plaintext? ಠ_ಠ')); }
                    self.capabilities += 'sasl ';
                }
                self.send('CAP REQ :' + self.capabilities);
            }
            if (line.args[1] === 'ACK') {
                if (line.args[2].indexOf('sasl') !== -1) {
                    self.send('AUTHENTICATE PLAIN');
                }
                if (line.args[2].indexOf('away-notify') !== -1) {
                    self.awaynotify = true;
                }
            }
            if (line.args[1] === 'NAK') {
                self.emit('error', new Error('Capability negotiation failed.'));
            }
            if (!options.sasl) { self.send('CAP END'); }
        }
        if (line.command === '904' || line.command === '905') {
            self.emit('error', new Error('SASL authentication failed.'));
            self.send('CAP END');
        }
        if (line.command === '903') {
            if (options.debug) { console.log('SASL successful!'); }
            self.send('CAP END');
        }
        if (line.command === '354') {
            if (self.awaynotify) {
                // a WHOX reply, we're assuming it's %nfa
                self.awaystatus[line.args[1]] = line.args[2].split('')[0];
                if (line.args[3] === '0') { return delete self.accounts[line.args[1]]; }
                self.accounts[line.args[1]] = line.args[3];
            } else {
                // a WHOX reply, we're assuming it's %na
                if (line.args[2] === '0') { return delete self.accounts[line.args[1]]; }
                self.accounts[line.args[1]] = line.args[2];
            }
        }
        if (line.command === 'ACCOUNT') {
            // account-notify CAP extension
            if (line.args[0] === '*') { return delete self.accounts[line.nick]; }
            self.accounts[line.nick] = line.args[0];
        }
        if (line.command === 'AWAY') {
            // away-notify CAP extension
            if (line.args[0]) {
                self.awaystatus[line.nick] = 'G';
            } else {
                self.awaystatus[line.nick] = 'H';
            }
        }
        if (line.command === 'PING') {
            self.send(String('PONG ' + line.tokens.join(' ')));
        }
        if (line.command === 'ERROR') {
            self.emit('error', new Error('Error from server: ' + line.args.join(' ')));
            // This means we're disconnected, and there's no reconnection support right now, so exit unconditionally.
            process.exit(1);
        }
        if (line.command === 'AUTHENTICATE' && line.args[0] === '+') {
            self.send('AUTHENTICATE ' + new Buffer(options.user + '\u0000' + options.user + '\u0000' + options.password).toString('base64'));
        }
        /**
         * Message event.
         *
         * @event privmsg
         * @memberof soontm.Client
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
                    return self.send('NOTICE ' + line.nick + ' :\u0001VERSION ' + options.version + '\u0001');
                }
                if (line.ctcp[0].toLowerCase() === 'ping') {
                    return self.send('NOTICE ' + line.nick + ' :\u0001PING ' + line.ctcp.slice(1, line.ctcp.length).join(' ') + '\u0001');
                }
            }
            self.emit('privmsg', line.nick, line.args[0], line.args[1], line);
        }
        /**
         * NOTICE event.
         *
         * @event notice
         * @memberof soontm.Client
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
                } else {
                    self.accounts[line.nick] = line.args[1];
                }
            }
            if (line.nick === options.nick) {
                if (self.awaynotify) {
                    self.send('WHO ' + line.args[0] + ' %nfa');
                } else {
                    self.send('WHO ' + line.args[0] + ' %na');
                }
            }
            /**
             * JOIN event.
             *
             * @event join
             * @memberof soontm.Client
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
         * @memberof soontm.Client
         * @property {string} nick - The nickname that parted.
         * @property {string} channel - The channel that the user parted.
         * @property {string=} message - The part message that was given.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === 'PART' && line.nick) { self.emit('part', line.nick, line.args[0], line.args[1], line); }
        /**
         * QUIT event. Emitted when a user leaves IRC.
         *
         * @event quit
         * @memberof soontm.Client
         * @property {string} nick - The nickname that left.
         * @property {string} message - The quit message that was given.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === 'QUIT' && line.nick) { self.emit('quit', line.nick, line.args[0], line); }
        /**
         * Invite event. Emitted when the client recieves an /invite.
         *
         * @event invite
         * @memberof soontm.Client
         * @property {string} nick - The nickname which is inviting you.
         * @property {string} channel - The channel you are being invited to.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === 'INVITE') { self.emit('invite', line.nick, line.args[1], line); }
        /**
         * RPL_TOPIC - emitted when the client recieves a topic reply.
         *
         * @event rpl_topic
         * @memberof soontm.Client
         * @since 0.2.0
         * @property {string} channel - The channel of which you're getting a topic for
         * @property {string} topic - The topic itself.
         */
        if (line.command === '332') { self.emit('rpl_topic', line.args[1], line.args[2]); }
        /**
         * TOPIC - emitted when the client receives a topic change.
         *
         * @event topic
         * @memberof soontm.Client
         * @property {string} nick - The nickname that changed the topic.
         * @property {string} channel - The channel where the topic is changed.
         * @property {string} topic - The topic itself.
         */
        if (line.command === 'TOPIC') { self.emit('topic', line.nick, line.args[0], line.args[1]); }
        /**
         * WALLOPS - emitted when a wallops is received.
         *
         * @event wallops
         * @memberof soontm.Client
         * @property {string} nick - The nickname that sent the wallops.
         * @property {string} message - The wallops that was sent.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === 'WALLOPS') { self.emit('wallops', line.nick, line.args[0], line); }
        /**
         * RPL_MONONLINE - emitted when the client receives the 730 numeric
         *
         * @event rpl_mononline
         * @memberof soontm.Client
         * @property {string} nick - The nickname that became online.
         * @property {string} username - The username of the user that became online.
         * @property {string} host - The hostname of the user that became online.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === '730') {
            line.args[1].split(',').forEach(function (target) {
                self.emit('rpl_mononline', target.split('@')[0].split('!')[0], target.split('@')[0].split('!')[1], target.split('@')[1], line);
            });
        }
        /**
         * RPL_MONOFFLINE - emitted when the client receives the 731 numeric
         *
         * @event rpl_monoffiline
         * @memberof soontm.Client
         * @property {string} nick - The nickname that left the IRC network.
         * @property {object} line - The raw line data. See the line namespace.
         */
        if (line.command === '731') {
            line.args[1].split(',').forEach(function (target) {
                self.emit('rpl_monoffline', target, line);
            });
        }
        /**
         * Raw event. Emitted on every properly-formatted IRC line.
         * Replace '???' with the IRC command or numeric.
         *
         * @event ???
         * @memberof soontm.Client.raw
         * @property {object} line - The raw line data. See the line namespace.
         * @since 0.2.0
         * @example
         * bot.raw.on('376', function(line) {doThings()});
         */
        self.raw.emit(line.command, line);
        return this;
    });
    if (!options.sasl && options.password) {
        if (!options.tls && !options.sloppy) { self.emit('error', new Error('Are you seriously trying to send a password over plaintext? ಠ_ಠ')); }
        this.send('PASS ' + options.password);
    }
    this.send('CAP LS');
    this.send('NICK ' + options.nick);
    this.send('USER ' + options.ident + ' X X :' + options.realname);
};
require('util').inherits(soontm.Client, EventEmitter);
module.exports = soontm;
