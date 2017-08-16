const child_process = require('child_process');
const EventEmitter = require('events');
const extend = require('extend');

const CONSOLE_PATH = '/opt/cathook/ipc/bin/console';

class CathookConsole extends EventEmitter {
    constructor() {
        super();
        var self = this;
        this.init = false;
        this.process = child_process.spawn(CONSOLE_PATH);
        this.process.on('exit', function(code) {
            this.init = false;
            self.emit('exit');
            console.log('[!] cathook console exited with code', code);
        });
        this.process.stdout.on('data', function(data) {
            var z = data.toString();
            for (var s of z.split('\n')) {
                if (!s.length) continue;
                try {
                    var d = JSON.parse(s);
                    self.emit('data', d);
                } catch (e) {
                    console.log('error', e);
                    self.emit('data', null);
                    self.emit('err', e);
                }
            }
        });
        this.on('data', function(data) {
            if (data.init) {
                this.init = true;
                this.emit('init');
            };
        });
    }
    command(cmd, data, callback) {
        data = data || {};
        extend(data, { "command": cmd });
        this.process.stdin.write(JSON.stringify(data) + '\n');
        if (callback)
            this.once('data', callback);
    }
}

module.exports = CathookConsole;
