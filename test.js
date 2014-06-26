var Soon = require('./index.js');
var client = new Soon.Client({});
client.send = function() {};
it('should emit registered on 001', function(done) {
    client.once('registered', done);
    client.rl.emit('line', ':test.net 001 testing :Testing\r\n');
});
it('should parse lines correctly', function(done) {
    client.raw.once('TESTCMD', function(line) {
        if (line.prefix != 'testing!~test@testing/test') return done(new Error('failed to parse prefix'));
        if (line.command != 'TESTCMD') return done(new Error('failed to parse command'));
        if (line.args[0] != 'testarg') return done(new Error('failed to parse first argument'));
        if (line.args[1] != 'test message') return done(new Error('failed to parse or join second argument'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test TESTCMD testarg :test message');
});
it('should PONG when recieving a PING', function(done) {
    client.send = function(msg) {
        if (msg != 'PONG test.net :test cats') return done(new Error('failed to reply exactly (got ' + msg + ')'));
        done();
        client.send = function() {};
    };
    client.rl.emit('line', 'PING test.net :test cats');
});
it('should emit join when recieving a JOIN', function(done) {
    client.once('join', function(nick, channel) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test JOIN #testchan');
});
it('should emit an extended version of join when recieving a JOIN with extended-join enabled', function(done) {
    client.once('join', function(nick, channel, account, gecos) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        if (account != 'testacct') return done(new Error('failed to parse account'));
        if (gecos != 'testgecos') return done(new Error('failed to parse gecos'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test JOIN #testchan testacct :testgecos');
});
it('should emit part when recieving a PART', function(done) {
    client.once('part', function(nick, channel, message) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        if (message != 'bai bai') return done(new Error('failed to parse message'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test PART #testchan :bai bai');
});
it('should emit quit when recieving a QUIT', function(done) {
    client.once('quit', function(nick, message) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (message != 'Client Quit') return done(new Error('failed to parse message'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test QUIT :Client Quit');
});
it('should emit privmsg when recieving a PRIVMSG', function(done) {
    client.once('privmsg', function(nick, channel, message) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        if (message != 'testing is great!') return done(new Error('failed to parse message'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test PRIVMSG #testchan :testing is great!');
});
it('should emit privmsg and add line.ctcp when recieving a PRIVMSG for CTCP', function(done) {
    client.once('privmsg', function(nick, channel, message, line) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        if (line.ctcp.join(' ') != 'PLS to not') return done(new Error('failed to parse CTCP'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test PRIVMSG #testchan :\x01PLS to not\x01');
});
it('should emit notice when recieving a NOTICE', function(done) {
    client.once('notice', function(nick, channel, message) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        if (message != 'testing is great!') return done(new Error('failed to parse message'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test NOTICE #testchan :testing is great!');
});
it('should emit notice and add line.ctcp when recieving a NOTICE for CTCP', function(done) {
    client.once('notice', function(nick, channel, message, line) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        if (line.ctcp.join(' ') != 'PLS to not pls') return done(new Error('failed to parse CTCP'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test NOTICE #testchan :\x01PLS to not pls\x01');
});
it('should emit invite when recieving an INVITE', function(done) {
    client.once('invite', function(nick, channel) {
        if (nick != 'testing') return done(new Error('failed to parse nick'));
        if (channel != '#testchan') return done(new Error('failed to parse channel'));
        done();
    });
    client.rl.emit('line', ':testing!~test@testing/test INVITE kitten :#testchan');
});
it('should send the correct message on .join()', function(done) {
    client.send = function(msg) {
        if (msg != 'JOIN #testchan') return done(new Error('failed to send correctly (got ' + msg + ')'));
        done();
        client.send = function() {};
    };
    client.join('#testchan');
});
it('should send the correct message on .part()', function(done) {
    client.send = function(msg) {
        if (msg != 'PART #testchan :bai bai') return done(new Error('failed to send correctly (got ' + msg + ')'));
        done();
        client.send = function() {};
    };
    client.part('#testchan', 'bai bai');
});
it('should send the correct message on .privmsg()', function(done) {
    client.send = function(msg) {
        if (msg != 'PRIVMSG #testchan :hello world') return done(new Error('failed to send correctly (got ' + msg + ')'));
        done();
        client.send = function() {};
    };
    client.privmsg('#testchan', 'hello world');
});
it('should send the correct message on .notice()', function(done) {
    client.send = function(msg) {
        if (msg != 'NOTICE #testchan :hello world') return done(new Error('failed to send correctly (got ' + msg + ')'));
        done();
        client.send = function() {};
    };
    client.notice('#testchan', 'hello world');
});
it('should send the correct message on .quit()', function(done) {
    client.send = function(msg) {
        if (msg != 'QUIT :goodbye world') return done(new Error('failed to send correctly (got ' + msg + ')'));
        done();
        client.send = function() {};
    };
    client.quit('goodbye world');
});
