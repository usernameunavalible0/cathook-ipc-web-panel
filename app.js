const CathookConsole = require('./cathook');
const express = require('express');
const bodyparser = require('body-parser');
const path = require('path');
const forever = require('./forever/app');
const fs = require('fs');

const PORT = 8081;

const app = express();

(function() {
    var childProcess = require("child_process");
    var oldSpawn = childProcess.spawn;
    function mySpawn() {
        console.log('spawn called');
        console.log(arguments);
        var result = oldSpawn.apply(this, arguments);
        return result;
    }
    childProcess.spawn = mySpawn;
})();

const session = require('express-session');

app.use(session({
    secret: require('randomstring').generate(16),
    resave: false,
    saveUninitialized: false
}))

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

const SimpleAuth = require('./auth');
const basicAuth = new SimpleAuth(app);
console.log('Login with password', basicAuth.password);
fs.writeFileSync('/tmp/cat-webpanel-password', basicAuth.password);

const cc = new CathookConsole();

(require('./forever/app'))(app, cc);

cc.once('init', () => {
    cc.command('connect');
});
cc.on('exit', () => {});

app.post('/api/direct/:command', function(req, res) {
    cc.command(req.params.command, req.body, function(data) {
        res.send(data);
    });
});

app.listen(PORT, function() {
	console.log("Listening on port", PORT);
});
