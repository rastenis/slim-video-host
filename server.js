require('dotenv').config();
const FileSystemStore = require("file-system-store");
const MongoPortable = require("mongo-portable").MongoPortable;
const bcrypt = require('bcrypt');
const shortid = require('shortid');
const chalk = require('chalk');

//setupinam databasus
var db = new MongoPortable("main");
db.addStore(FileSystemStore);

var adminRegistered = checkAdminReg();
console.log(adminRegistered);

process.env.DEBUG = 'nuxt:*'

const { Nuxt, Builder } = require('nuxt');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = require('express')();

var defaultStorageSpace = 10;

// Body parser, to access req.body
app.use(bodyParser.json());

// Sessions to create req.session
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }
}));

// postas loginui. Reikalingas, kad butu pasiekiama $store.state.authUser
app.post('/api/login', function(req, res) {

    //bcrypt.compareSync(pass, hash);
    var users = db.collection("users");
    var cursor = users.find({ username: req.body.username.toLowerCase() });

    var ver = verifyUser(cursor, req.body.password);
    if (ver) {
        req.session.authUser = ver;
        return res.json(ver);
    } else {
        res.status(401).json({ error: 'Bad credentials' });
    }

});

app.post('/api/register', function(req, res) {

    var users = db.collection("users");
    var codes = db.collection("codes"); //skirta reg kodams sutikrinti ir duot atitinkamai vietos
    var cursor = users.find({});
    //checkai del duplicate users
    if (checkForDuplicateUN(req.body.username, cursor)) { // bando prisiregint dupe username. throw back
        res.status(401).json({ error: 'An account with that username already exists.' });
    } else { //ok, dedam i DB ir prikabinam prie session kad nereiktu loginintis
        var storageSpace = defaultStorageSpace;
        var defUserStatus = 0;
        var codeCursor = codes.find({ code: req.body.code });

        if (resolveCode(codeCursor)) { //code found
            storageSpace = resolveCode(codeCursor);
        }
        if (!adminRegistered) {
            defUserStatus = 1; //duodam pirmam useriui admin statusa
        }

        var hashedPass = hashUpPass(req.body.password);
        console.log("hashed to " + hashedPass);

        var newUser = users.insert({ username: req.body.username.toLowerCase(), password: hashedPass, email: req.body.email, totalSpace: storageSpace, userStatus: defUserStatus });

        req.session.authUser = newUser; //kabinam visa user ant authUser
        return res.json(newUser);
    }


});

// removinam useri is req.session on logout
app.post('/api/logout', function(req, res) {
    delete req.session.authUser;
    res.json({ ok: true });
});

//nuxt config
let config = require('./nuxt.config.js');
config.dev = !(process.env.NODE_ENV === 'production');
const nuxt = new Nuxt(config);

//nuxt build
if (config.dev) {
    const builder = new Builder(nuxt);
    builder.build();
};
// No build in production

app.use(nuxt.render);
app.listen(10700);
console.log('Server is listening on http://localhost:10700');


function checkAdminReg() {
    var users = db.collection("users");
    var cursor = users.find({});

    var userCount = 0;
    cursor.forEach(function(doc) {
        console.log("users found = " + doc);
        userCount++;
    });

    if (userCount == 0) { //ADMINAS DAR NEPRISIREGISTRAVES; settinam admin flag to false
        return false;
    } else {
        return true;
    }
}

function resolveCode(cursor) {
    cursor.forEach(function(doc) {
        return doc.space;
    });
    return false;
}

function hashUpPass(pass) {
    var hash = bcrypt.hashSync(pass, 10);
    return hash;
}

function checkForDuplicateUN(username, cursor) {
    cursor.forEach(function(doc) {
        console.log("checking username against " + doc.username);
        if (doc.username.toLowerCase() == username.toLowerCase()) { //konvertuojam kad butu case insensitive usernames
            //dupe found
            return true;
        }
    });
    return false;
}

function verifyUser(cursor, pass) {
    let count = 0;
    cursor.forEach(function(doc) { //jei randa daugiau nei 1 - problem
        if (count >= 1) { //checkas del butent dupe username accounts (NETURETU TOKIU BUT EVER)
            console.log(chalk.bgRed.white("== ACCOUNTS WITH MATCHING USERNAMES DETECTED =="));
        } else {
            if (bcrypt.compareSync(pass, doc.password)) { //passwords match
                console.log(chalk.green("passwords match!"));
                return doc;
            } else {
                console.log(chalk.red("passwords don't match!"));
                return false;
            }
        }
        count++;
    });
}