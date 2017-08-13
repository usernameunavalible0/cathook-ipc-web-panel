const CathookConsole = require('./cathook');
const express = require("express");
const bodyparser = require("body-parser");

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

const cc = new CathookConsole();

cc.once('init', () => {
    cc.command('connect');
});
cc.on('exit', () => {});
