const execSync = require("child_process").execSync;
const fs = require('fs');
const bodyparser = require('body-parser');

const procevt = require('./procevt');
const Bot = require('./bot');
const passwd = require('./passwd');
const BotManager = require('./botmanager');

const manager = new BotManager();

procevt.start();

procevt.on('init', () => {
	console.log('procevt init done!');
});

module.exports = function(app) {

	app.get('/list', function(req, res) {
		var result = {};
		result.quota = manager.quota;
		result.count = manager.bots.length;
		result.bots = {};
		for (var i of manager.bots) {
			result.bots[i.name] = {
				user: i.user
			};
		}
		res.send(result);
	});

	app.get('/state', function(req, res) {
		var result = { bots: {} };
		for (var i of manager.bots) {
			result.bots[i.name] = {
				state: i.state,
				started: i.gameStarted,
				pid: i.game
			};
		}
		res.send(result);
	});

	app.get('/bot/:bot/restart', function(req, res) {
		var bot = manager.bot(req.params.bot);
		if (bot) {
			bot.restartGame();
			res.status(200).end();
		} else {
			res.status(400).send({
				'error': 'Bot does not exist'
			})
		}
	});

	app.get('/quota/:quota', function(req, res) {
		manager.setQuota(req.params.quota);
		res.send({
			quota: manager.quota
		});
	});

};
