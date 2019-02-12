const request = require('request');
const fs = require('fs');

module.exports = {
    get: function get(callback) {
        request('https://accgen.inkcat.net:6969/account', function(e, r, b) {
            if (e)
            {
                console.log("You have been ratelimited from the Account Generator, contact t.me/nullworks on telegram to be unbanned or wait a day.");
                return callback(e);
            }
            try {
                callback(null, JSON.parse(b));
            } catch (e) {
                return callback(e);
            }
        });
    }
}
