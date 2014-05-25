var net = require('net');
var readline = require('readline');
var tls = require('tls');
var EventEmitter = require('events').EventEmitter;
var Soon = {
    /** 
     * Returns an action CTCP message to be passed to privmsg.
     * @param {string} text - Text to action.
     */
    action: function(text) {
        return '\x01ACTION ' + text + '\x01';
    }, 
    /**
     * Returns a CTCP message.
     * @param {string} type - Type of message (VERSION, ACTION, PING)
     * @param {string} text - Parameters to the message.
     */
    ctcp: function(type, text) {
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
        debug: options.debug || false
    };
    if (options.tls) {
        /**
         * Raw IRC socket. Ideally, never use.
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
     * Raw readline interface. Ideally, never use.
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
     * Object mapping nicknames to accountnames. You don't need to access this.
     */
    this.accounts = {}; // new feature: live account tracking!
    var self = this;
    /**
     * Send a raw IRC line.
     *
     * @param {string} line - Line to send.
     */
    this.send = function send(line) {
        line = line.replace(/\r?\n|\r/g, '');
        if (options.debug) console.log('>>> ' + line);
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
        if (!message) message = "lazy coder has no part message";
        self.send('PART ' + target + ' :' + message);
    };
    /**
     * Quit and disconnect from the IRC server. (After this, you may want to exit. Reconnection isn't possible.)
     *
     * @param {string=} message - Quit message.
     */
    this.quit = function(message) {
        if (!message) message = "lazy coder has no quit message";
        self.send('QUIT :' + message);
    };
    this.rl.on('line', function (line) {
        line = line.split(' ');
        if (line[0][0] != ':') {
            if (line[0] == 'PING') {
                return self.send('PONG ' + line[1]);
            }
            if (line[0] == 'AUTHENTICATE' && line[1] == '+') {
                return self.send('AUTHENTICATE ' + new Buffer(options.user + '\0' + options.user + '\0' + options.password).toString('base64'));
            }
            console.log('!!<<< Strange message recieved.');
            console.log('!!<<< ' + line);
        }
        /**
         * @namespace line
         * @property {string} from - The hostmask the line comes from.
         * @property {string} command - The IRC command or numeric.
         * @property {array} args - Arguments to the IRC command.
         * @property {string=} message - The IRC message.
         * @property {nick=} nick - The IRC nickname that the command is related to.
         * @property {ident=} ident - The ident of the IRC user that the command is related to.
         * @property {host=} host - The host of the IRC user that the command is related to.
         * @property {account=} account - The IRC accountname of the IRC user that the command is related to.
         */
        line.from = line[0].replace(':', '');
        line.command = line[1];
        line.args = line.slice(2, line.length).join(' ').split(':')[0];
        if (line.args[line.args.length - 1] == ' ') {
            line.args = line.args.substr(0, line.args.length - 1);
        }
        line.args = line.args.split(' ');
        line.message = line.slice(2, line.length).join(' ').split(':');
        line.message.shift();
        line.message = line.message.join(':');
        if (line.from.indexOf('@') != -1) {
            line.nick = line.from.split('@')[0].split('!')[0];
            line.ident = line.from.split('@')[0].split('!')[1];
            line.host = line.from.split('@')[1];
            if (self.accounts[line.nick]) {
                line.account = self.accounts[line.nick];
            }
        }
        if (options.debug) console.log('<<< ' + line.command + ' from ' + line.from + ': ' + line.message + ' (args: ' + line.args.join(', ') + ')');
        if (line.command == '001') {
            self.emit('registered');
            self.connected = true;
            self.send('CAP REQ :extended-join account-notify');
        }
        if (line.command == 'CAP') {
            if (line.args[1] == 'ACK' && line.message.indexOf('sasl') != -1) {
                self.send('AUTHENTICATE PLAIN');
            }
        }
        if (line.command == '904' || line.command == '905') {
            self.emit('error', new Error('SASL authentication failed.'));
            self.send('CAP END');
        }
        if (line.command == '903') {
            console.log('<<< SASL successful!');
            self.send('CAP END');
        }
        if (line.command == '354') {
            // a WHOX reply, we're assuming it's %na
            if (line.args[2] == '0') return delete self.accounts[line.args[1]];
            self.accounts[line.args[1]] = line.args[2];
        }
        if (line.command === "ACCOUNT") {
            // account-notify CAP extension
            if (line.args[0] === '*') return delete self.accounts[line.nick];
            self.accounts[line.nick] = line.args[0];
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
         * @property {string=} ctcp - If the message is a CTCP query, the query.
         */
        if (line.command == 'PRIVMSG' && line.nick) {
            if (line.message[0] == '\u0001' && line.message[line.message.length - 1] == '\u0001') {
                line.ctcp = line.message.slice(1, line.message.length - 1);
                console.log(line.ctcp);
                if (line.ctcp == 'VERSION') {
                    return send('NOTICE ' + line.nick + ' :\x01VERSION ' + options.version + '\x01');
                }
            }
            self.emit('privmsg', line.nick, line.args[0], line.message, line);
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
         */
        if (line.command == 'NOTICE' && line.nick) self.emit('notice', line.nick, line.args[0], line.message, line);
        if (line.command == 'JOIN' && line.nick) {
            if (line.args[1]) {
            if (line.args[1] === '*') return delete self.accounts[line.nick];
            self.accounts[line.nick] = line.args[1];
            }
            if (line.nick == options.nick) {
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
             */
            self.emit('join', line.nick, line.args[0], line.args[1], line.message);
        }
        /**
         * PART event.
         *
         * @event part
         * @memberof Soon.Client
         * @property {string} nick - The nickname that parted.
         * @property {string} channel - The channel that the user parted.
         * @property {string=} message - The part message that was given.
         */
        if (line.command == 'PART' && line.nick) self.emit('part', line.nick, line.args[0], line.message);
        return this;
    });
    if (options.sasl) {
        if (!options.tls) self.emit('error', new Error('It is unwise to enable SASL over plaintext.'));
        self.send('CAP REQ :sasl');
    }
    else if (options.password) {
        if (!options.tls) self.emit('error', new Error('Are you seriously sending a password over plaintext? ಠ_ಠ'));
        this.send('PASS ' + options.password);
    }
    this.send('NICK ' + options.nick);
    this.send('USER ' + options.ident + ' X X :' + options.realname);
};
require('util').inherits(Soon.Client, EventEmitter);
module.exports = Soon;
