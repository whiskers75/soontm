/*jslint node: true*/
"use strict";
function zPad( number, width ) {
  return new Array(width - parseInt(Math.log(number)/Math.LN10) ).join('0') + number;
}
var net = require('net'),
readline = require('readline'),
EventEmitter = require('events').EventEmitter;

var Soon = {};
/**
 * Create a new server link.
 *
 * @constructor
 * @param {object} options - Object of options.
 * @param {string} options.host - IRC server host to connect to.
 * @param {number} options.port - Port number to connect to.
 * @param {string} options.sid - Server ID to use
 * @param {string} options.sname - Server name to use
 * @param {string} options.pass - Server linking password
 */
Soon.Server = function (options) {
    options = {
        host: options.host,
        port: options.port,
        sid: options.sid || '50X',
        pass: options.pass || 'pls',
        sname: options.sname,
        debug: true
    };
    var self = this;
    this.sock = net.connect({
        host: options.host,
        port: options.port
    });
    this.rl = readline.createInterface({
        input: this.sock,
        output: this.sock
    });
    /**
     * Object mapping S/EIDs to names
     */
    this.ids = {};
    /**
     * Object mapping users to UIDs.
     */
    this.users = {};
    /**
     * Object containing UIDs and their nickTSs.
     */
    this.tslist = {};
    this.theirid = ''; // their SID
    this.curid = 0;
    /**
     * Send a raw TS6 line to the other server. Inserts SID for you, or uses [id].
     *
     * @param {string} line - Line to send.
     * @param {string=} id - SID or UID to use
     * @since 0.0.1
     */
    this.send = function send(line, id) {
        line = line.replace(/\r?\n|\r/g, '');
        line = ':' + (id || options.sid) + ' ' + line;
        if (options.debug) console.log('<< ' + line);
        self.sock.write(line + '\r\n');
    };
    /**
     * Quit and disconnect from the other server.
     * 
     * @since 0.0.1
     */
    this.squit = function() {
        self.send('SQUIT ' + this.theirname);
    };
    /**
     * Service constructor. Created on mkserv();
     *
     * @constructor
     * @private
     * @param {string} id - UID
     */
    this.Service = function(id) {
        var selfserv = this;
        this.id = id;
        /**
         * Does the same as Server.send() but with the service's ID.
         */
        this.send = function(m) {
            self.send(m, selfserv.id);
        };
        /**
         * Joins a channel.
         *
         * @param {string} channel - channel to join
         */
        this.join = function(chan) {
            self.send('SJOIN ' + (Date.now() / 100).toFixed(0) + ' ' + chan + ' +nt :@' + selfserv.id);
        };
        /**
         * Leaves a channel.
         *
         * @param {string} channel - channel to leave
         */
        this.part = function(chan) {
            selfserv.send('PART ' + chan);
        };
        /**
         * Sends a message.
         *
         * @param {string} target - Target to send the message to (channel or UID)
         * @param {string} message - Message to send.
         */
        this.privmsg = function(to, msg) {
            selfserv.send('PRIVMSG ' + to + ' :' + msg);
        };
        /**
         * Sends a notice.
         *
         * @param {string} target - Target to send the notice to (channel or UID)
         * @param {string} message - Notice to send.
         */
        this.notice = function(to, msg) {
            selfserv.send('NOTICE ' + to + ' :' + msg);
        };
        /**
         * /kills a user.
         *
         * @param {string} target - UID of person to kill.
         * @param {string=} message - Optional kill message.
         */
        this.kill = function(uid, message) {
            selfserv.send('KILL ' + uid + ' :Killed (' + (message || '<No reason given>') + ')');
        };
    };
    /**
     * Register a new service.
     *
     * @param {string} name - nickname of new service
     * @param {string} ident - ident string of new service
     * @param {string} host - host of new service
     * @param {string=} gecos - realname of new service
     * @since 0.0.1
     */
    this.mkserv = function(name, ident, host, gecos) {
        self.curid++;
        var id = zPad(Number(self.curid), 6);
        self.ids[options.sid + id] = name;
        self.send('EUID ' + name + ' 1 ' + (Date.now() / 100).toFixed(0) + ' +Sio ' + host + ' ' + ident + ' 0 ' + options.sid + id + ' * * :' + (gecos || name));
        return new self.Service(options.sid + id);
    };
    // TS6 parser
    this.rl.on('line', function (line) {
        line = {tokens: String(line).split(' ')};

        if (line.tokens[0][0] === ':') {
            line.id = line.tokens[0].replace(':', '');
            line.tokens.shift();
        }
        else {
            line.id = self.theirid || 'none';
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
         * @property {string} id - The S/EID
         * @property {string} command - The TS6 command or numeric.
         * @property {array} args - Arguments to the TS6 command.
         * @property {string} name - The human-readable name.
         */
        line.name = self.ids[line.id];
        console.log('>> :' + line.id + ' (' + line.name + ') ' + line.command + ' ' + line.args.join(' '));
        if (line.command === 'PING' && line.args[1] === options.sid) {
            self.send('PONG ' + line.args[0] + ' :' + line.args[1]);
        }
        if (line.command === 'PASS' && line.id === 'none') {
            self.theirid = line.args[3];
        }
        if (line.command === 'SERVER' && line.id === self.theirid) {
            self.ids[self.theirid] = line.args[0];
        }
        if (line.command === 'SID') {
            self.ids[line.args[2]] = line.args[0];
        }
        if (line.command === 'EUID') {
            self.ids[line.args[7]] = line.args[4];
            self.users[line.args[4]] = line.args[7];
            self.tslist[line.args[7]] = line.args[2];
        }
        if (line.command === 'PRIVMSG') {
            /**
             * PRIVMSG event. Emitted when the server recieves information about a private message.
             *
             * @event 'privmsg'
             * @memberof Soon.Server
             * @param {string} name - The name (server/user) that said the message.
             * @param {string} id - The UID or SID of the person that said the message.
             * @param {string} target - The name (channel/user) where the message was said.
             * @param {string=} toid - The UID of the person to whom the message was said, if a user.
             * @param {string} message - The message!
             */
            var name = self.ids[line.id];
            var target = line.args[0];
            var toid = '';
            if (target[0] != '#') {
                toid = target;
                target = self.ids[target];
            }
            self.emit('privmsg', name, line.id, target, toid, line.args[1]);
        }
        return;
    });
    this.send('PASS ' + options.pass + ' TS 6 :' + options.sid);
    this.send('CAPAB :ENCAP SERVICES EUID RSFNC'); // TODO: KLN UNKLN EOPMOD EX IE QS
    this.send('SERVER ' + options.sname + ' 1 :' + options.sname);
};
require('util').inherits(Soon.Server, EventEmitter);
module.exports = Soon;

