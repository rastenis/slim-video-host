//deps
require('dotenv').config();
process.env.DEBUG = 'nuxt:*'
const bcrypt = require('bcrypt');
const shortid = require('shortid');
const chalk = require('chalk');
const async = require('async');
var Datastore = require('nedb');
const { Nuxt, Builder } = require('nuxt');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = require('express')();

//uzkraunam DB
db = {};
db.users = new Datastore({ filename: 'db/users', autoload: true });
db.codes = new Datastore({ filename: 'db/codes', autoload: true });
db.videos = new Datastore({ filename: 'db/videos', autoload: true });

const defaultUserStatus = 0; //1 - admin
const defaultStorageSpace = 10; //gigabaitais

//skirta isjungti admin registered flagui, kad tik pirma useri padarytu automatiskai adminu.
var adminRegistered = checkAdminReg();


app.use(bodyParser.json());
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }
}));

// postas loginui. Reikalingas, kad butu pasiekiama $store.state.authUser
app.post('/api/login', function(req, res) {

    db.users.find({ username: req.body.username.toLowerCase() }, function(err, docs) {

        //checkai del duplicate usernames
        if (docs.length == 0) { //nerado userio su tokiu username
            console.log(chalk.bgRed("No matching account."));
            res.status(555).json({ error: 'No account with that username found.' });
        }

        if (docs.length > 1) { //rado daugiau nei 1 useri su tokiu username
            console.log(chalk.bgRed("==DUPLICATE ACCOUNTS FOUND=="));
            res.status(557).json({ error: 'Server error.' });
        }

        docs.forEach(function(doc) {
            console.log(chalk.bgGreen("ELEMENT: " + doc.username));

            if (bcrypt.compareSync(req.body.password, doc.password)) { //passwordas atitinka
                console.log(chalk.green("passwords match!"));
                req.session.authUser = doc;
                return res.json(doc);
            } else {
                console.log(chalk.red("passwords don't match!"));
                res.status(556).json({ error: 'Bad credentials' });
            }

        });

    });

});

app.post('/api/register', function(req, res) {

    db.users.find({ username: req.body.username.toLowerCase() }, function(err, docs) {

        //checkai del duplicate usernames
        if (docs.length != 0) { //rado useri su tokiu paciu username
            console.log(chalk.bgRed("Failed account creation (duplicate username)"));
            res.status(401).json({ error: 'An account with that username already exists.' });
            //TODO: add handle for this in vuex
        } else { //ok, dedam i DB ir prikabinam prie session kad nereiktu loginintis
            var storageSpace = defaultStorageSpace;
            var userStatus = defaultUserStatus;
            console.log(chalk.bgRed(chalk.bgCyanBright("no duplicate account!")));

            async.waterfall([
                function(callback) { //tikrinimas ar yra atitinkanciu privelegiju kodu
                    db.codes.find({ code: req.body.code }, function(err, docs) {
                        if (docs.length == 0) { //rado useri su tokiu paciu username
                            //no matching code, go on
                            callback(null, null);
                        } else {
                            //got a matching code!
                            //TODO?: remove code from DB after activation maybe or maybe not
                            callback(null, docs[0]);
                        }
                    });
                },
                function(code, callback) {
                    if (code !== null) { //got code
                        //TODO: code logic, padidint duomenu kieki OR statusa pakeist
                    }
                    if (!adminRegistered) {
                        userStatus = 1; //duodam pirmam useriui admin statusa
                    }

                    var hashedPass = hashUpPass(req.body.password);

                    db.users.insert({ username: req.body.username.toLowerCase(), password: hashedPass, email: req.body.email, totalSpace: storageSpace, userStatus: userStatus }, function(err, doc) {
                        console.log(chalk.bgCyanBright.black("successfully inserted user " + doc.username));
                        req.session.authUser = doc; //kabinam visa user ant authUser
                        return res.json(doc);
                    });
                }
            ], function(err, res) {
                if (err) { //catchas jei pareitu koks unexpected error
                    console.log(chalk.bgRed.white(err));
                }
            });
        }
    });
});

// postas userio video paimimui
app.post('/api/getVideos', function(req, res) {

    db.videos.find({ username: req.body.username.toLowerCase() }, function(err, docs) {
        if (err) {
            console.log(chalk.bgRed.white(err));
        }

        req.session.authUser.videos = docs;
        var returner = {};
        returner.videos = docs;
        return res.json(returner);
    });
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

    db.users.find({}, function(err, docs) {
        var userCount = 0;
        docs.forEach(function(doc) {
            userCount++;
        });

        if (userCount == 0) { //ADMINAS DAR NEPRISIREGISTRAVES; settinam admin flag to false
            return false;
        } else {
            return true;
        }
    });
}

function hashUpPass(pass) {
    var hash = bcrypt.hashSync(pass, 10);
    return hash;
}