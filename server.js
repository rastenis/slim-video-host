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
const fileUpload = require('express-fileupload');
const fs = require("fs");
const util = require('util');

//isemu - ir _ is generatoriaus, nes nuxtjs dynamic routing sistemai nepatinka jie
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

//uzkraunam DB
db = {};
db.users = new Datastore({ filename: 'db/users', autoload: true });
db.codes = new Datastore({ filename: 'db/codes', autoload: true });
db.videos = new Datastore({ filename: 'db/videos', autoload: true });

//default optionai
const defaultUserStatus = 0; //1 - admin
const defaultStorageSpace = 10240; //megabaitais

// video storage path
const storagePath = "static/videos/";

//skirta isjungti admin registered flagui, kad tik pirma useri padarytu automatiskai adminu.
var adminRegistered = checkAdminReg();

app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    safeFileNames: true
}));
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
        try {
            performSecurityChecks(docs);
        } catch (e) {
            res.status(e.status).json({ error: e.message });
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

    console.log("requester : " + req.body.user.username);

    db.videos.find({ username: req.body.user.username.toLowerCase() }, function(err, docs) {
        if (err) {
            console.log(chalk.bgRed.white(err));
            returner.error = 1;
        }
        console.log("OKE, " + docs);
        var returner = {};
        returner.error = 0;
        returner.videos = docs;
        return res.json(returner);
    });
});

// postas video ikelimui
app.post('/api/upload', function(req, res) {


    if (!req.session.authUser) {
        res.status(557).json({ error: 'User not signed in.' });
    } else {
        console.log(util.inspect(req.files.file, { showHidden: false, depth: null }))

        var fileSizeInBytes = req.files.file.data.byteLength;
        //pasiverciam i megabaitus
        var fileSizeInMegabytes = fileSizeInBytes / 1024 / 1024;
        console.log("size is " + fileSizeInMegabytes + "mb");

        if (fileSizeInMegabytes > 10240) { //hard limitas kad neikeltu didesniu uz 10gb failu
            res.status(557).json({ error: 'File too big.' });
            console.log("file size is fine");
        }

        var extension = ".mp4";
        // if (req.files.file.mimetype == "video/avi") {
        //     extension = ".avi";
        // } else if (req.files.file.mimetype == "video/webm") {
        //     extension = ".webm";
        // }

        //TODO: support for more formats

        db.users.find({ username: req.session.authUser.username.toLowerCase() }, function(err, docs) {

            //checkai del duplicate usernames
            try {
                performSecurityChecks(docs);
            } catch (e) {
                res.status(e.status).json({ error: e.message });
            }

            var cleanedName = req.files.file.name.replace(/[^a-z0-9\s]/gi, "");
            //patikrinam, ar useriui pakanka storage space
            if (docs[0].remainingSpace < fileSizeInMegabytes) {
                res.status(557).json({ error: 'You do not have enough space remaining to upload this file.' });
            } else {
                //dedam video i storage
                var videoID = shortid.generate();
                var vidLink = "https://cigari.ga/v/" + videoID;
                console.log(chalk.bgGreen.black("storing video!"));

                db.videos.insert({ username: req.session.authUser.username.toLowerCase(), link: vidLink, name: cleanedName, videoID: videoID, views: 0, likes: 0, dislikes: 0 }, function() {
                    req.files.file.mv(storagePath + videoID + extension);
                });

            }

        });
    }



});

// removinam useri is req.session on logout
app.post('/api/logout', function(req, res) {
    delete req.session.authUser;
    res.json({ ok: true });
});



//patikra ar yra toks video
app.get('/api/checkVideo/:id', function(req, res) {

    if (!req.params.id) {
        console.log("empty request, probably a refresh");
    } else {
        var path = storagePath + req.params.id + '.mp4';
        console.log("looking for " + path);

        //check if requested video exists
        if (fs.existsSync(path)) {
            let vidpath = '/videos/' + req.params.id + '.mp4';
            res.json({ error: 0, src: vidpath });
        } else {
            res.json({ error: 1 });
        }
    }


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

function performSecurityChecks(docs) {
    if (docs.length == 0) { //nerado userio su tokiu username
        console.log(chalk.bgRed("No matching account."));
        throw { status: 555, message: 'No account with that username found.' };
    }

    if (docs.length > 1) { //rado daugiau nei 1 useri su tokiu username
        console.log(chalk.bgRed("==DUPLICATE ACCOUNTS FOUND=="));
        throw { status: 556, message: 'Server error.' };
    }
}

function hashUpPass(pass) {
    var hash = bcrypt.hashSync(pass, 10);
    return hash;
}