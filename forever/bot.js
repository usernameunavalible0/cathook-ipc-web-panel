const EventEmitter = require('events');
const child_process = require('child_process');

const sudo = require('sudo');
const timestamp = require('time-stamp');
const _ = require('underscore');
const fs = require('fs');

const procevt = require('./procevt');
const accounts = require('./acc.js');
const ExecQueue = require('./execqueue');
const injectManager = require('./injection');
const config = require('./config');

const LAUNCH_OPTIONS_STEAM = "-silent -login $LOGIN $PASSWORD -applaunch 440 -textmode -sw -h 640 -w 480 -novid -nojoy -nosound -noshaderapi -norebuildaudio -nomouse -nomessagebox -nominidumps -nohltv -nobreakpad";
const GAME_CWD = "/opt/steamapps/common/Team Fortress 2"

const TIMEOUT_START_GAME = 30000;
const TIMEOUT_INJECT_LIBRARY = 25000;
const TIMEOUT_RETRY_ACCOUNT = 30000;
const TIMEOUT_IPC_STATE = 10000;
const TIMEOUT_RESTART = 10000;

const steamStartQueue = new ExecQueue(5000);
const gameStartQueue = new ExecQueue(5000);
const injectQueue = new ExecQueue(5000);

const STATE = {
    INITIALIZING: 0,
    INITIALIZED: 1,
    PREPARING: 2,
    STARTING: 3,
    WAITING_INJECT: 4,
    INJECTING: 5,
    RUNNING: 6,
    RESTARTING: 7,
    STOPPING: 8,
    WAITING_ACCOUNT: 9,
    INJECTED: 10
}

class Bot extends EventEmitter {
    constructor(name, user) {
        super();
        var self = this;
        this.state = STATE.INITIALIZING;

        this.name = name;
        this.user = user;
        this.stopped = false;
        this.account = null;

        this.log(`Initializing, user = ${user.name} (${user.uid})`);

        this.procSteam  = null;
        this.procGame   = null;
        this.procInject = null;

        this.ipcState = null;
        this.ipcID = -1;

        this.gameStarted = 0;

        this.timeoutGameStart = 0;
        this.timeoutIPCState = 0;
        this.timeoutInjection = 0;
        this.timeoutSteamRestart = 0;

        this.logSteam = null;
        this.logGame = null;

        var steampath = this.user.home + '/.local/share/Steam';

        // :/lib/i386-linux-gnu:/usr/lib/i386-linux-gnu:/usr/lib/i386-linux-gnu/mesa-egl:/usr/lib/i386-linux-gnu/mesa:/usr/local/lib:/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu/mesa-egl:/usr/lib/x86_64-linux-gnu/mesa:/lib32:/usr/lib32:/libx32:/usr/libx32:/lib:/usr/lib:/usr/lib/i386-linux-gnu/sse2:/usr/lib/i386-linux-gnu/tls:/usr/lib/x86_64-linux-gnu/tls
        this.spawnOptions = {
            uid: parseInt(self.user.uid),
            gid: parseInt(self.user.gid),
            cwd: GAME_CWD,
            env: {
                USER: self.user.name,
                DISPLAY: process.env.DISPLAY,
                HOME: this.user.home
            }
        }

        this.on('inject', function() {
            self.state = STATE.RUNNING;
        });
        this.on('inject-error', function() {
            self.state = STATE.RESTARTING;
            self.restartGame();
        });
        this.on('ipc-data', function(obj) {
            var id = obj.id;
            var data = obj.data;
            self.ipcID = id;
            if (!self.ipcState) {
                self.log(`Assigned IPC ID ${id}`);
            }
            self.ipcState = data;
            self.state = STATE.RUNNING;
        });

        this.kill();
        self.state = STATE.INITIALIZED;
    }
    startSteamAndGame() {
        var self = this;
        steamStartQueue.push(function() {
            self.spawnSteam();
            self.state = STATE.STARTING;
            self.timeoutGameStart = setTimeout(function() {
                gameStartQueue.push(self.spawnGame.bind(self));
            }, TIMEOUT_START_GAME);
        });
    }
    spawnSteam() {
        var self = this;
        if (self.procSteam) {
            self.log('[ERROR] Steam is already running!');
            return;
        }
        self.procSteam = child_process.spawn('/usr/bin/steam', LAUNCH_OPTIONS_STEAM
            .replace("$LOGIN", self.account.login)
            .replace("$PASSWORD", self.account.password).split(' '), self.spawnOptions);
        self.logSteam = fs.createWriteStream('./logs/' + self.name + '.steam.log');
        self.procSteam.stdout.pipe(self.logSteam);
        self.procSteam.stderr.pipe(self.logSteam);
        self.procSteam.on('exit', self.handleSteamExit.bind(self));
        self.log(`Launched Steam (${self.procSteam.pid}) as ${self.account.steamID}`);
        self.emit('start-steam', self.procSteam.pid);
    }
    killSteam() {
        this.log('Killing steam');
        let cp = child_process.spawn('/usr/bin/killall', ['steam', '-9'], this.spawnOptions);
    }
    spawnGame() {
        var self = this;
        if (self.procGame) {
            self.log('[ERROR] Game is already running!');
            return;
        }
        var res = procevt.find('hl2_linux', self.user.uid);
        if (!res.length) {
            self.log('[ERROR] Could not find running game!');
            if (!self.stopped)
                self.timeoutSteamRestart = setTimeout(self.restart.bind(self), TIMEOUT_RESTART);
            return;
        }
        self.procGame = res[0];//child_process.spawn('bash', ['start.sh', self.account.login], self.spawnOptions);
        self.gameStarted = Date.now();
        //self.logGame = fs.createWriteStream('./logs/' + self.name + '.game.log');
        //self.procGame.stdout.pipe(self.logGame);
        //self.procGame.stderr.pipe(self.logGame);
        self.procGame.on('exit', self.handleGameExit.bind(self));

        clearTimeout(self.timeoutIPCState);
        clearTimeout(self.timeoutInjection);
        clearTimeout(self.timeoutGameStart);

        self.state = STATE.WAITING_INJECT
        self.timeoutInjection = setTimeout(self.inject.bind(self), TIMEOUT_INJECT_LIBRARY);

        self.log(`Found game (${self.procGame.pid})`);
        self.emit('start-game', self.procGame.pid);
    }
    handleSteamExit(code, signal) {
        var self = this;
        self.log(`Steam (${self.procSteam.pid}) exited with code ${code}, signal ${signal}`);
        if (!self.stopped)
            self.timeoutSteamRestart = setTimeout(self.restart.bind(self), TIMEOUT_RESTART);
        self.emit('exit-steam');
        delete self.procSteam;
    }
    handleGameExit(code, signal) {
        var self = this;
        self.log(`Game (${self.procGame.pid}) exited with code ${code}, signal ${signal}`);
        self.emit('exit-game');
        self.ipcState = null;
        if (self.procSteam)
            self.killSteam();
        delete self.procGame;
    }
    stop() {
        var self = this;
        self.stopped = true;
        self.log('Stopping...');
        clearTimeout(self.timeoutSteamRestart);
        clearTimeout(self.timeoutGameStart);
        clearTimeout(self.timeoutInjection);
        clearTimeout(self.timeoutIPCState);
        self.state = STATE.STOPPING;
        self.ipcState = null;
        self.kill();
        self.log('Bot stopped');
        self.emit('stop');
    }
    log(message) {
        console.log(`[${timestamp('HH:mm:ss')}][${this.name}][${this.state}] ${message}`);
    }
    kill(force) {
        var self = this;
        self.log('Killing all steam/game processes...');
        // Steam startup script doesn't really obey signals
        self.killSteam();
        self.killGame();
    }
    killGame() {
        this.log('Killing game');
        let cp = child_process.spawn('/usr/bin/killall', ['hl2_linux', '-9'], this.spawnOptions);
        cp.on('error', () => {});
    }
    restart() {
        var self = this;

        if (self.state == STATE.PREPARING) return;
        self.state = STATE.PREPARING;
        self.log('Preparing to restart with new account...');
        if (self.state == STATE.RESTARTING) {
            self.log('Duplicate restart?');
        }
        if (self.account && !config.nodiscard) {
            self.log(`Discarding account ${self.account.login} (${self.account.steamID})`);
        }
        self.kill();
        clearTimeout(self.timeoutSteamRestart);
        clearTimeout(self.timeoutGameStart);
        clearTimeout(self.timeoutInjection);
        clearTimeout(self.timeoutIPCState);
        self.state = STATE.RESTARTING;
        if (config.nodiscard && self.account)
        {
            self.startSteamAndGame();
        }
        else
        {
            accounts.get(function(err, acc) {
                if (err) {
                    self.state = STATE.WAITING_ACCOUNT;
                    setTimeout(self.restart.bind(self), TIMEOUT_RETRY_ACCOUNT);
                    self.log('Error while getting account!');
                    return;
                }
                self.account = acc;
                self.startSteamAndGame();
            });
        }
    }
    inject() {
        var self = this;

        clearTimeout(self.timeoutInjection);
        clearTimeout(self.timeoutIPCState);

        if (!self.procGame) {
            self.log('Tried to inject into non-running game! There\'s an error in code!');
            return;
        }
        var pid = self.procGame.pid;
        if (injectManager.injected(pid)) {
            self.log('Already injected!');
            return;
        }

        self.state = STATE.INJECTING;

        injectQueue.push(function() {
            self.log(`Injecting into ${pid}`);
            self.ipcState = null;
            self.procInject = child_process.spawn('/bin/bash', ['inject.sh', `${parseInt(pid)}`], { uid: 0, gid: 0 });
            self.state = STATE.INJECTED;
            self.timeoutIPCState = setTimeout(function() {
                if (!self.ipcState) {
                    self.log(`IPC data timed out! Failed to inject?`);
                    self.restart();
                }
            }, TIMEOUT_IPC_STATE);
        });
    }
}

module.exports = Bot;
