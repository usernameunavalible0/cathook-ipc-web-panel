const request = require('request');
const fs = require('fs');

function accgen(callback) {
    apikey = null;
    try {
        apikey = fs.readFileSync('/tmp/accgen2-apikey').toString();
    }
    catch (err) {
        callback(err);
    }
    request('http://localhost:8080/api/cg/pop?key=' + apikey, function (e, r, b) {
        if (e)
            return callback(e);
        try {
            callback(null, JSON.parse(b).account);
        } catch (e) {
            return callback(e);
        }
    });
}
module.exports = {
    get: function get(callback) {
        var apikey = "";
        try {
            apikey = fs.readFileSync("apikey", 'utf8');
        }
        catch (error) {
            console.log("Error Reading 'apikey' file next to app.js, using Account generator.")
            console.error(error);
            apikey = "";
            return accgen(callback);
        }
        if (!apikey || apikey.split("\n")[0].length != 31) {
            console.log("No api key in 'apikey' file found next to app.js, using Account generator.");
            return accgen(callback);
        }
        else {
            request('https://catbot.club:2053/api/v1/account/' + apikey, function (e, r, b) {
                if (e || JSON.parse(b).error) {
                    console.log("You have been rate limited");
                    return callback(e || JSON.parse(b).error);
                }
                try {
                    callback(null, JSON.parse(b));
                } catch (e) {
                    return callback(e);
                }
            });
        }
    }
}