/*jslint node: true*/
"use strict";
function repeatString(string, times) {
    var result, i;

    result = '';

    for (i = 0; i < times; i++) {
        result += string;
    }

    return result;
}

function zeroPad(number, width) {
    return repeatString('0', width - number.toString().length) + number;
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
 * @param {string=} options.sdesc - Server description
 * @param {string=} options.logchannel - Logging channel
 * @param {string=} options.debug - Whether to log protocol debug messages.
 */
SoonTS6.Server = function (options) {
    options = {
        host: options.host,
        port: options.port,
        sid: options.sid || '50X',
        pass: options.pass || 'pls',
        sname: options.sname,
        sdesc: options.sdesc || 'soontm/ts6 services',
        debug: options.debug || true
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
     * @param {object} data - Data about the IRCObj.
     * @param {string} data.id - UID or SID of the object.
     * @param {string} data.name - The object's human-readable name.
     * @param {number=} data.ts - The object's timestamp.
     * @param {array=} data.modes - The object's modes (for a user).
     * @param {string=} data.host - The object's hostname.
     * @param {string=} data.ident - The object's ident or user portion.
     * @param {string=} data.desc - The server description or gecos.
     * @param {boolean} data.isService - If the IRCObj is a service.
     * @param {object} data.metadata - Any further metadata about the IRCObj.
     */
    this.IRCObj = function(data) {

        /**
         * UID or SID of the object.
         */
        this.id = String(data.id) || '99XAAAAAA';
        /**
         * The object's human-readable name.
         */
        this.name = String(data.name) || 'wat';
        /**
         * The object's timestamp.
         */
        this.ts = Number(data.ts) || 0;
        /**
         * The object's modes.
         */
        this.modes = data.modes || [];
        /**
         * The object's ident or user portion.
         */
        this.ident = String(data.ident) || '';
        /**
         * The object's hostname.
         */
        this.host = String(data.host) || '';
        /**
         * The object's description or gecos.
         */
        this.desc = String(data.desc) || '';
        /**
         * If the object is a service.
         */
        this.isService = data.isService || false;
        /**
         * Any further metadata about the IRCObj.
         */
        this.metadata = data.metadata || {};
        /**
         * The object's real host/IP.
         */
        this.realhost = String(data.realhost) || '';
        this.realip = String(data.realip) || '';
        this.toString = function() {return data.name;};
        /**
         * (if service) Does the same as Server.send() but with the service's ID.
         */
        this.send = function(m) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            self.send(m, this.id);
        };
        /**
         * (if service) Joins a channel.
         *
         * @param {string} channel - channel to join
         */
        this.join = function(chan) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            var chan = self.objs.findByAttr('name', chan);
            self.send('SJOIN ' + Number(Number((Date.now() / 100).toFixed(0)) + 5) + ' ' + chan + ' +' + chan.modes.join('') + ' :@' + this.id);
        };
        /**
         * (if service) Leaves a channel.
         *
         * @param {string} channel - channel to leave
         */
        this.part = function(chan) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            this.send('PART ' + chan);
        };
        /**
         * (if service) Sends a message.
         *
         * @param {string} target - Target to send the message to (channel or UID)
         * @param {string} message - Message to send.
         */
        this.privmsg = function(to, msg) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            this.send('PRIVMSG ' + to + ' :' + msg);
        };
        /**
         * (if service) Sends a notice.
         *
         * @param {string} target - Target to send the notice to (channel or UID)
         * @param {string} message - Notice to send.
         */
        this.notice = function(to, msg) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            this.send('NOTICE ' + to + ' :' + msg);
        };
        /**
         * (if service) /kills a user.
         *
         * @param {string} target - UID of person to kill.
         * @param {string=} message - Optional kill message.
         */
        this.kill = function(uid, message) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            this.send('KILL ' + uid + ' :' + this.id + ' (' + (message || '<No reason given>') + ')');
        };
        /**
         * (if service) changes the host of a user
         *
         * @param {string} target - UID
         * @param {string} host - New host.
         */
        this.chghost = function(uid, host) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            self.send('CHGHOST ' + uid + ' :' + host);
            var o = self.objs.findByAttr('id', uid);
            if (o.realhost === '*') o.realhost = o.host;
            var oldhost = o.host;
            o.host = host;
            self.log('CHGHOST IRCObj ' + o.name + ' (' + o.id + '): Host changed to ' + o.host);
            /**
             * chghost event. Emitted when a host is changed.
             *
             * @event chghost
             * @memberof SoonTS6.Server
             * @param {object} obj - The IRCObj that changed the host.
             * @param {string} oldhost - The old host.
             * @param {string} newhost - The new host.
             */
            self.emit('chghost', o, oldhost, host);
        };
        /**
         * (if service) Identifies a user with services.
         *
         * @param {string} nick - Nick of the user to identify.
         * @param {string=} account - Account of the user. If not given, user will be logged out.
         */
        this.identify = function(nick, account) {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            self.send('ENCAP * SU ' + nick + ' ' + (account || ''));
        };
        /**
         * (if service) Recreates the service (useful if the old service got killed).
         */
        this.recreate = function() {
            if (!this.isService) throw new Error('Called service function on non-service IRCObj');
            return self.mkserv(this.name, this.ident, this.host, this.description);
        };
        /**
         * Forcibly changes the nick of an user.
         *
         * @param {string} nick - The current nick.
         * @param {string} newnick - The new nick.
         */
        this.rsfnc = function(nick, newnick) {
            var targetobj = self.objs.findByAttr('name', nick);
            var uid = targetobj.id;
            var server = self.objs.findByAttr('id', uid.substring(0,3)).name;
            var ts = targetobj.ts;
            var oldts = (Date.now() / 100).toFixed(0) - 60;
            self.log('RSFNC: IRCObj ' + nick + ' (' + uid + ') -> ' + newnick);
            self.send('ENCAP ' + server + ' RSFNC ' + nick + ' ' + newnick + ' ' + oldts + ' ' + ts);
        };
    };
    require('util').inherits(this.IRCObj, EventEmitter);
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
        var o;
        self.objs.forEach(function(obj) {
            if (obj[attr] == val) {
                    o = obj;
            }
        });
        return o;
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
        self.send('ENCAP * SNOTE d :' + msg);
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
     * Register a new service.
     *
     * @param {string} name - nickname of new service
     * @param {string} ident - ident string of new service
     * @param {string} host - host of new service
     * @param {string=} gecos - realname of new service
     * @since 0.0.1
     */
    this.mkserv = function(name, ident, host, gecos) {
        if (self.objs.findByAttr('name', name) && self.objs.findByAttr('name', name).id.substring(0,3) === options.sid) return self.objs.findByAttr('name', name);
        self.curid++;
        var id = zeroPad(Number(self.curid), 6);
        self.log('mkserv(): created ' + name + ' with sid ' + options.sid + id + ' [' + ident + '@' + host + '] (' + (gecos || name) + ')');
        var o = new this.IRCObj({
            id: options.sid + id,
            name: name,
            ts: (Date.now() / 100).toFixed(0),
            modes: ['S', 'i', 'o'],
            host: host,
            ident: ident,
            desc: (gecos || name),
            isService: true,
            realip: 0,
            realhost: '*'
        });
        self.objs.push(o);
        self.send('EUID ' + name + ' 1 ' + o.ts + ' +' + o.modes.join('') + ' ' + ident + ' ' + host + ' 0 ' + options.sid + id + ' * * :' + (gecos || name));
        return o;
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
            self.objs.push(new self.IRCObj({
                id: line.id,
                name: line.args[0],
                desc: line.args[2]
            }));
            self.log('burst: I am connected to server ' + line.args[0] + ' with id ' + line.id);
        }
        if (line.command === 'SID') {
            self.objs.push(new self.IRCObj({
                id: line.args[2],
                name: line.args[0],
                desc: line.args[3]
            }));
            self.log('burst: added remote server ' + line.args[0] + ' with id ' + line.args[2] + ' (' + line.args[3] + ')');
        }
        if (line.command === 'EUID') {
            self.objs.push(new self.IRCObj({
                id: line.args[7],
                name: line.args[0],
                ts: line.args[2],
                modes: line.args[3].replace('+', '').split(''),
                host: line.args[5],
                ident: line.args[4],
                desc: line.args[10],
                realip: line.args[6],
                realhost: line.args[8]
            }));
            self.log('burst: added user ' + line.args[0] + ' (' + line.args[3] + ') [' + line.args[4] + '@' + line.args[5] + '] with id ' + line.args[7] + ' (' + line.args[10] + ')');
            /**
             * newclient - emitted when a client connects or a client is added on burst.
             *
             * @memberof SoonTS6.Server
             * @event newclient
             * @param {string} id - ID of the new IRCObj.
             */
            self.emit('newclient', line.args[7]);
        }
        if (line.command === 'SJOIN') {
            if (self.objs.findByAttr('name', line.args[1])) return;
            self.objs.push(new self.IRCObj({
                id: line.args[1],
                name: line.args[1],
                ts: line.args[0],
                modes: line.args[2].replace('+', '').split('')
            }));
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
            /**
             * EOB - emitted when burst ends.
             *
             * @memberof SoonTS6.Server
             * @event eob
             */
            self.emit('eob');
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
        if (line.command === 'SID') {
            self.objs.push(new self.IRCObj({
                id: line.args[2],
                name: line.args[0],
                desc: line.args[3]
            }));
            self.log('sid: added server ' + line.args[0] + ' with id ' + line.args[2] + ' (' + line.args[3] + ')');
        }
        if (line.command === 'EUID') {

            if (self.objs.findByAttr('id', line.args[7])) {
                self.log('euid: updated user ' + line.args[0] + ' (' + line.args[3] + ') [' + line.args[4] + '@' + line.args[5] + '] with id ' + line.args[7] + ' (' + line.args[10] + ')');
                var o = self.objs.findByAttr('id', line.args[7]);
                o.id= line.args[7];
                o.name = line.args[0];
                o.ts = line.args[2];
                o.modes = line.args[3].replace('+', '').split('');
                o.host = line.args[5];
                o.ident = line.args[4];
                o.desc = line.args[10];
                o.realip = line.args[6];
                o.realhost = line.args[8];
            }
            else {
                self.log('euid: added user ' + line.args[0] + ' (' + line.args[3] + ') [' + line.args[4] + '@' + line.args[5] + '] with id ' + line.args[7] + ' (' + line.args[10] + ')');
            self.objs.push(new self.IRCObj({
                id: line.args[7],
                name: line.args[0],
                ts: line.args[2],
                modes: line.args[3].replace('+', '').split(''),
                host: line.args[5],
                ident: line.args[4],
                desc: line.args[10],
                realip: line.args[6],
                realhost: line.args[8]
            }));
            }
            /**
             * newclient - emitted when a client connects or a client is added on burst.
             *
             * @memberof SoonTS6.Server
             * @event newclient
             * @param {string} id - ID of the new IRCObj.
             */
            self.emit('newclient', line.args[7]);
        }
        if (line.command === 'SJOIN') {
            if (self.objs.findByAttr('name', line.args[1])) return;
            self.objs.push(new self.IRCObj({
                id: line.args[1],
                name: line.args[1],
                ts: line.args[0],
                modes: line.args[2].replace('+', '').split('')
            }));
            self.log('sjoin: added channel ' + line.args[1] + ' with modes ' + line.args[2]);
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
            if (target[0] === '$') return; // TODO: make this part IRCd-specific
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
                to.recreate();
            }
            self.emit('kill', from, to);
            self.log('KILL: Deleting IRCObj ' + to.id + ' (killed)');
            delete self.objs[self.objs.indexOf(to)];

        }
        if (line.command === 'QUIT') {
            /**
             * QUIT event. Emitted when a service or user disconnects.
             *
             * @event quit
             * @memberof SoonTS6.Server
             * @param {object} died - The IRCObj that quit.
             */
            var from = self.objs.findByAttr('id', line.id);
            self.log('QUIT: Deleting IRCObj ' + line.id);
            self.emit('quit', from);
            delete self.objs[self.objs.indexOf(from)];
        }
        if (line.command === 'WHOIS') {
            var from = line.id;
            var target = line.args[1];
            var targetobj = self.objs.findByAttr('name', target);
            if (!targetobj || targetobj.id.length === 3) {
                self.send('401 ' + from + ' ' + target + ' :No such nick/channel');
                self.send('318 ' + from + ' ' + target + ' :End of WHOIS');
                return;
            }
            var sid = targetobj.id.substring(0,3);
            var servobj = self.objs.findByAttr('id', sid);
            if (!servobj) return self.log('I have suffered a terrible failure. (Couldn\'t get server name for user ' + targetobj.name + '; Tried to search for server: ' + sid + ')');
            self.send('311 ' + from + ' ' + targetobj.name + ' ' + targetobj.ident + ' ' + targetobj.host + ' * :' + targetobj.desc);
            self.send('312 ' + from + ' ' + targetobj.name + ' ' + servobj.name + ' :' + servobj.desc);
            if (targetobj.modes.indexOf('S') !== -1) self.send('313 ' + from + ' ' + targetobj.name + ' ' + ':is a Network Service');
            if (targetobj.modes.indexOf('o') !== -1 && targetobj.modes.indexOf('S') === -1 && targetobj.modes.indexOf('a') === -1) self.send('313 ' + from + ' ' + targetobj.name + ' ' + ':is an IRC Operator');
            if (targetobj.modes.indexOf('a') !== -1 && targetobj.modes.indexOf('S') === -1) self.send('313 ' + from + ' ' + targetobj.name + ' ' + ':is a Server Administrator');
            self.send('318 ' + from + ' ' + targetobj.name + ' ' + ':End of WHOIS');
        }
        if (line.command === 'NICK') {
            var from = self.objs.findByAttr('id', line.id);
            var oldnick = from.name;
            var newnick = line.args[0];
            from.name = line.args[0];
            /**
             * NICK event. Emitted when a user changes their nickname.
             *
             * @event nick
             * @memberof SoonTS6.Server
             * @param {object} obj - The IRCObj that changed nick.
             * @param {string} oldnick - The old nick.
             * @param {string} newnick - The new nick.
             */
            self.emit('nick', from, oldnick, newnick);
            self.log('NICK: IRCObj ' + oldnick + ' (' + line.id + ') -> ' + newnick);
        }
        if (line.command === 'CHGHOST') {
            var id = line.args[0];
            var o = self.objs.findByAttr('id', id);
            if (o.realhost === '*') o.realhost = o.host;
            var oldhost = o.host;
            o.host = line.args[1];
            self.log('CHGHOST IRCObj ' + o.name + ' (' + o.id + '): Host changed to ' + o.host);
            /**
             * chghost event. Emitted when a host is changed.
             *
             * @event chghost
             * @memberof SoonTS6.Server
             * @param {object} obj - The IRCObj that changed the host.
             * @param {string} oldhost - The old host.
             * @param {string} newhost - The new host.
             */
            self.emit('chghost', o, oldhost, line.args[1]);
        }
        if (line.command === 'MOTD') {
            var from = self.objs.findByAttr('id', line.id);
            var target = self.objs.findByAttr('id', line.args[0]);
            /**
             * motd event. Emitted when receiving a MOTD command.
             *
             * @event motd
             * @memberof SoonTS6.Server
             * @param {object} obj - The IRCObj that sent the MOTD command.
             * @param {object} target - The server which is queried for the MOTD.
             */
            self.emit('motd', from, target);
        }
        return;
    });
    this.send('PASS ' + options.pass + ' TS 6 :' + options.sid);
    this.send('CAPAB :ENCAP SERVICES EUID RSFNC EX IE QS'); // TODO: KLN UNKLN EOPMOD EX IE QS
    this.send('SERVER ' + options.sname + ' 1 :' + options.sdesc);
    self.objs.push(new self.IRCObj({
        id: options.sid,
        name: options.sname,
        desc: options.sdesc
    }));
};
SoonTS6.toLowerCase = function (string) {
    return string.toLowerCase().replace(/\[/g, '{')
                               .replace(/\]/g, '}')
                               .replace(/\\/g, '|')
                               .replace(/~/g, '^');
};
require('util').inherits(SoonTS6.Server, EventEmitter);
module.exports = SoonTS6;

