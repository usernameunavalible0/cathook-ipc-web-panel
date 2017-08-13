const $ = require('jquery');
const format = require('format-duration');
const request = require('browser-request');

const SERVER = 'http://localhost:8081/';

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

var status = {
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

function updateData() {
	cmd('query', {}, function(error, data) {
		if (error) return;
		for (var i in data.result) {
			updateClientRow(i, data.result[i]);
		}
	});
}

function commandButtonCallback() {
    var cmdz = prompt('Enter a command');
    if (cmdz) {
		cmd('exec', {
			target: parseInt($(this).parent().parent().attr('data-id')),
			cmd: cmdz
		}, null)
    }
}

function stopButtonCallback() {
    // Kill
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

function updateClientRow(id, data) {
    var row = $(`tr[data-id="${id}"]`);
    if (!row) return;
	row.toggleClass('hidden', !!data.dead);
	if (data.dead) {
		return;
	}
    var time = Date.now() / 1000 - data.heartbeat;
    if (time < 2) {
        row.find('.client-status').removeClass('error warning').text('OK');
    } else if (time < 30) {
        row.find('.client-status').removeClass('error').addClass('warning').text('Warning');
    } else {
        row.find('.client-status').removeClass('warning').addClass('error').text('Likely dead');
    }
    //row.find('.client-uptime').text(format(time - data.starttime));
    row.find('.client-pid').text(data.pid);
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
        row.find('.client-ip').text('N/A');
        row.find('.client-alive').text('N/A');
        row.find('.client-team').text('N/A');
        row.find('.client-class').text('N/A');
        row.find('.client-score').text('N/A');
        row.find('.client-health').text('N/A');
    }
}

function addClientRow(id) {
    var row = $('<tr></tr>').attr('data-id', id).addClass('disconnected hidden');
    row.append($('<td></td>').attr('class', 'client-id').text(id));
    row.append($('<td></td>').attr('class', 'client-status').text('N/A'));
    //row.append($('<td></td>').attr('class', 'client-uptime').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-pid').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-name').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-total').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-ip connected').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-alive connected').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-team connected').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-class connected').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-score connected').text('N/A'));
    row.append($('<td></td>').attr('class', 'client-health connected').text('N/A'));
    var actions = $('<td></td>').attr('class', 'client-actions');
    actions.append($('<input>').attr('type', 'button').attr('value', 'Command').on('click', commandButtonCallback));
    actions.append($('<input>').attr('type', 'button').attr('value', 'Stop').on('click', stopButtonCallback));
    row.append(actions);
    $('#clients').append(row);
    return row;
}

function runCommand() {
	cmd('exec_all', { cmd: $('#console').val() });
	$('#console').val('');
}

$(function() {
	for (var i = 0; i < 32; i++) {
		addClientRow(i);
	}
	updateData();
    status.info('init done');
	setInterval(updateData, 1000 * 2);
	$('#console').on('keypress', function(e) {
		if (e.keyCode == '13') {
			runCommand();
			e.preventDefault();
		}
	});
	$('#console-send').on('click', runCommand);
});
