const procevt = require('./procevt');
const passwd = require('./passwd');
const Bot = require('./bot');

const users = new passwd.Passwd();
const USERNAMES = 'catbot-';

class BotManager {
    constructor() {
        var self = this;
        this.bots = [];
        this.quota = 0;
        procevt.once('update', function() {
            procevt.on('birth', self.onProcBirth.bind(self));
            procevt.on('death', self.onProcDeath.bind(self));
        });
    }
    freeUser() {
        users.readSync();
        var nonfree = {};
        for (var bot of this.bots) {
            nonfree[bot.user.uid] = true;
        }
        for (var uid in users.users) {
            if (users.users[uid].name.indexOf(USERNAMES) >= 0 && !nonfree[uid]) return users.users[uid];
        }
        return null;
    }
    onProcBirth(proc) {
        if (proc.name == 'hl2_linux') {
            for (var bot of this.bots) {
                if (proc.uid == bot.user.uid) {
                    bot.onGameBirth(proc);
                }
            }
        }
    }
    onProcDeath(proc) {
        if (proc.name == 'hl2_linux') {
            for (var bot of this.bots) {
                if (proc.uid == bot.user.uid) {
                    bot.onGameDeath(proc);
                }
            }
        }
    }
    enforceQuota() {
        var quota = this.quota;
        var actual = this.bots.length;
        while (this.bots.length < quota) {
            var u = this.freeUser();
            if (!u) {
                console.log('[ERROR] Could not allocate user for bot!');
                return;
            }
            this.bots.push(new Bot('b' + u.uid, u));
        }
        while (this.bots.length > quota) {
            var b = this.bots.pop();
            b.stop();
        }
    }
    bot(name) {
        for (var bot of this.bots) {
            if (bot.name == name) return bot;
        }
        return null;
    }
    setQuota(quota) {
        quota = parseInt(quota);
        if (!isFinite(quota) || isNaN(quota)) {
            return;
        }
        this.quota = quota;
        this.enforceQuota();
    }
    getJSONStatus() {
        var result = {};
        return result;
    }
}

module.exports = BotManager;
