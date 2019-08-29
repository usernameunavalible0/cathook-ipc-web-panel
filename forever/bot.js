const EventEmitter = require('events');
const child_process = require('child_process');

const sudo = require('sudo');
const timestamp = require('time-stamp');
const _ = require('underscore');
const fs = require('fs');
const procfs = require('procfs-stats');

const procevt = require('./procevt');
const accounts = require('./acc.js');
const ExecQueue = require('./execqueue');
const injectManager = require('./injection');
const config = require('./config');

const LAUNCH_OPTIONS_GAME = "firejail --env=LD_PRELOAD=$LD_PRELOAD --env=LD_LIBRARY_PATH=$LD_LIBRARY_PATH --join=$JAILNAME $GAMEPATH -game tf -silent -textmode -sw -h 640 -w 480 -novid -noverifyfiles -nojoy -nosound -noshaderapi -norebuildaudio -nomouse -nomessagebox -nominidumps -nohltv -nobreakpad -nobrowser -nofriendsui -nops2b -norebuildaudio -particles 512 -snoforceformat -softparticlesdefaultoff -threads 1";
const LAUNCH_OPTIONS_STEAM = `firejail --profile=/opt/cathook/steam.profile --name=$JAILNAME --netns=$NETNS --allusers --keep-dev-shm steam -silent -login $LOGIN $PASSWORD -noverifyfiles -nominidumps -nobreakpad -nobrowser -nofriendsui`;
//const LAUNCH_OPTIONS_STEAM = "-silent -login $LOGIN $PASSWORD -applaunch 440 -sw -h 480 -w 640 -novid -noverifyfiles";
const GAME_CWD = "/opt/steamapps/common/Team Fortress 2"

const TIMEOUT_START_GAME = 20000;
const TIMEOUT_RETRY_ACCOUNT = 30000;
const TIMEOUT_IPC_STATE = 90000;
const TIMEOUT_RESTART = 10000;

const steamStartQueue = new ExecQueue(5000);
const gameStartQueue = new ExecQueue(5000);
const injectQueue = new ExecQueue(5000);

const STATE = {
    INITIALIZING: 0,
    INITIALIZED: 1,
    PREPARING: 2,
    STARTING: 3,
    WAITING: 4,
    RUNNING: 5,
    RESTARTING: 6,
    STOPPING: 7,
    WAITING_ACCOUNT: 8,
    INJECTED: 9
}

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
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
        this.restarts = 0;

        this.log(`Initializing, user = ${user.name} (${user.uid})`);

        this.procFirejailSteam = null;
        this.procFirejailGame = null;
        this.procGame = null;

        this.procInject = null;

        // Start timestamp
        this.startTime = null;

        this.ipcState = null;
        this.ipcID = -1;

        this.gameStarted = 0;

        this.timeoutGameStart = 0;
        this.timeoutIPCState = 0;
        this.timeoutSteamRestart = 0;

        this.logSteam = null;
        this.logGame = null;

        var steampath = this.user.home + '/.local/share/Steam';

        // :/lib/i386-linux-gnu:/usr/lib/i386-linux-gnu:/usr/lib/i386-linux-gnu/mesa-egl:/usr/lib/i386-linux-gnu/mesa:/usr/local/lib:/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu/mesa-egl:/usr/lib/x86_64-linux-gnu/mesa:/lib32:/usr/lib32:/libx32:/usr/libx32:/lib:/usr/lib:/usr/lib/i386-linux-gnu/sse2:/usr/lib/i386-linux-gnu/tls:/usr/lib/x86_64-linux-gnu/tls
        this.spawnSteamOptions = {
            uid: parseInt(self.user.uid),
            gid: parseInt(self.user.gid),
            cwd: GAME_CWD,
            env: {
                USER: self.user.name,
                DISPLAY: process.env.DISPLAY,
                HOME: this.user.home,
                LD_LIBRARY_PATH: process.env.STEAM_LD_LIBRARY_PATH,
                LD_PRELOAD: process.env.STEAM_LD_PRELOAD
            },
            shell: true
        }

        this.spawnGameOptions = {
            uid: parseInt(self.user.uid),
            gid: parseInt(self.user.gid),
            cwd: GAME_CWD,
            env: {
                USER: self.user.name,
                DISPLAY: process.env.DISPLAY,
                HOME: this.user.home
            },
            shell: true
        }

        this.on('inject', function () {
            self.state = STATE.RUNNING;
            self.stopped = false;
        });
        this.on('inject-error', function () {
            self.state = STATE.RESTARTING;
            self.restartGame();
        });
        this.on('ipc-data', function (obj) {
            if (self.state != STATE.RUNNING && self.state != STATE.WAITING)
                return;
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
        steamStartQueue.push(function () {
            self.spawnSteam();
            self.state = STATE.STARTING;
            self.timeoutGameStart = setTimeout(function () {
                gameStartQueue.push(self.spawnGame.bind(self));
            }, TIMEOUT_START_GAME);
        });
    }
    spawnSteam() {
        var self = this;
        this.restarts++;
        if (self.procFirejailSteam) {
            self.log('[ERROR] Steam is already running!');
            return;
        }

        var id = self.user.name.split("-")[1];

        self.procFirejailSteam = child_process.spawn(LAUNCH_OPTIONS_STEAM.replace("$LOGIN", self.account.login)
            .replace("$PASSWORD", self.account.password).replace("$JAILNAME", self.user.name).replace("$NETNS", `ns${id}`), self.spawnSteamOptions);
        self.logSteam = fs.createWriteStream('./logs/' + self.name + '.steam.log');
        self.procFirejailSteam.stdout.pipe(self.logSteam);
        self.procFirejailSteam.stderr.pipe(self.logSteam);
        self.procFirejailSteam.on('exit', self.handleSteamExit.bind(self));
        self.log(`Launched Steam (${self.procFirejailSteam.pid}) as ${self.account.steamID || self.account.steamid}`);
        self.emit('start-steam', self.procFirejailSteam.pid);
    }
    killSteam() {
        if (this.state == STATE.PREPARING)
            return;
        this.log('Killing steam');
        // Firejail will handle smooth termination
        if (this.procFirejailSteam)
            this.procFirejailSteam.kill("SIGINT");
    }
    spawnGame() {
        var self = this;
        if (self.procFirejailGame) {
            self.log('[ERROR] Game is already running!');
            self.stopped = false;
            return;
        }

        var filename = `.gl${makeid(6)}`;
        fs.copyFileSync("/opt/cathook/bin/libcathook-textmode.so", `/tmp/${filename}`);
        var spawnoptions = JSON.parse(JSON.stringify(self.spawnGameOptions));
        //spawnoptions.env.LD_LIBRARY_PATH = `${self.user.home}/.steam/steam/steamapps/common/Team Fortress 2/bin`;
        //spawnoptions.env.LD_PRELOAD = `/tmp/${filename}:${process.env.STEAM_LD_PRELOAD}`;
        spawnoptions.cwd = `${self.user.home}/.steam/steam/steamapps/common/Team Fortress 2`;

        self.procFirejailGame = child_process.spawn(LAUNCH_OPTIONS_GAME.replace("$GAMEPATH", `${self.user.home}/.steam/steam/steamapps/common/Team\\ Fortress\\ 2/hl2_linux`)
            .replace("$JAILNAME", self.user.name)
            .replace("$LD_PRELOAD", `"/tmp/${filename}:${process.env.STEAM_LD_PRELOAD}"`)
            .replace("$LD_LIBRARY_PATH", `"${self.user.home}/.steam/steam/steamapps/common/Team Fortress 2/bin"`),
            [], spawnoptions);
        self.state = STATE.WAITING;
        self.logGame = fs.createWriteStream('./logs/' + self.name + '.game.log');
        self.procFirejailGame.stdout.pipe(self.logGame);
        self.procFirejailGame.stderr.pipe(self.logGame);
        self.procFirejailGame.on('exit', self.handleGameExit.bind(self));

        self.timeoutGameStart = setTimeout(function () {
            fs.unlinkSync(`/tmp/${filename}`);
            var res = procevt.find('hl2_linux', self.user.uid);
            if (!res.length) {
                self.log('[ERROR] Could not find running game!');
                self.timeoutSteamRestart = setTimeout(self.restart.bind(self), TIMEOUT_RESTART);
                return;
            }
            self.procGame = res[0];
            procfs(self.procGame.pid).stat(function (err, ret) {
                if (err) {
                    self.log("Error while getting stat.");
                } else {
                    self.startTime = ret.starttime;
                }
            })

            self.stopped = false;
            self.gameStarted = Date.now();

            clearTimeout(self.timeoutIPCState);
            clearTimeout(self.timeoutGameStart);

            self.log(`Found game (${self.procFirejailGame.pid})`);
            self.emit('start-game', self.procFirejailGame.pid);

            self.timeoutIPCState = setTimeout(function () {
                if (!self.ipcState) {
                    self.log(`IPC data timed out! Failed to inject?`);
                    self.restart();
                }
            }, TIMEOUT_IPC_STATE);
        }, 10000);
    }
    handleSteamExit(code, signal) {
        var self = this;
        self.log(`Steam (${self.procFirejailSteam.pid}) exited with code ${code}, signal ${signal}`);
        if (!self.stopped)
            self.timeoutSteamRestart = setTimeout(self.restart.bind(self), TIMEOUT_RESTART);
        self.emit('exit-steam');
        delete self.procFirejailSteam;
    }
    handleGameExit(code, signal) {
        var self = this;
        self.log(`Game (${self.procFirejailGame.pid}) exited with code ${code}, signal ${signal}`);
        self.emit('exit-game');
        self.ipcState = null;
        if (self.procFirejailSteam)
            self.killSteam();
        delete self.procGame;
        delete self.procFirejailGame;
    }
    stop() {
        if (this.state == STATE.PREPARING)
            return;
        var self = this;
        self.stopped = true;
        self.log('Stopping...');
        clearTimeout(self.timeoutSteamRestart);
        clearTimeout(self.timeoutGameStart);
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
        if (this.state == STATE.PREPARING)
            return;
        var self = this;
        self.log('Killing all steam/game processes...');
        // Steam startup script doesn't really obey signals, but firejail does.
        self.killGame();
        self.killSteam();
    }
    killGame() {
        if (this.state == STATE.PREPARING)
            return;
        this.log('Killing game');
        if (this.procFirejailGame)
            this.procFirejailGame.kill("SIGINT");
    }
    restart() {
        var self = this;
        self.stop();
        self.timeoutGameStart = setTimeout(() => {
            if (self.state == STATE.PREPARING) return;
            self.state = STATE.PREPARING;
            self.log('Preparing to restart with new account...');
            if (self.state == STATE.RESTARTING) {
                self.log('Duplicate restart?');
            }
            if (self.account && !config.nodiscard) {
                self.log(`Discarding account ${self.account.login} (${self.account.steamID || self.account.steamid})`);
            }
            self.kill();
            clearTimeout(self.timeoutSteamRestart);
            clearTimeout(self.timeoutGameStart);
            clearTimeout(self.timeoutIPCState);
            self.state = STATE.RESTARTING;
            if (config.nodiscard && self.account) {
                self.startSteamAndGame();
            } else {
                accounts.get(function (err, acc) {
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
        }, 1000);
    }
}

module.exports = Bot;