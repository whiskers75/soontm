/*jslint node: true, devel: true*/
/*global it*/
'use strict';
var soontm = require('./index');
var client = new soontm.Client({host: 'test.net', port: 6667, nick: 'testing', sasl: true, user: 'testing', password: 'testing', sloppy: true, enableNames: true});
client.send = function () { return; };
client.rl.emit('line', ':test.net CAP * LS :account-notify away-notify extended-join multi-prefix sasl tls');
client.rl.emit('line', ':test.net CAP * ACK :account-notify away-notify extended-join multi-prefix sasl');
it('should emit registered on 001', function (done) {
    client.once('registered', done);
    client.rl.emit('line', ':test.net 001 testing :Testing\r\n');
});
it('should parse lines correctly', function (done) {
    client.raw.once('TESTCMD', function (line) {
        if (line.prefix !== 'testing!~test@testing/test') { return done(new Error('failed to parse prefix')); }
        if (line.command !== 'TESTCMD') { return done(new Error('failed to parse command')); }
        if (line.args[0] !== 'testarg') { return done(new Error('failed to parse first argument')); }
        if (line.args[1] !== 'test message') { return done(new Error('failed to parse or join second argument')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test TESTCMD testarg :test message');
});
it('should PONG when recieving a PING', function (done) {
    client.send = function (msg) {
        if (msg !== 'PONG test.net :test cats') { return done(new Error('failed to reply exactly (got ' + msg + ')')); }
        done();
        client.send = function () { return; };
    };
    client.rl.emit('line', 'PING test.net :test cats');
});
it('should emit join when recieving a JOIN', function (done) {
    client.once('join', function (nick, channel) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test JOIN #testchan');
});
it('should emit an extended version of join when recieving a JOIN with extended-join enabled', function (done) {
    client.once('join', function (nick, channel, account, gecos) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (account !== 'testacct') { return done(new Error('failed to parse account')); }
        if (gecos !== 'testgecos') { return done(new Error('failed to parse gecos')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test JOIN #testchan testacct :testgecos');
});
it('should emit part when recieving a PART', function (done) {
    client.once('part', function (nick, channel, message) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (message !== 'bai bai') { return done(new Error('failed to parse message')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test PART #testchan :bai bai');
});
it('should emit quit when recieving a QUIT', function (done) {
    client.once('quit', function (nick, message) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (message !== 'Client Quit') { return done(new Error('failed to parse message')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test QUIT :Client Quit');
});
it('should emit privmsg when recieving a PRIVMSG', function (done) {
    client.once('privmsg', function (nick, channel, message) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (message !== 'testing is great!') { return done(new Error('failed to parse message')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test PRIVMSG #testchan :testing is great!');
});
it('should emit privmsg and add line.ctcp when recieving a PRIVMSG for CTCP', function (done) {
    client.once('privmsg', function (nick, channel, message, line) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (line.ctcp.join(' ') !== 'PLS to not') { return done(new Error('failed to parse CTCP')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test PRIVMSG #testchan :\x01PLS to not\x01');
});
it('should emit notice when recieving a NOTICE', function (done) {
    client.once('notice', function (nick, channel, message) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (message !== 'testing is great!') { return done(new Error('failed to parse message')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test NOTICE #testchan :testing is great!');
});
it('should emit notice and add line.ctcp when recieving a NOTICE for CTCP', function (done) {
    client.once('notice', function (nick, channel, message, line) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (line.ctcp.join(' ') !== 'PLS to not pls') { return done(new Error('failed to parse CTCP')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test NOTICE #testchan :\x01PLS to not pls\x01');
});
it('should emit invite when recieving an INVITE', function (done) {
    client.once('invite', function (nick, channel) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test INVITE kitten :#testchan');
});
it('should send the correct message on .join()', function (done) {
    client.send = function (msg) {
        if (msg !== 'JOIN #testchan') { return done(new Error('failed to send correctly (got ' + msg + ')')); }
        done();
        client.send = function () { return; };
    };
    client.join('#testchan');
});
it('should send the correct message on .part()', function (done) {
    client.send = function (msg) {
        if (msg !== 'PART #testchan :bai bai') { return done(new Error('failed to send correctly (got ' + msg + ')')); }
        done();
        client.send = function () { return; };
    };
    client.part('#testchan', 'bai bai');
});
it('should send the correct message on .privmsg()', function (done) {
    client.send = function (msg) {
        if (msg !== 'PRIVMSG #testchan :hello world') { return done(new Error('failed to send correctly (got ' + msg + ')')); }
        done();
        client.send = function () { return; };
    };
    client.privmsg('#testchan', 'hello world');
});
it('should send the correct message on .notice()', function (done) {
    client.send = function (msg) {
        if (msg !== 'NOTICE #testchan :hello world') { return done(new Error('failed to send correctly (got ' + msg + ')')); }
        done();
        client.send = function () { return; };
    };
    client.notice('#testchan', 'hello world');
});
it('should send the correct message on .quit()', function (done) {
    client.send = function (msg) {
        if (msg !== 'QUIT :goodbye world') { return done(new Error('failed to send correctly (got ' + msg + ')')); }
        done();
        client.send = function () { return; };
    };
    client.quit('goodbye world');
});
it('should emit wallops when receiving a WALLOPS', function (done) {
    client.once('wallops', function (nick, message) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (message !== 'Test /wallops') { return done(new Error('failed to parse message')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test WALLOPS :Test /wallops');
});
it('should emit rpl_mononline on 730', function (done) {
    client.once('rpl_mononline', function (nick, username, host) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (username !== '~test') { return done(new Error('failed to parse username')); }
        if (host !== 'testing/test') { return done(new Error('failed to parse host')); }
        done();
    });
    client.rl.emit('line', ':test.net 730 testing :testing!~test@testing/test');
});
it('should emit rpl_monoffline on 731', function (done) {
    client.once('rpl_monoffline', function (nick) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        done();
    });
    client.rl.emit('line', ':test.net 731 testing :testing');
});
it('should emit topic on TOPIC', function (done) {
    client.once('topic', function (nick, channel, topic) {
        if (nick !== 'testing') { return done(new Error('failed to parse nick')); }
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (topic !== 'test /topic') { return done(new Error('failed to parse topic')); }
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test TOPIC #testchan :test /topic');
});
it('should emit rpl_topic on 332', function (done) {
    client.once('rpl_topic', function (channel, topic) {
        if (channel !== '#testchan') { return done(new Error('failed to parse channel')); }
        if (topic !== 'test /topic') { return done(new Error('failed to parse topic')); }
        done();
    });
    client.rl.emit('line', ':test.net 332 testing #testchan :test /topic');
});
it('should set away status to H when receiving a WHOX reply with the H status', function (done) {
    client.once('privmsg', function (nick, channel, message, line) {
        if (line.status !== 'H') { return done(new Error('failed to set H status')); }
        done();
    });
    client.rl.emit('line', ':test.net 354 testing here H*@ 0');
    client.rl.emit('line', ':here!~test@testing/test PRIVMSG #testchan :testing is great!');
});
it('should set away status to G when receiving a WHOX reply with the G status', function (done) {
    client.once('privmsg', function (nick, channel, message, line) {
        if (line.status !== 'G') { return done(new Error('failed to set G status')); }
        done();
    });
    client.rl.emit('line', ':test.net 354 testing gone G*@ 0');
    client.rl.emit('line', ':gone!~test@testing/test PRIVMSG #testchan :testing is great!');
});
it('should set away status to H when receiving AWAY without arguments', function (done) {
    client.once('privmsg', function (nick, channel, message, line) {
        if (line.status !== 'H') { return done(new Error('failed to set H status')); }
        done();
    });
    client.rl.emit('line', ':here!~test@testing/test AWAY');
    client.rl.emit('line', ':here!~test@testing/test PRIVMSG #testchan :testing is great!');
});
it('should set away status to G when receiving AWAY with message', function (done) {
    client.once('privmsg', function (nick, channel, message, line) {
        if (line.status !== 'G') { return done(new Error('failed to set G status')); }
        done();
    });
    client.rl.emit('line', ':gone!~test@testing/test AWAY :gone');
    client.rl.emit('line', ':gone!~test@testing/test PRIVMSG #testchan :testing is great!');
});
it('should send correct AUTHENTICATE command when receiving \'AUTHENTICATE +\'', function (done) {
    client.send = function (msg) {
        if (msg !== 'AUTHENTICATE dGVzdGluZwB0ZXN0aW5nAHRlc3Rpbmc=') { return done(new Error('failed to reply exactly (got ' + msg + ')')); }
        done();
        client.send = function () { return; };
    };
    client.rl.emit('line', 'AUTHENTICATE +');
});
it('should emit kick event when recieving KICK', function(done) {
    client.once('kick', function (nick, channel, target, message, line) {
        if (nick !== 'pls') { return done(new Error('failed to parse nick')); }
        if (channel !== '#test') { return done(new Error('failed to parse channel')); }
        if (target !== 'tonot') { return done(new Error('failed to parse target')); }
        if (message !== 'pls to not do that') { return done(new Error('failed to parse message')); }
        done();
    });
    client.rl.emit('line', ':pls!~test@testing/test KICK #test tonot :pls to not do that');
});
it('should emit remove event when recieving a PART message as a result of the /remove command', function(done) {
    client.once('remove', function (nick, channel, target, message, line) {
        if (nick !== 'tonot') { return done(new Error('failed to parse nick')); }
        if (channel !== '#test') { return done(new Error('failed to parse channel')); }
        if (target !== 'pls') { return done(new Error('failed to parse target')); }
        done();
    });
    client.rl.emit('line', ':pls!~test@testing/test PART #test :requested by tonot (pls2not)');
});
it('should parse names correctly and emit rpl_endofnames at the end of it', function(done) {
    client.once('rpl_endofnames', function(names, chan, line) {
        if (names.person !== '@') { return done(new Error('failed to parse opped person on first line')); }
        if (names.otherlineguy !== '') { return done(new Error('failed to parse person on second line')); }
        if (chan != '#chan') { return done(new Error('failed to parse chan')); }
        done();
    });
    client.rl.emit('line', ':test.net 353 you * #chan :@person +voicedguy anotherguy');
    client.rl.emit('line', ':test.net 353 you * #chan :otherlineguy');
    client.rl.emit('line', ':test.net 366 you #chan :End of /NAMES list.');
});
