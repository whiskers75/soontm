/*jslint node: true*/
"use strict";
function zPad( number, width ) {
  return new Array(width - parseInt(Math.log(number)/Math.LN10) ).join('0') + number;
}
console.colors = {
      'white': ['\x1B[37m', '\x1B[39m'],
      'grey': ['\x1B[90m', '\x1B[39m'],
      'black': ['\x1B[30m', '\x1B[39m'],
      'blue': ['\x1B[34m', '\x1B[39m'],
      'cyan': ['\x1B[36m', '\x1B[39m'],
      'green': ['\x1B[32m', '\x1B[39m'],
      'magenta': ['\x1B[35m', '\x1B[39m'],
      'red': ['\x1B[31m', '\ix1B[39m'],
      'yellow': ['\x1B[33m', '\x1B[39m']
};
var net = require('net'),
readline = require('readline'),
EventEmitter = require('events').EventEmitter;

var SoonTS6 = {};
/**
 * Create a new fake services server and link it to another real server.
 *
 * @constructor
 * @param {object} options - Object of options.
 * @param {string} options.host - IRC server host to connect to.
 * @param {number} options.port - Port number to connect to.
 * @param {string} options.sid - Server ID to use
 * @param {string} options.sname - Server name to use
 * @param {string} options.pass - Server linking password
 */
SoonTS6.Server = function (options) {
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
     * Constructor for IRC objects (users or servers).
     *
     * @constructor
     * @param {string} id - UID or SID of the object.
     * @param {string} name - The object's human-readable name.
     * @param {number=} ts - The object's timestamp.
     * @param {array=} modes - The object's modes (for a user).
     * @param {string=} host - The object's hostname.
     * @param {string=} ident - The object's ident or user portion.
     * @param {string=} desc - The server description or gecos.
     * @param {boolean} isService - If the IRCObj is a service.
     */
    this.IRCObj = function(id, name, ts, modes, ident, host, desc, isService) {
        console.log(id, name, ts, modes, ident, host, desc);
        this.id = String(id) || '99XAAAAAA';
        this.name = String(name) || 'unidentified irc object';
        this.ts = Number(ts) || 0;
        this.modes = modes || [];
        this.ident = String(ident) || '';
        this.host = String(host) || '';
        this.desc = String(desc) || '';
        this.isService = isService || false;
        this.toString = function() {return name;};
        return this;
    };
    /**
     * Array storing IRCObjs.
     */
    this.objs = [];
    /**
     * Whether we are bursting.
     */
    this.burst = true;
    /**
     * Date signifying when the burst started.
     */
    this.burstStart = new Date().getTime();
    /**
     * Find an IRCObj by a certain attribute (like name, id...).
     *
     * @param {string} attr - The attribute to check.
     * @param {string} val - The wanted value of the attribute to check.
     * @returns {object} - a Server.IRCObj (or undefined if there is no such object)
     */
    this.objs.findByAttr = function(attr, val) {
        var ircobj;
        self.objs.forEach(function(obj) {
            if (obj[attr] == val) ircobj = obj;
        });
        return ircobj;
    };
    this.theirid = ''; // their SID
    this.curid = 0;
    /**
     * Send a raw TS6 line to the other server. Inserts SID for you, or uses [id].
     *
     * @param {string} line - Line to send.
     * @param {string=} id - SID or UID to use
     * @since 0.0.1
     */
    this.send = function(line, id) {
        line = line.replace(/\r?\n|\r/g, '');
        line = ':' + (id || options.sid) + ' ' + line;
        if (options.debug) console.log('<< ' + line);
        self.sock.write(line + '\r\n');
    };
    /**
     * Function to be called to send a log message. 
     * Interchange with your own at will. (By default, notices #services).
     *
     * @param {string} message - Message to log.
     */
    this.log = function(msg) {
        self.send('NOTICE #services :*** ' + msg);
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
     * Service constructor. Server.mkserv() does this for you, so usually there's no need to directly call this.
     *
     * @constructor
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
            selfserv.send('KILL ' + uid + ' :' + self.objs.findByAttr('id', id) + ' (' + (message || '<No reason given>') + ')');
        };
        /**
         * changes the host of a user
         *
         * @param {string} target - UID
         * @param {string} host - New host.
         */
        this.chghost = function(uid, host) {
            self.send('CHGHOST ' + uid + ' :' + host);
        };
        /**
         * Identifies a user with services.
         *
         * @param {string} nick - Nick of the user to identify.
         * @param {string=} account - Account of the user. If not given, user will be logged out.
         */
        this.identify = function(nick, account) {
            self.send('ENCAP * SU ' + nick + ' ' + (account || ''));
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
        self.log('mkserv(): created ' + name + ' with sid ' + options.sid + id + ' [' + ident + '@' + host + '] (' + (gecos || name) + ')');
        self.objs.push(new this.IRCObj(options.sid + id, name, (Date.now() / 100).toFixed(0), ['S', 'i', 'o'], host, ident, (gecos || name), true));
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
        line.name = self.objs.findByAttr('id', line.id);
        console.log('>> ' + console.colors.red[0] + ':' + line.id + console.colors.blue[0] + ' (' + line.name + ') ' + console.colors.blue[1] + console.colors.green[0] + line.command + console.colors.yellow[0] + ' ' + line.args.join(' ') + console.colors.yellow[1]);
        
        if (line.command === 'PASS' && line.id === 'none') {
            self.theirid = line.args[3];
        }
        if (self.burst) {
        if (line.command === 'SERVER' && line.id === self.theirid) {
            self.objs.push(new self.IRCObj(line.id, line.args[0], false, false, false, line.args[0]));
            self.log('burst: I am connected to server ' + line.args[0] + ' with id ' + line.id);
        }
        if (line.command === 'SID') {
            self.objs.push(new self.IRCObj(line.args[2], line.args[0], false, false, false, false, line.args[3]));
            self.log('burst: added remote server ' + line.args[0] + ' with id ' + line.args[2] + ' (' + line.args[3] + ')');
        }
        if (line.command === 'EUID') {
            self.objs.push(new self.IRCObj(line.args[7], line.args[0], line.args[2], line.args[3].replace('+', '').split(''), line.args[5], line.args[4], line.args[10]));
            self.log('burst: added user ' + line.args[0] + ' (' + line.args[3] + ') [' + line.args[4] + '@' + line.args[5] + '] with id ' + line.args[7] + ' (' + line.args[10] + ')');
        }
        if (line.command === 'SJOIN') {
            self.objs.push(new self.IRCObj(line.args[1], line.args[1], line.args[0], line.args[2].replace('+', '').split('')));
            self.log('burst: added channel ' + line.args[1] + ' with modes ' + line.args[2]);
        }
        if (line.command === 'PING' && (line.args[1] === options.sid || !line.args[1])) {
            if (!line.args[1]) {
                self.send('PONG ' + line.args[0]);
            }
            else {
                self.send('PONG ' + line.args[0] + ' :' + line.args[1]);
            }
            self.log('burst: end of burst, took ' + (new Date().getTime() - self.burstStart) + 'ms');
            self.burst = false;
        }
        return;
        }
        if (line.command === 'PING' && (line.args[1] === options.sid || !line.args[1])) {
            if (!line.args[1]) {
                self.send('PONG ' + line.args[0]);
            }
            else {
                self.send('PONG ' + line.args[0] + ' :' + line.args[1]);
            }
        }
        if (line.command === 'EUID') {
            self.log('euid: added user ' + line.args[0] + ' (' + line.args[3] + ') [' + line.args[4] + '@' + line.args[5] + '] with id ' + line.args[7] + ' (' + line.args[10] + ')');
            self.objs.push(new self.IRCObj(line.args[7], line.args[0], line.args[2], line.args[3].replace('+', '').split(''), line.args[7], line.args[4], line.args[10]));
        }
        if (line.command === 'PRIVMSG') {
            /**
             * PRIVMSG event. Emitted when the server recieves information about a private message.
             *
             * @event privmsg
             * @memberof SoonTS6.Server
             * @param {object} from - The IRCObj that said the message.
             * @param {object} target - The IRCObj that the message was said to.
             * @param {string} message - The message!
             */
            var from = self.objs.findByAttr('id', line.id);
            var target = line.args[0];
            if (target[0] != '#') {
                target = self.objs.findByAttr('id', target);
            }
            else {
                target = self.objs.findByAttr('name', target);
            }
            self.emit('privmsg', from, target, line.args[1]);
        }
        if (line.command === 'KILL') {
            /**
             * KILL event. Emitted when a service or user is /KILL'd.
             *
             * @event kill
             * @memberof SoonTS6.Server
             * @param {object} from - The IRCObj that sent the kill.
             * @param {object} victim - The IRCObj that was killed.
             */
            var from = self.objs.findByAttr('id', line.id);
            var to = self.objs.findByAttr('id', line.args[0]);
            if (to.isService) {
                self.log('KILL: Service ' + to.name + ' (' + to.id + ') was killed by ' + from.name + ' (' + from.id + ')!');
            }
            self.emit('kill', from, to);
            delete self.objs[self.objs.indexOf(to)];
        }

        return;
    });
    this.send('PASS ' + options.pass + ' TS 6 :' + options.sid);
    this.send('CAPAB :ENCAP SERVICES EUID RSFNC EX IE QS'); // TODO: KLN UNKLN EOPMOD EX IE QS
    this.send('SERVER ' + options.sname + ' 1 :' + options.sname);
};
require('util').inherits(SoonTS6.Server, EventEmitter);
module.exports = SoonTS6;

