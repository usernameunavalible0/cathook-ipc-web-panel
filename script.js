const $ = require('jquery');
const format = require('format-duration');
const request = require('browser-request');

const SERVER = 'http://localhost:8081/';

const STATE = 'INITIALIZING INITIALIZED PREPARING STARTING WAITING INJECTING RUNNING RESTARTING'.split(' ');

const classes = [
	"Unknown", "Scout",
	"Sniper", "Soldier",
	"Demoman", "Medic",
	"Heavy", "Pyro",
	"Spy", "Engineer"
];

const teams = [
    "UNK", "SPEC", "RED", "BLU"
]

const status = {
    info: function(text) {
        console.log('[INFO]', text);
        $('#status-text').attr('class', '').text(text);
    },
    warning: function(text) {
        console.log('[WARNING]', text);
        $('#status-text').attr('class', 'warning').text(text);
    },
    error: function(text) {
        console.log('[ERROR]', text);
        $('#status-text').attr('class', 'error').text(text);
    }
}

var last_count = 0;

function updateData() {
	cmd('query', {}, function(error, data) {
		if (error) return;
		for (var i in data.result) {
			updateIPCData(i, data.result[i]);
		}
	});
	request('state', function(error, r, b) {
		if (error) return;
		var data = JSON.parse(b);
		if (last_count != Object.keys(data.bots).length) {
			refreshComplete();
		}
		for (var i in data.bots) {
			updateUserData(i, data.bots[i]);
		}
	});
}

function commandButtonCallback() {
    var cmdz = prompt('Enter a command');
    if (cmdz) {
		cmd('exec', {
			target: parseInt($(this).parent().parent().find('.client-id').text()),
			cmd: cmdz
		}, null)
    }
}

function restartButtonCallback() {
	console.log('restarting',$(this).parent().parent().attr('data-id'));
    request(`bot/${$(this).parent().parent().attr('data-id')}/restart`, function(e, r, b) {
		if (e) {
			console.log(e,b);
			status.error('Error restarting bot');
		} else {
			status.info('Bot restarted');
		}
	});
}

function cmd(command, data, callback) {
	request.post({
		url: SERVER + 'direct/' + command,
		body: JSON.stringify(data),
		headers: {
			"Content-Type": "application/json"
		}
	}, function(e, r, b) {
		if (e) {
			console.log(e);
			status.error('Error making request!');
			if (callback)
				callback(e);
			return;
		}
		try {
			if (callback)
				callback(null, JSON.parse(b));
		} catch (e) {
			console.log(e);
			status.error('Error parsing data from server!');
			if (callback)
				callback(e);
		}
	});
}

var autorestart = {};

function updateIPCData(id, data) {
	var row = $(`tr[data-pid="${data.pid}"]`);
	if (!row.length) return;
	var time = Math.floor(Date.now() / 1000 - data.heartbeat);
	if (time < 2) {
		row.find('.client-status').removeClass('error warning').text('OK ' + time);
	} else if (time < 30) {
		row.find('.client-status').removeClass('error').addClass('warning').text('Warning ' + time);
	} else {
		if ($('#autorestart-bots').prop('checked')) {
			if (data.heartbeat && !autorestart[row.attr('data-id')] || (Date.now() - autorestart[row.attr('data-id')]) > 1000 * 5) {
				autorestart[row.attr('data-id')] = Date.now();
				console.log('auto-restarting' ,row.attr('data-id'));
			    request(`bot/${row.attr('data-id')}/restart`, function(e, r, b) {
					if (e) {
						console.log(e,b);
						status.error('Error restarting bot');
					} else {
						status.info('Bot restarted');
					}
				});
			}
		}
		row.find('.client-status').removeClass('warning').addClass('error').text('Likely dead ' + time);
	}
	//row.find('.client-uptime').text(format(time - data.starttime));
	row.find('.client-pid').text(data.pid);
	row.find('.client-id').text(id);
	row.find('.client-name').text(data.name);
	row.find('.client-total').text(data.total_score);
	if (data.connected) {
		row.toggleClass('disconnected', false);
		row.find('.client-ip').text(data.server);
		row.find('.client-alive').text(data.life_state ? 'Dead' : 'Alive');
		row.find('.client-team').text(teams[data.team]);
		row.find('.client-class').text(classes[data.class]);
		row.find('.client-score').text(data.score);
		row.find('.client-health').text(data.health + '/' + data.health_max);
	} else {
		row.toggleClass('disconnected', true);
		row.find('.connected').text('N/A');
	}
}

function updateUserData(bot, data) {
	var row = $(`tr[data-id="${bot}"]`);
	if (!row.length) return;
	row.toggleClass('stopped', data.state != 6);
	row.find('.client-state').text(STATE[data.state]);
	if (data.state == 6 && data.pid) {
		row.attr('data-pid', data.pid.pid);
		row.find('.client-pid').text(data.pid.pid);
	}
	if (data.state != 6) {
		row.find('.active').text('N/A');
	}
}

function addClientRow(botid, username) {
    var row = $('<tr></tr>').attr('data-id', botid).addClass('disconnected stopped');
	row.append($('<td></td>').attr('class', 'client-bot-name').text(botid));
	row.append($('<td></td>').attr('class', 'client-user').text(username));
	row.append($('<td></td>').attr('class', 'client-state').text("UNDEFINED"));
    row.append($('<td></td>').attr('class', 'client-pid active').text('N/A'));
	row.append($('<td></td>').attr('class', 'client-id active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-status active').text('N/A'));
    //row.append($('<td></td>').attr('class', 'client-uptime').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-name active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-total active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-ip connected active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-alive connected active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-team connected active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-class connected active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-score connected active').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-health connected active').text('N/A'));
    var actions = $('<td></td>').attr('class', 'client-actions');
    actions.append($('<input>').attr('type', 'button').attr('value', 'Command').on('click', commandButtonCallback));
    actions.append($('<input>').attr('type', 'button').attr('value', 'Restart').on('click', restartButtonCallback));
    row.append(actions);
    $('#clients').append(row);
    return row;
}

function runCommand() {
	cmd('exec_all', { cmd: $('#console').val() });
	$('#console').val('');
}

function refreshComplete() {
	$("#clients tr").slice(1).remove();
	request.get({
		url: 'list'
	}, function(e, r, b) {
		if (e) {
			console.log(e, b);
			status.error('Error refreshing the list!');
			return;
		}
		var count = 0;
		var b = JSON.parse(b);
		console.log(b);
		for (var i in b.bots) {
			count++;
			addClientRow(i, b.bots[i].user.name)
		}
		last_count = count;
	})
}

$(function() {
	updateData();
    status.info('init done');
	setInterval(updateData, 1000 * 2);
	$('#console').on('keypress', function(e) {
		if (e.keyCode == '13') {
			runCommand();
			e.preventDefault();
		}
	});
	$('#bot-quota-apply').on('click', function() {
		request.get('quota/' + $('#bot-quota').val(), function(e, r, b) {
			if (e) {
				console.log(e, b);
				status.error('Error applying bot quota!');
			} else {
				status.info('Applied bot quota successfully');
			}
		});
	});
	$('#bot-refresh').on('click', refreshComplete);
	$('#console-send').on('click', runCommand);
});
