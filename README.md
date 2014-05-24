Soon™
------
*A welcome break from node-irc*

Soon™ is a new IRC client library for node.js, meant to be lightweight and solve the headaches of node-irc.
*Note: Soon is still in development. Use at your own risk.*

### Getting Started

To get started, make a new Soon.Client:

  var Soon = require('soontm');
  var bot = new Soon.Client({host: 'my.irc.host', port: 6697, tls: true, password: 'saslpasswordverysekrit', sasl: true, nick: 'mybot', realname: 'Soon IRC Demo', user: 'mycoolaccount'});
