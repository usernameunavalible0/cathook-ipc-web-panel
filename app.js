const CathookConsole = require('./cathook');
const express = require('express');
const bodyparser = require('body-parser');
const path = require('path');

const PORT = 8081;

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

const cc = new CathookConsole();

cc.once('init', () => {
    cc.command('connect');
});
cc.on('exit', () => {});

app.post('/direct/:command', function(req, res) {
    cc.command(req.params.command, req.body, function(data) {
        res.send(data);
    });
});

app.listen(PORT, function() {
	console.log("Listening on port", PORT);
});
