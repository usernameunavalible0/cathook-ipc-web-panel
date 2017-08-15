const request = require('request');

module.exports = {
    get: function get(callback) {
        request('http://localhost:8080/cg/pop', function(e, r, b) {
            if (e)
                return callback(e);
            try {
                callback(null, JSON.parse(b).account);
            } catch (e) {
                return callback(e);
            }
        });
    }
}
