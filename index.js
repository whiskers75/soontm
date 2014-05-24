var net = require('net');
var readline = require('readline');
var tls = require('tls');
var EventEmitter = require('events').EventEmitter;
var Soon = {action: function(text) {return '\x01ACTION ' + text + '\x01';}, ctcp: function(type, text) {return '\x01' + type + ' ' + text + '\x01';}};
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
        tls: options.tls || false
    };
    if (options.tls) {
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
    this.rl = readline.createInterface({
        input: this.sock,
        output: this.sock
    });
    this.connected = false;
    this.accounts = {}; // new feature: live account tracking!
    var self = this;
    this.send = function send(line) {
        line = line.replace(/\r?\n|\r/g, '');
        console.log('>>> ' + line);
        self.sock.write(line + '\r\n');
    };
    this.privmsg = function (target, message) {
        message = message.replace(/\r?\n|\r/g, '\n');
        message.split('\n').forEach(function(bit) {
        self.send('PRIVMSG ' + target + ' :' + bit);
        });
    };
    this.notice = function(target, message) {
        self.send('NOTICE ' + target + ' :' + message);
    };
    this.join = function(target) {
        self.send('JOIN ' + target);
    };
    this.part = function(target, message) {
        if (!message) message = "lazy coder has no part message";
        self.send('PART ' + target + ' :' + message);
    };
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
        console.log('<<< ' + line.command + ' from ' + line.from + ': ' + line.message + ' (args: ' + line.args.join(', ') + ')');
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
        if (line.command == 'PRIVMSG' && line.nick) self.emit('privmsg', line.nick, line.args[0], line.message, line);
        if (line.command == 'NOTICE' && line.nick) self.emit('notice', line.nick, line.args[0], line.message, line);
        if (line.command == 'JOIN' && line.nick) {
            if (line.args[1]) {
            if (line.args[1] === '*') return delete self.accounts[line.nick];
            self.accounts[line.nick] = line.args[1];
            }
            if (line.nick == options.nick) {
                self.send('WHO ' + line.args[0] + ' %na');
            }
            self.emit('join', line.nick, line.args[0], line.args[1]);
        }
        if (line.command == 'PART' && line.nick) self.emit('part', line.nick, line.args[0]);
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
