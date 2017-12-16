const execSync = require("child_process").execSync;
const fs = require('fs');
const bodyparser = require('body-parser');

const procevt = require('./procevt');
const Bot = require('./bot');
const passwd = require('./passwd');
const BotManager = require('./botmanager');

var manager = null;

module.exports = function(app, cc) {

	procevt.start();

	if (process.getuid() != 0) {
		console.log('[FATAL] Bot manager needs superuser privileges, please restart as root');
		process.exit(1);
	}
	if (manager) {
		console.log('[FATAL] Initialized function for bot manager called twice');
		process.exit(1);
	} else {
		 manager = new BotManager(cc);
	}

	this.manager = manager;

	app.get('/api/list', function(req, res) {
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

	app.get('/api/state', function(req, res) {
		var result = { bots: {} };
		for (var i of manager.bots) {
			result.bots[i.name] = {
				ipc: i.ipcState,
				ipcID: i.ipcID,
				state: i.state,
				started: i.gameStarted,
				pid: i.game
			};
		}
		res.send(result);
	});

	app.get('/api/bot/:bot/restart', function(req, res) {
		var bot = manager.bot(req.params.bot);
		if (bot) {
			bot.restart();
			res.status(200).end();
		} else {
			res.status(400).send({
				'error': 'Bot does not exist'
			})
		}
	});

	app.get('/api/quota/:quota', function(req, res) {
		manager.setQuota(req.params.quota);
		res.send({
			quota: manager.quota
		});
	});

};
