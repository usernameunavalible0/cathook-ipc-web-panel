const request = require('request');
const fs = require('fs');

module.exports = {
    get: function get(callback) {
        let apikey = null;
        try
        {
            apikey = fs.readFileSync('/tmp/accgen2-apikey').toString();
        }
        catch (err)
        {
            callback(err);
        }
        request('http://localhost:8080/api/cg/pop?key=' + apikey, function(e, r, b) {
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
