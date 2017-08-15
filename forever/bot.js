const EventEmitter = require('events');
const child_process = require('child_process');

const sudo = require('sudo');
const timestamp = require('time-stamp');

const procevt = require('./procevt');
const accounts = require('./acc.js');
const ExecQueue = require('./execqueue');
const injectManager = require('./injection')

const LAUNCH_OPTIONS = "-silent -login $LOGIN $PASSWORD -applaunch 440 -sw -h 640 -w 480 -textmode -novid -nojoy -nosound -noshaderapi -norebuildaudio -nomouse -nomessagebox -nominidumps -nohltv -nobreakpad";

const startQueue = new ExecQueue(5000);

const STATE = {
    INITIALIZING: 0,
    INITIALIZED: 1,
    PREPARING: 2,
    STARTING: 3,
    WAITING_INJECT: 4,
    INJECTING: 5,
    RUNNING: 6,
    RESTARTING: 7
}

class Bot extends EventEmitter {
    constructor(name, user) {
        super();
        var self = this;
        this.state = STATE.INITIALIZING;

        this.name = name;
        this.user = user;

        this.log(`Initializing, user = ${user.name} (${user.uid})`);


        this.steam = null;
        this.game  = null;

        this.gameStarted = 0;

        this.handleGameTimeout = 0;
        this.handleInjection = 0;

        this.on('inject', function() {
            self.state = STATE.RUNNING;
        });
        this.on('inject-error', function() {
            self.state = STATE.RESTARTING;
            self.restartGame();
        });

        this.killSteam(function() {
            self.killGame(function() {
                self.state = STATE.INITIALIZED;
            });
        });
    }
    stop() {
        var self = this;
        self.log('Stopping bot');
        self.state = STATE.INITIALIZING;
        self.killSteam(function() {
            self.killGame(function() {
                self.log('Bot stopped');
            });
        });
    }
    log(message) {
        console.log(`[${timestamp('HH:mm:ss')}][${this.name}][${this.state}] ${message}`);
    }
    killSteam(callback) {
        this.log('Killing steam processes...');
        var self = this;
        if (self.steam) {
            self.steam.kill('SIGKILL');
            self.steam = 0;
            if (callback)
                callback();
        } else {
            var cp = child_process.spawn('killall', ['-9', 'steam'], { uid: parseInt(this.user.uid), gid: parseInt(this.user.gid) });
            if (callback) {
                cp.on('exit', callback);
            }
        }
    }
    killGame(callback) {
        this.log('Killing game processes...');
        var cp = child_process.spawn('killall', ['-9', 'hl2_linux'], { uid: parseInt(this.user.uid), gid: parseInt(this.user.gid) });
        if (callback) {
            cp.on('exit', callback);
        }
    }
    startGameInternal(acc) {
        this.state = STATE.STARTING;
        var self = this;
        self.log(`Logging in into account ${acc.login}`);
        self.steam = child_process.spawn('steam',
            LAUNCH_OPTIONS
                .replace("$LOGIN", acc.login)
                .replace("$PASSWORD", acc.password).split(' '),
            { uid: parseInt(this.user.uid), gid: parseInt(this.user.gid), env: { DISPLAY: ":0", HOME: self.user.home, USER: self.user.name } });
        self.handleGameTimeout = setTimeout(self.onGameTimeout.bind(self), 45 * 1000);
    }
    restartGame(callback) {
        this.state = STATE.PREPARING;
        var self = this;
        self.log('Trying to restart with new account');
        self.killGame(function() {
            self.killSteam(function() {
                procevt.once('update', function() {
                    self.state = STATE.RESTARTING;
                });
                accounts.get(function(err, acc) {
                    if (err) {
                        setTimeout(self.restartGame.bind(self), 15 * 1000);
                        self.log('Error while getting account, retrying in 15 seconds');
                        return;
                    }
                    startQueue.push(self.startGameInternal.bind(self, acc));
                });
                if (callback)
                    callback();
            });
        });
    }
    onGameTimeout() {
        var self = this;
        this.log('Game timed out!');
        this.emit('game-timeout');
        this.restartGame();
    }
    onGameDeath(game) {
        if (this.state == STATE.INITIALIZING || this.state == STATE.PREPARING) {
            return;
        }
        var self = this;
        if (!self.game) return;
        this.emit('game-crash');
        this.log('Game crashed!');
        clearTimeout(this.handleGameTimeout);
        clearTimeout(this.handleInjection);
        this.handleGameTimeout = 0;
        this.handleInjection = 0;
        self.game = 0;
        this.restartGame();
    }
    onGameBirth(game) {
        if (this.state == STATE.INITIALIZING) {
            return;
        }
        this.gameStarted = Date.now();
        this.log('Game started ' + game.pid);
        this.game = game;
        clearTimeout(this.handleGameTimeout);
        clearTimeout(this.handleInjection);
        this.handleGameTimeout = 0;
        this.handleInjection = setTimeout(this.inject.bind(this), 20 * 1000);
        this.state = STATE.WAITING_INJECT;
        this.emit('game-start');
    }
    inject() {
        var self = this;
        this.handleInjection = 0;
        if (!this.game) {
            console.log('Tried to inject into non-running game! There\'s an error in code!');
            return;
        }
        this.state = STATE.INJECTING;
        injectManager.inject(this.game.pid, function(error) {
            if (!error) {
                self.emit('inject');
            } else {
                self.emit('inject-error');
            }
        });
    }
}

module.exports = Bot;
