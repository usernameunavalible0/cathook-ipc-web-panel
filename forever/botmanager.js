const procevt = require('./procevt');
const passwd = require('./passwd');
const fs = require('fs');
const Bot = require('./bot');

const users = new passwd.Passwd();
const USERNAMES = 'catbot-';

class BotManager {
    constructor(cc) {
        var self = this;
        fs.mkdirSync('logs');
        this.bots = [];
        this.cc = cc;
        this.quota = 0;
        this.lastQuery = {};
        this.updateTimeout = setTimeout(this.update.bind(this), 1000);
    }
    update() {
        var self = this;
        self.cc.command('query', {}, function(data) {
            self.updateTimeout = setTimeout(self.update.bind(self), 1000);
            self.lastQuery = data;
            for (var q in data.result) {
                for (var b of self.bots) {
                    if (b.procGame && b.procGame.pid == data.result[q].pid) {
                        b.emit('ipc-data', {
                            id: q,
                            data: data.result[q]
                        })
                    }
                }
            }
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
