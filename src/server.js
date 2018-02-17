//deps
process.env.DEBUG = process.env.NODE_ENV === 'production' ? '' : 'nuxt:*'
const bcrypt = require('bcrypt');
const shortid = require('shortid');
const chalk = require('chalk');
const async = require('async');
const {
    Nuxt,
    Builder
} = require('nuxt');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = require('express')();
const fileUpload = require('express-fileupload');
const fs = require("fs-extra");
const util = require('util');
const helmet = require('helmet');
const du = require('du');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const exec = require('child_process').exec;
const NedbStore = require('nedb-session-store')(session);
const config = require('../config');
const maintenance = require('./external/maintenance.js');
const db = require('./external/db.js');
const favicon = require('serve-favicon');
const path = require('path');
const themes = require('../static/style/themes');


// removed _ and - from the generator because of issues with nuxt dynamic routing
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

// default options
var defaultUserStatus = 0; //1 - admin
var defaultStorageSpace = 10000; // in megabytes
var defaultTokenExpiry = 1800000; // 30 mins

// on-start auto maintenance
maintenance.preLaunch(config);

// optional cert generation
if (config.self_hosted == "1") {
    // returns an instance of node-greenlock with additional helper methods
    var lex = require('greenlock-express').create({
        server: 'production',
        challenges: {
            'http-01': require('le-challenge-fs').create({
                webrootPath: 'tmp/acme-challenges'
            })
        },
        store: require('le-store-certbot').create({
            webrootPath: 'tmp/acme-challenges'
        }),
        approveDomains: function(opts, certs, cb) {
            if (certs) {
                opts.domains = config.tls.domains
            } else {
                opts.email = config.tls.email,
                    opts.agreeTos = config.tls.agree_tos == "1";
            }
            cb(null, {
                options: opts,
                certs: certs
            });
        }
    });
}

app.use(favicon(__dirname + '/../static/fav/favicon.ico'));
app.use(helmet());
app.use(fileUpload({
    limits: {
        fileSize: 10 * 1000 * 1000 * 1000 //100 GB
    },
    safeFileNames: true
}));
app.use(bodyParser.json());
app.use(session({
    secret: crypto.randomBytes(23).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: (config.self_hosted == "1"),
        maxAge: 6 * 60 * 60 * 1000
    },
    store: new NedbStore({
        filename: 'db/persistance'
    })
}));


// post for the login procedure
app.post('/api/login', function(req, res) {
    log("LOGIN | requester: " + req.body.username, 0);

    if (req.session.authUser) {
        return;
    }

    db.users.find({
        username: req.body.username.toLowerCase()
    }, function(err, docs) {

        try {
            // checks for duplicate usernames
            performSecurityChecks(docs);
            // user exists, no duplicates. Proceeding to the password check
            if (bcrypt.compareSync(req.body.password, docs[0].password)) { //password matches
                log(chalk.green("LOGIN | passwords match!"), 0);
                req.session.authUser = docs[0];
                return res.json(docs[0]);
            } else {
                log(chalk.red("LOGIN | passwords don't match!"));
                res.status(556).json({
                    error: 'Bad credentials'
                });
            }
        } catch (e) {
            if (e.status) {
                res.status(e.status).json({
                    error: e.message
                });
            } else {
                // stay silent
            }
        }
    });
});


// video fetch route
app.get('/api/cv/:id', function(req, res) {

    log("FETCHING VIDEO | id: " + req.params.id, 0);

    var returner = {};
    returner.ratings = {};
    returner.userRatings = {};

    if (req.params.id) {

        async.waterfall([function(done) {
            //immedately calling an update, won't add a view if the video doesn't exist.
            db.videos.update({
                videoID: req.params.id
            }, {
                $inc: {
                    views: 1
                }
            }, {
                returnUpdatedDocs: true,
                multi: false
            }, function(err, numAffected, affectedDocument, upsert) {

                if (!affectedDocument) {
                    log("FETCHING VIDEO | no such video!", 0);
                    returner.video = affectedDocument;
                    returner.error = 1;
                } else {
                    log("FETCHING VIDEO | added a view to video " + affectedDocument.videoID, 0);
                    affectedDocument.src = '/videos/' + req.params.id + affectedDocument.extension;
                    returner.video = affectedDocument;
                    returner.error = 0;
                }
                done();
            });
        }, function(done) {
            //check if requested video exists
            try {
                var path = config.file_path + req.params.id + returner.video.extension;
            } catch (e) {}

            if (returner.video && fs.existsSync(path)) {
                done();
            } else {
                //else just return it; no point in going forward
                return res.json(returner);
            }
        }, function(done) {
            if (req.body.user) {
                db.ratings.find({
                    username: req.body.user.username,
                    videoID: req.params.id
                }, {}, function(err, docs) {
                    if (docs.length > 2 || docs.length < 0) {
                        log(chalk.yellow("FETCHING VIDEO | RATING ERROR==========="), 1);
                    }
                    returner.userRatings.liked = false;
                    returner.userRatings.disliked = false;

                    //assigning likes/dislikes
                    docs.forEach(doc => {
                        if (doc.action == 0) //disliked
                        {
                            returner.userRatings.disliked = true;
                        } else if (doc.action == 1) {
                            returner.userRatings.liked = true;
                        }
                    });

                    done();
                });
            } else {
                log("FETCHING VIDEO | anonymous viewer", 0);;
                done();
            }
        }, function(done) {
            db.ratings.count({
                action: 1, //like
                videoID: returner.video.videoID
            }, function(err, count) {
                returner.ratings.likes = count;
                done();
            });
        }, function(done) {
            db.ratings.count({
                action: 0, //dislike
                videoID: returner.video.videoID
            }, function(err, count) {
                returner.ratings.dislikes = count;
                done();
            });
        }], function(err) {
            if (err) {
                log(err, 1);
            }
            return res.json(returner);
        });
    }
});

// token checking route
app.get('/api/checkToken/:token', function(req, res) {
    var returner = {};
    returner.valid = false;
    log("PASS RESET | checking for token " + req.params.token, 0);
    db.users.find({
        resetToken: req.params.token,
        tokenExpiry: {
            $gt: Date.now()
        }
    }, function(err, docs) {
        if (docs.length > 1) {
            log("PASS RESET | duplicate tokens; purging all", 1);
            returner.error = true;
            db.users.remove({}, {
                multi: true
            }, function(err, docs) {
                if (err) {
                    log("PASS RESET | " + err, 1);
                }
            });
        } else if (docs.length < 1) {
            log("PASS RESET | no such token.", 0);
            returner.token = null;
            returner.error = true;
        } else { //token found
            log("PASS RESET | found token!", 0);
            returner.token = docs[0].resetToken;
            returner.valid = true;
            returner.error = false;
        }
        res.json(returner);
    });
});

// post to request a password reset
app.post('/api/requestReset', function(req, res) {

    if (req.session.authUser) {
        return;
    }

    log("PASS RESET | reset request", 0);
    var returner = {};
    returner.error = true;
    returner.token = null;
    db.users.find({
        email: req.body.email
    }, function(err, docs) {
        if (docs.length > 1) {
            log(chalk.bgRed.white("CRITICAL!") + chalk.bgRed.white("PASS RESET | duplicate account emails."), 1);
            returner.error = true;
        } else if (docs.length < 1) {
            log("PASS RESET | no such user.", 0);
            returner.error = true;
            returner.msg = "No account with that email.";
            returner.msgType = 'error';
            res.json(returner);
        } else { //token found
            let token = crypto.randomBytes(23).toString('hex');

            var nmlTrans = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: config.mail.username,
                    pass: config.mail.password
                }
            });

            var mailOptions = {
                to: req.body.email,
                from: 'merchseries.referals@gmail.com',
                subject: 'Password Reset',
                text: 'You are receiving this because a password reset for your account was requested.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/r/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n\n' +
                    'Sincerely,\n' +
                    'Scharkee-v team.'
            };
            nmlTrans.sendMail(mailOptions, function(err) {
                if (err) {
                    log("PASS RESET | " + err, 1);
                }
            });

            //store token
            db.users.update({
                email: req.body.email
            }, {
                $set: {
                    resetToken: token,
                    tokenExpiry: Date.now() + defaultTokenExpiry
                }
            }, {
                upsert: false
            }, function(err, docs) {
                returner.msg = "Success! Check your email for further instructions.";
                returner.msgType = 'success';
                returner.error = false;
                res.json(returner);
            });
        }
    });
});

// post to actually change the password (both in-profile and token-based password reset)
app.post('/api/changePassword', function(req, res) {
    log("PASSWORD CHANGE || " + (req.body.resetType == 1 ? "normal" : "token"), 0);
    var returner = {};
    returner.error = 0;
    // single route for both the standard password reset and the 'forgot password' token based reset
    if (req.body.resetType == 1) { //token reset
        var hashedPass = hashUpPass(req.body.newPass);
        // updating right away
        db.users.update({
            resetToken: req.body.token,
            tokenExpiry: {
                $gt: Date.now()
            }
        }, {
            $set: {
                password: hashedPass,
                tokenExpiry: 0
            }
        }, {
            upsert: false,
            returnUpdatedDocs: true
        }, function(err, numAffected, affectedDocs) {
            log("PASSWORD CHANGE || found the token", 0);
            if (numAffected == 0) {
                log("PASSWORD CHANGE || password was NOT successfully changed", 0);
                returner.msg = "Password reset token is invalid or has expired.";
                returner.msgType = "error";
                returner.error = 1;
            } else if (numAffected > 1) {
                //shouldnt ever happen, severe edge
                log(chalk.bgRed.white("CRITICAL!") + "PASSWORD CHANGE || multiple passwords updated somehow", 1);
            } else {
                //all ok
                log("PASSWORD CHANGE || password was successfully changed", 0);
                returner.msg = "You have successfully changed your password!";
                returner.msgType = "success";
                returner.error = 0;
                res.json(returner);
            }
        });
    } else { // regular reset
        if (!req.session.authUser) { // cannot initiate password change without logging in 
            returner.msg = "You are not authorized for this action.";
            returner.msgType = "error";
            returner.error = 1;
            res.json(returner);
        } else { // user is logged in 
            // password checks
            async.waterfall([function(done) {
                db.users.find({
                    username: req.session.authUser.username.toLowerCase()
                }, function(err, docs) {
                    done(null, docs[0]);
                });
            }, function(fetchedUser, done) {
                bcrypt.compare(req.body.currentPassword, fetchedUser.password, function(err, valid) {
                    if (err) {
                        log("PASSWORD CHANGE || " + err, 1);
                    } else {
                        done(null, valid);
                    }
                });
            }, function(valid, done) {
                if (valid) { //all fine
                    // hashing the new password
                    var hashedPass = hashUpPass(req.body.newPassword);

                    // changing the password
                    db.users.update({
                        email: req.session.authUser.email
                    }, {
                        $set: {
                            password: hashedPass
                        }
                    }, {
                        upsert: false
                    }, function(err) {
                        if (err) {
                            log("PASSWORD CHANGE || " + err, 1);
                        } else {
                            returner.msg = "You have successfully changed your password!";
                            returner.msgType = "success";
                            done(null);
                        }
                    });
                } else {
                    returner.msg = "Incorrect old password!";
                    returner.msgType = "error";
                    done(null);
                }
            }], function(err) {
                if (err) {
                    log("PASSWORD CHANGE || " + err, 1);
                } else {
                    res.json(returner);
                }
            });
        }
    }
});

// route for video actions (like/dislike)
app.post('/api/act', function(req, res) {
    //ignore unauthorized acts
    if (!req.session.authUser) {
        return;
    }

    log("ACT | requester: " + req.session.authUser.username, 0);
    async.waterfall([
        function(done) {
            db.ratings.find({
                username: req.session.authUser.username,
                videoID: req.body.videoID
            }, function(err, docs) {
                if (docs.length > 2 || docs.length < 0) {
                    log(chalk.bgRed.white("CRITICAL!") + "ACT | rating error.", 1);
                }
                var userRatings = {};
                userRatings.liked = false;
                userRatings.disliked = false;

                // assigning likes/dislikes
                docs.forEach(doc => {
                    if (doc.action == 0) // disliked
                    {
                        userRatings.disliked = true;
                    } else if (doc.action == 1) {
                        userRatings.liked = true;
                    }
                });
                done(null, userRatings);
            });
        },
        function(userRatings, done) {
            var prep = {};
            prep.action = req.body.action;
            prep.revert = false;
            if (prep.action) { // like
                if (userRatings.liked) { // revert
                    prep.revert = true;
                    prep.increment = -1;
                } else { // just like
                    prep.increment = 1
                }
            } else { // dislike
                if (userRatings.disliked) { // revert
                    prep.revert = true;
                    prep.increment = -1;
                } else { // just dislike
                    prep.increment = 1;
                }
            }
            // updating rating DB
            if (prep.revert) {
                db.ratings.remove({
                    username: req.session.authUser.username,
                    videoID: req.body.videoID,
                    action: prep.action
                }, {}, function(err) {
                    if (err) {
                        log("ACT | " + err, 1);
                    }
                    done();
                });
            } else {
                db.ratings.insert({
                    username: req.session.authUser.username,
                    videoID: req.body.videoID,
                    action: prep.action
                }, function(err) {
                    if (err) {
                        log("ACT | " + err, 1);
                    }
                    done();
                });
            }
        }
    ], function(err) {
        if (err) {
            log("ACT | " + err, 1);
        }
    });
});

// registration post
app.post('/api/register', function(req, res) {
    if (req.session.authUser) {
        // can't register if signed in
        return;
    }
    async.waterfall([function(done) {
        var enoughSpace = true;
        db.users.find({
            username: req.body.username.toLowerCase()
        }, function(err, docs) {
            du('static/videos', function(err, size) {
                log('REGISTRATION | The size of the video folder is:' + size + 'bytes', 0)
                if (size >= config.total_space) {
                    enoughSpace = false;
                }
                done(null, docs, enoughSpace);
            })
        });
    }, function(docs, enoughSpace, done) {

        // checks for duplicate usernames
        if (docs.length != 0) { // user with duplicate username exists
            log(chalk.bgRed("REGISTRATION | Failed account creation (duplicate username)"), 0);
            res.status(599).json({
                error: 'An account with that username already exists.',
            });
        } else if (!enoughSpace) {
            log(chalk.bgRed("REGISTRATION | Failed account creation (TOTAL_SPACE exceeded)"), 1);
            res.status(598).json({
                error: 'The server cannot accept new registrations at this moment.'
            });
        } else { //ok, proceeding with the creation
            var storageSpace = defaultStorageSpace;
            var userStatus = defaultUserStatus;
            log(chalk.bgRed(chalk.bgCyanBright.black("REGISTRATION | no duplicate account! proceeding with the creation of the account.")), 0);
            async.waterfall([
                function(done) {
                    db.users.find({
                        email: req.body.email
                    }, function(err, docs) {
                        if (docs.length != 0) { //duplicate email
                            log(chalk.bgRed("REGISTRATION | Failed account creation (duplicate emails)"), 0);
                            return res.status(597).json({
                                error: 'An account with that email already exists.'
                            });
                        } else {
                            done();
                        }
                    });
                },
                function(done) { // checking for matching privelege codes
                    db.codes.find({
                        code: req.body.code,
                        active: true,
                        type: "reg"
                    }, function(err, docs) {
                        if (docs.length == 0) {
                            //no matching code, go on
                            done(null, null);
                        } else {
                            // got a matching code!
                            // setting the code to 'inactive' state
                            db.codes.update({
                                code: req.body.code
                            }, {
                                $set: {
                                    active: false
                                }
                            }, {}, function(err) {
                                if (err) {
                                    log("REGISTRATION | " + err, 1);
                                }
                            });
                            done(null, docs[0]);
                        }
                    });
                },
                function(code, done) {
                    // adding code benefits
                    if (code !== null) { // got code
                        if (code.benefit == 0) { // increase base storage space
                            storageSpace = code.space;
                        } else if (code.benefit == 1) { // grant admin status
                            userStatus = 1;
                        }
                    }
                    done();
                },
                function(done) {
                    //handling admin assignment for freshly run systems
                    db.users.find({}, function(err, docs) {
                        var userCount = 0;
                        docs.forEach(function(doc) {
                            userCount++;
                        });
                        if (userCount == 0) { // no users; first one will become an admin
                            userStatus = 1
                        } else {
                            userStatus = 0;
                        }
                        done();
                    });
                },
                function(done) {
                    //inserting the new user
                    let hashedPass = hashUpPass(req.body.password);
                    db.users.insert({
                        username: req.body.username.toLowerCase(),
                        password: hashedPass,
                        email: req.body.email,
                        totalSpace: storageSpace,
                        remainingSpace: storageSpace,
                        userStatus: userStatus,
                        accountStanding: 0
                    }, function(err, doc) {
                        log(chalk.bgCyanBright.black("REGISTRATION | successfully inserted user " + doc.username), 0);
                        req.session.authUser = doc; // attaching to session for easy access
                        return res.json(doc);
                    });
                }
            ], function(err, res) {
                if (err) {
                    log(chalk.bgRed.white("REGISTRATION | " + err), 1);
                }
            });
        }
    }], function(err) {
        if (err) {
            log("REGISTRATION | " + err, 1);
        }
    });
});

// route for getting user's videos
app.post('/api/dash', function(req, res) {

    var returner = {};

    log("DASH | requester : " + req.session.authUser.username, 0);

    async.waterfall([
        function(done) {
            db.videos.find({
                username: req.session.authUser.username.toLowerCase()
            }, function(err, docs) {
                if (err) {
                    log(chalk.bgRed.white("DASH | " + err), 1);
                    returner.error = 1;
                    return res.json(null);
                }
                if (docs.length > 0) {
                    done(null, docs);
                } else {
                    return res.json(null);
                }
            });
        },
        function(docs, done) {
            docs.forEach(function(i, index) {
                docs[index].thumbnailSrc = '/videos/thumbs/' + docs[index].videoID + '.jpg';
                async.waterfall([
                    function(finished) {
                        db.ratings.count({
                            videoID: docs[index].videoID,
                            action: 1
                        }, function(err, count) {
                            docs[index].likes = count;
                            finished();
                        });
                    },
                    function(finished) {
                        db.ratings.count({
                            videoID: docs[index].videoID,
                            action: 0
                        }, function(err, count) {
                            docs[index].dislikes = count;
                            finished();
                        });
                    },
                    function(finished) {
                        // user instance refreshment
                        db.users.find({
                            username: req.session.authUser.username.toLowerCase()
                        }, function(err, docs) {
                            req.session.authUser = docs[0];
                            returner.user = docs[0];
                            finished();
                        });
                    }
                ], function(err) {
                    if (err) {
                        log("DASH | " + err, 1);
                    }
                    if (index == (docs.length - 1)) {
                        returner.error = 0;
                        returner.videos = docs;
                        return res.json(returner);
                    }
                });
            });
        }
    ], function(err) {
        if (err) {
            log("DASH | " + err, 1);
        }
    });

});

app.get('/api/settings', function(req, res) {
    var returner = {};
    returner.error = false;

    // settings fetch
    db.settings.find({}, function(err, docs) {
        if (docs.length > 1) {
            log("SETTINGS | more than 1 setting stored in db!", 1);
        } else if (docs.length < 1) {
            log("SETTINGS | no settings in db", 1);
        } else {
            returner.settings = {};
            returner.settings.theme = themes[docs[0].theme];
            returner.settings.themeID = docs[0].theme;
            return res.json(returner);
        }
    });
});


// route for storage upgrades
app.post('/api/upgrade', function(req, res) {

    var returner = {};
    returner.error = 0;
    log("UPGRADE | requester : " + req.session.authUser.username + ", code:" + req.body.code, 0);

    db.codes.find({
        code: req.body.code,
        active: true
    }, function(err, docs) {
        if (err) {
            log(chalk.bgRed.white("UPGRADE | " + err), 1);
            returner.error = 1;
            returner.msg = "server error :(";
            returner.msgType = "error";
        }
        if (docs.length == 0) {
            returner.error = 1;
            returner.msg = "No such code exists.";
            returner.msgType = "error";
            log("UPGRADE | unsuccessful: no such code", 0);
        } else {
            // adding granted benefit:
            // space
            if (docs[0].benefit == 0) {
                db.users.update({
                    username: req.session.authUser.username.toLowerCase()
                }, {
                    $inc: {
                        totalSpace: docs[0].space,
                        remainingSpace: docs[0].space
                    }
                }, {
                    returnUpdatedDocs: true,
                    multi: false
                }, function(err, numAffected, affectedDocument) {
                    if (err) {
                        log("UPGRADE | " + err, 1);
                    }
                    // refreshing session
                    req.session.authUser = affectedDocument;

                    // res
                    returner.msg = "You have successfully expanded your space limit!";
                    returner.msgType = "success";
                    res.json(returner);
                });
                // admin status
            } else if (docs[0].benefit == 1) {
                db.users.update({
                    username: req.session.authUser.username.toLowerCase()
                }, {
                    $set: {
                        userStatus: 1
                    }
                }, {
                    returnUpdatedDocs: true,
                    multi: false
                }, function(err, numAffected, affectedDocument) {
                    if (err) {
                        log("UPGRADE | " + err, 1);
                    }
                    // refreshing session
                    req.session.authUser = affectedDocument;

                    // res
                    returner.msg = "You are now an admin!";
                    returner.msgType = "success";
                    res.json(returner);
                });
            } else if (docs[0].benefit == 2) {
                db.users.update({
                    username: req.session.authUser.username.toLowerCase()
                }, {
                    $set: {
                        accountStanding: 0
                    }
                }, {
                    returnUpdatedDocs: true,
                    multi: false
                }, function(err, numAffected, affectedDocument) {
                    if (err) {
                        log("UPGRADE | " + err, 1);
                    }
                    // refreshing session
                    req.session.authUser = affectedDocument;

                    // res
                    returner.msg = "Your account standing has been cleared!";
                    returner.msgType = "success";
                    res.json(returner);
                });
            }


            // disable code
            db.codes.update({
                code: req.body.code
            }, {
                $set: {
                    active: false
                }
            }, {}, function(err, doc) {
                if (err) {
                    log("UPGRADE | " + err, 1);
                }
            });

            log("UPGRADE | successful upgrade", 0);
        }
    });
});

// route for account deletion
app.post('/api/deleteAccount', function(req, res) {
    log("ACCOUNT DELETION | requester: " + req.session.authUser.username, 0);
    var returner = {};
    returner.error = false;
    var opCount = 0;
    if (!req.session.authUser) {
        res.json({
            error: true,
            msg: "No authentication. Please sign in.",
            msgType: "error"
        });
    } else {
        async.waterfall([function(done) {
            db.users.find({
                email: req.session.authUser.email
            }, function(err, docs) {
                if (err) {
                    log("ACCOUNT DELETION | " + err, 1);
                } else {
                    if (docs.length == 0) {
                        log(chalk.bgRed.white("CRITICAL!") + "ACCOUNT DELETION | delete reqests for non-existent accounts!", 1);
                        returner.error = 1;
                    } else if (docs.length > 1) {
                        log(chalk.bgRed.white("CRITICAL!") + "ACCOUNT DELETION | delete reqest matches multiple accounts!", 1);
                        returner.error = 1;
                    } else { //all fine, re-fetching to make sure there are no duplicates and that this exact account gets deleted.
                        done(null, docs[0]);
                    }
                }
            });
        }, function(fetchedUser, done) {
            bcrypt.compare(req.body.passwordConfirmation, fetchedUser.password, function(err, valid) {
                if (err) {
                    log("ACCOUNT DELETION | " + err, 1);
                } else {
                    returner.error = !valid;
                    done(null, valid);
                }
            });
        }, function(valid, done) {
            if (!valid) { //wrong confirmation password
                returner.msg = "The confirmation password is incorrect! Try again.";
                returner.msgType = "error";
                done();
            } else if (returner.error) {
                returner.msg = "An error occured when deleting your account. Please try again later.";
                returner.msgType = "error";
                done();
            } else {
                db.users.remove({
                    email: req.session.authUser.email
                }, {
                    multi: false
                }, function(err) {
                    if (err) {
                        log("ACCOUNT DELETION | " + err, 1);
                        returner.error = 1;
                        returner.msg = "An internal error occured. Please try again later.";
                        returner.msgType = "error";
                    } else {
                        returner.error = 0;
                        returner.msg = "You have successfully deleted your account!";
                        returner.msgType = "success";
                    }
                    done();
                });
            }
            //TODO: cycle-remove all videos, thumbnails. Export video deletion to a promise probably
        }], function(err) {
            if (err) {
                log("ACCOUNT DELETION | " + err, 1);
            }
            res.json(returner);
        });
    }
});

// new link generation
app.post('/api/newLink', function(req, res) {
    log("NEW LINKS | requester: " + req.session.authUser.username, 0);

    var returner = {};
    returner.error = false;
    var opCount = 0;
    if (!req.session.authUser) {
        res.json({
            error: true,
            msg: "No authentication. Please sign in.",
            msgType: "error"
        });
    } else {
        returner.newData = req.body.selection;
        req.body.selection.forEach((sel, index) => {
            var newVideoID = shortid.generate();
            var newVidLink = config.host_prefix + "v/" + newVideoID;

            async.waterfall([function(done) {
                db.videos.update({
                    username: req.session.authUser.username,
                    videoID: sel.videoID
                }, {
                    $set: {
                        videoID: newVideoID,
                        link: newVidLink
                    }
                }, {
                    upsert: false,
                    returnUpdatedDocs: true
                }, function(err, numAffected, affectedDocs) {
                    done(null, numAffected);
                });
            }, function(numAffected, done) {
                if (numAffected < 1) {
                    returner.error = true;
                    returner.msgType = "error";
                    returner.msg = "Link regeneration failed.";
                }

                returner.newData[index].newVideoID = newVideoID;
                returner.newData[index].newLink = newVidLink;
                done();

            }, function(done) {
                // updating likes/dislikes 
                db.ratings.update({
                    videoID: sel.videoID
                }, {
                    $set: {
                        videoID: newVideoID
                    }
                }, {
                    multi: true
                }, function(err) {
                    if (err) {
                        log("NEW LINKS | " + err, 1);
                    }
                    done();

                });
            }, function(done) {
                // video file renaming
                if (!returner.error) {
                    fs.rename(config.file_path + sel.videoID + sel.extension, config.file_path + newVideoID + sel.extension, function(err) {
                        if (err) {
                            log("NEW LINKS | " + err, 1);
                        }
                        done();
                    });
                }
            }, function(done) {
                // thumbnail renaming
                if (!returner.error) {
                    fs.rename(config.file_path + "thumbs/" + sel.videoID + ".jpg", config.file_path + "thumbs/" + newVideoID + ".jpg", function(err) {
                        if (err) {
                            log("NEW LINKS | " + err, 1);
                        }
                        done();
                    });
                }
            }], function(err) {
                if (err) {
                    log("NEW LINKS | " + err, 1);
                }
                if (opCount == req.body.selection.length - 1) {
                    if (!returner.error) {
                        returner.msgType = "success";
                        returner.msg = "Links successfully updated!";
                    }
                    return res.json(returner);
                } else {
                    opCount++;
                }
            });

        });

    }
});

// route for video name changes
app.post('/api/rename', function(req, res) {
    log("RENAME | requester: " + req.session.authUser.username, 0);

    var returner = {};
    if (!req.session.authUser) {
        res.json({
            error: true,
            msg: "No authentication. Please sign in.",
            msgType: "error"
        });
    } else {
        //updating the requested video's name
        db.videos.update({
            username: req.session.authUser.username,
            videoID: req.body.videoID
        }, {
            $set: {
                name: req.body.newName
            }
        }, {
            upsert: false
        }, function(err, numAffected, affectedDocs) {
            if (err) {
                log("RENAME | " + err, 1);
            }
            if (numAffected < 1) {
                returner.error = true;
                returner.msgType = "error";
                returner.msg = "Renaming failed; No such video.";
            } else {
                returner.error = false;
                returner.msgType = "success";
                returner.msg = "Video successfully renamed!";
            }
            returner.newName = req.body.newName;

            return res.json(returner);
        });
    }
});

// route for video upload finalization (cancel or confirm)
app.post('/api/finalizeUpload', function(req, res) {

    log("UPLOAD FINALIZATION | requester: " + req.session.authUser.username, 0);
    let returner = {},
        opCount = 0;
    if (!req.session.authUser) {
        return res.json({
            error: true,
            msg: "No authentication. Please sign in.",
            msgType: "error"
        });
    }

    if (req.body.cancelled) {
        log(chalk.red("UPLOAD FINALIZATION | upload(s) cancelled"), 0);

        returner.error = 1;
        returner.msgType = "danger";
        returner.msg = "You have cancelled the upload.";
        res.json(returner);
    }

    // proceeding to name assignment, if the upload wasn't cancelled
    async.waterfall([function(done) {

        if (req.body.cancelled) {
            done();
        }
        for (const oldName in req.body.newNames) {
            if (req.body.newNames.hasOwnProperty(oldName)) {
                log("UPLOAD FINALIZATION | got new name " + req.body.newNames[oldName] + " for " + oldName, 0);

                const newName = req.body.newNames[oldName].replace(/[^a-z0-9\s]/gi, ""); // should already be clean coming from the client, redundancy
                let cleanedName = oldName.replace(/[^a-z0-9]/gi, "");

                db.videos.update({
                        confirmed: false,
                        username: req.session.authUser.username,
                        name: cleanedName
                    }, {
                        $set: {
                            name: newName,
                            confirmed: true,
                            uploadDate: new Date()
                        }
                    }, {
                        returnUpdatedDocs: true,
                        multi: false
                    },
                    function(err, numAffected, affectedDocuments) {
                        if (err) {
                            log(chalk.bgRed.white("UPLOAD FINALIZATION | " + err), 1);
                            returner.error = 1;
                        }

                        if (opCount === Object.keys(req.body.newNames).length - 1) {
                            returner.error = 0;
                            returner.msg = "You successfully uploaded the video.";
                            returner.msgType = "success";
                            res.json(returner);
                            done();
                        } else {
                            opCount++;
                        }
                    });
            }
        }

    }, function(done) {
        // unnamed (old unconfirmed) video removal 
        db.videos.find({
            username: req.session.authUser.username,
            confirmed: false
        }, function(err, docs) {
            if (err) {
                log("UPLOAD FINALIZATION | " + err, 1);
            }
            done(null, docs);
        });
    }, function(unconfirmedvideos, done) {
        unconfirmedvideos.forEach(selection => {
            log(chalk.red("UPLOAD FINALIZATION | removing unconfirmed"), 0);
            db.videos.find({
                videoID: selection.videoID
            }, function(err, docs) {
                if (err) {
                    log(chalk.bgRed.white("UPLOAD FINALIZATION | " + err), 1);
                } else {
                    db.users.update({
                        username: req.session.authUser.username
                    }, {
                        $inc: { // restoring user's storage space for each deleted
                            remainingSpace: Math.abs(docs[0].size)
                        }
                    }, {
                        returnUpdatedDocs: true,
                        multi: false
                    }, function(err, numAffected, affectedDocument) {
                        // removing video from storage
                        try {
                            fs.unlink(config.file_path + selection.videoID + selection.extension);
                        } catch (err) {
                            log("UPLOAD FINALIZATION | " + err, 1);
                        }
                        // removing thumbnail
                        try {
                            fs.unlink(config.file_path + "thumbs/" + selection.videoID + ".jpg");
                        } catch (err) {
                            log("UPLOAD FINALIZATION | " + err, 1);
                        }

                        // updating active user
                        req.session.authUser = affectedDocument;

                    });

                    db.videos.remove({
                        videoID: selection.videoID
                    }, function(err, docs) {
                        if (err) {
                            log(chalk.bgRed.white("UPLOAD FINALIZATION | " + err, 1));
                        }
                        //TODO: returner + refrac both removal routes into one AND waterwall or promise it, b/c cant 
                        //return errors from foreach async operations. 
                    });
                }
            });
        });
        //FIXME ?
        done(); //foreach will be +- synced up
    }], function(err) {
        if (err) {
            log("UPLOAD FINALIZATION | " + err, 1);
        }
    });

});

app.post('/api/changeTheme', function(req, res) {
    // only signed in admins
    var returner = {};
    returner.error = false;
    if (req.session.authUser && req.session.authUser.userStatus == 1) {
        db.settings.update({ active: true }, { $set: { theme: req.body.newTheme } }, {
            multi: false,
            returnUpdatedDocs: true
        }, function(err, numAffected, affectedDocuments) {
            if (err) {
                log("THEME CHANGE | " + err, 1);
            }
            if (numAffected > 1) {
                log("THEME CHANGE | " + "duplicate copies of settings in db!", 1);
            } else if (numAffected == 0) { // no global settings in db
                db.settings.insert({
                    active: true,
                    theme: req.body.newTheme
                }, function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            } else {
                // return updated settings

                returner.newSettings = {};
                returner.newSettings = req.body.settings;
                returner.newSettings.theme = themes[req.body.newTheme];
                returner.newSettings.themeID = req.body.newTheme;
                returner.msg = "You have successfully changed the theme!";
                returner.msgType = "success";

                return res.json(returner);
            }
        });
    }
});

app.post('/api/runMaintenance', function(req, res) {
    var returner = {};
    returner.error = false;
    if (req.session.authUser && req.session.authUser.userStatus == 1) {
        try {
            maintenance.preLaunch(config);
            returner.msg = "Maintenance successfully started!";
            returner.msgType = "success";
            return res.json(returner);
        } catch (e) {
            returner.msg = "Couldn't start maintenance! " + e;
            returner.msgType = "danger";
            return res.json(returner);
        }
    } else {
        return;
    }
});

// postas adminu statistikom
app.post('/api/getAdminStats', function(req, res) {

    log("FETCHING ADMIN STATS | requester: " + req.session.authUser.username, 0);

    var returner = {};
    returner.stats = {};

    if (req.session.authUser.userStatus != 1) {
        return;
    }

    async.waterfall([
        function(done) {
            db.users.count({}, function(err, count) {
                if (err) {
                    log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
                    returner.error = 1;
                }
                returner.stats.userCount = count;
                done();
            });
        },
        function(done) {
            db.videos.count({}, function(err, count) {
                if (err) {
                    log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
                    returner.error = 1;
                }

                returner.stats.videoCount = count;
                done();
            });
        },
        function(done) {
            db.videos.find({}, function(err, docs) {
                if (err) {
                    log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
                    returner.error = 1;
                }

                let totalViews = 0,
                    usedSpace = 0;

                // counting video views and total space used
                docs.forEach(video => {
                    totalViews += video.views;
                    usedSpace += Math.abs(video.size);
                });

                returner.error = 0;
                returner.stats.totalViews = totalViews;
                returner.stats.totalSpaceA = config.total_space;
                returner.stats.usedSpaceA = usedSpace.toFixed(2);
                returner.videos = docs;
                done();
            });
        }
    ], function(err) {
        if (err) {
            log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
            returner.error = 1;
        }
        return res.json(returner);
    });

});

// post to remove video
app.post('/api/removeVideo', function(req, res) {
    if (!req.session.authUser) {
        res.json({
            msgType: "error",
            error: 1,
            msg: "You are not auhorized to do that action!"
        });
    } else {
        log("VIDEO DELETION | " + "requester: " + req.session.authUser.username, 0);
        var returner = {};
        returner.selection = req.body.selection;
        var opCount = 0;
        returner.error = 0;
        req.body.selection.forEach(selection => {
            db.videos.find({
                videoID: selection.videoID
            }, function(err, docs) {
                if (err) {
                    log(chalk.bgRed.white("VIDEO DELETION | " + err), 1);
                    returner.error = 1;
                    returner.msg = "Internal error. Try again.";
                } else {
                    async.waterfall([function(done) {
                            db.users.update({
                                    username: selection.username
                                }, {
                                    $inc: { // restoring user's storage space
                                        remainingSpace: Math.abs(docs[0].size)
                                    }
                                }, {
                                    returnUpdatedDocs: true,
                                    multi: false
                                },
                                function(err, numAffected, affectedDocument) {
                                    if (err) {
                                        log("VIDEO DELETION | " + err, 1);
                                    }
                                    // rm cached vid
                                    try {
                                        fs.remove(config.file_path + selection.videoID + selection.extension, function(err) {
                                            if (err) {
                                                log(("VIDEO DELETION | " + err), 1);
                                            }
                                        });
                                    } catch (error) {
                                        log("VIDEO DELETION | " + "couldn't remove video file.", 1);
                                    }
                                    // rm thumbnail
                                    try {
                                        fs.remove(config.file_path + "thumbs/" + selection.videoID + ".jpg", function(err) {
                                            if (err) {
                                                log(("VIDEO DELETION | " + err), 1);
                                            }
                                        });
                                    } catch (error) {
                                        log("VIDEO DELETION | " + "couldn't remove video thumbnail.", 1);
                                    }

                                    // renewing session user, but not if the user is an admin
                                    if (req.session.authUser.userStatus != 1) {
                                        req.session.authUser = affectedDocument;
                                    }

                                    done();
                                });
                        }, function(done) {

                            db.videos.remove({
                                videoID: selection.videoID
                            }, function(err, docs) {
                                if (err) {
                                    log(chalk.bgRed.white("VIDEO DELETION | " + err), 1);
                                    returner.error = 1;
                                    returner.msg = "Internal error. Try again.";
                                    res.json(returner);
                                }

                                if (opCount == req.body.selection.length - 1) {
                                    returner.msgType = "info";
                                    returner.error = 0;
                                    returner.msg = "Successfully deleted video(s)!";
                                    res.json(returner);
                                    done();
                                } else {
                                    opCount++;

                                    done();
                                }
                                //TODO: returner + refrac both removal routes into one AND waterwall or promise it, b/c cant 
                                //return errors from foreach async operations.

                                //TODO: remove ratings
                            });
                        },
                        function(done) {
                            if (req.session.authUser.userStatus == 1 && selection.warning != 0) {
                                // admin has chosen to warn/block user
                                db.users.update({
                                    username: selection.username
                                }, {
                                    $set: {
                                        accountStanding: selection.warning
                                    }
                                }, {
                                    multi: false
                                }, err => {
                                    if (err) {
                                        log(chalk.bgRed.white("VIDEO DELETION | " + err), 1);
                                    }
                                });
                            }
                            done(); //doesn't really matter if operation doesn't finish before returning
                        }
                    ], function(err) {
                        if (err) {
                            log("VIDEO DELETION | " + err, 1);
                        }
                    });
                }
            });
        });
    }
});

// route for video uploads
app.post('/api/upload', function(req, res) {

    if (!req.session.authUser) {
        res.status(557).json({
            error: 'User not signed in.'
        });
    } else {
        let returner = {},
            opCount = 0;
        returner.error = 0;
        returner.newVideos = [];

        async.waterfall([function(done) {
            // checking space first
            du('static/videos', function(err, size) {
                if (size >= config.total_space) {
                    log('UPLOAD | Max space exceeded! Interrupting download...', 1);
                    returner.error = 1;
                    returner.msg = "The server cannot accept videos at the moment. Try again later!";
                    returner.msgType = "info";
                    return res.json(returner);
                }
                done();
            });
        }], function(err) {
            // PER-FILE handling  

            for (const file in req.files) { //turetu tik po viena faila postai eit
                if (req.files.hasOwnProperty(file)) {
                    // filesize handlingas
                    let fileSizeInBytes = req.files[file].data.byteLength;
                    let fileSizeInMegabytes = fileSizeInBytes / 1000 / 1000;
                    log("UPLOAD | uploaded video size is " + fileSizeInMegabytes + "mb", 0);

                    if (fileSizeInMegabytes > 10000) { //hard limitas kad neikeltu didesniu uz 10gb failu
                        res.status(557).json({
                            error: 'File too big.'
                        });
                    } else {

                        let extension;

                        switch (req.files[file].mimetype) {
                            case "video/webm":
                                extension = ".webm";
                                break;
                            case "video/ogg":
                                extension = ".ogv";
                                break;
                            case "video/mp4":
                                extension = ".mp4";
                                break;
                            default:
                                log("UPLOAD | unsupported video format!", 0);
                                res.status(557).json({
                                    error: 'That video format cannot be uploaded.'
                                });
                                break;
                        }

                        async.waterfall([function(done) {
                            db.users.find({
                                username: req.session.authUser.username.toLowerCase()
                            }, function(err, docs) {
                                done(null, docs);
                            });
                        }, function(docs, done) {
                            var cleanedName = req.files[file].name.replace(/[^a-z0-9\s]/gi, "");
                            // checking if user's storage space is sufficient
                            if (docs[0].remainingSpace < fileSizeInMegabytes) {
                                res.status(557).json({
                                    error: 'You do not have enough space remaining to upload this file.'
                                });
                            } else {
                                // dedam video i storage
                                var videoID = shortid.generate();
                                var vidLink = config.host_prefix + "v/" + videoID;
                                log(chalk.green("UPLOAD | storing video!"), 0);

                                db.videos.insert({
                                    username: req.session.authUser.username.toLowerCase(),
                                    link: vidLink,
                                    name: cleanedName,
                                    videoID: videoID,
                                    views: 0,
                                    likes: 0,
                                    dislikes: 0,
                                    size: fileSizeInMegabytes,
                                    mimetype: req.files[file].mimetype,
                                    extension: extension,
                                    confirmed: false
                                }, function(err, newDoc) {
                                    if (err) {
                                        log("UPLOAD | " + err, 1);
                                    } else {
                                        req.files[file].mv(config.file_path + videoID + extension, function(err) {
                                            //savinu thumbnail
                                            try {
                                                exec("ffmpeg -i '../" + config.file_path + videoID + extension + "' -ss 0 -vframes 1 '../" + config.file_path + "thumbs/" + videoID + ".jpg'", {
                                                    cwd: __dirname
                                                }, function(err, stdout, stderr) {
                                                    if (err) {
                                                        log("UPLOAD | " + err, 1);
                                                    }
                                                });
                                            } catch (err) {
                                                log(chalk.bgYellow.black("WARN") + "failed to save thumbnail ", 1);
                                            }

                                            returner.newVideos.push(newDoc);

                                            if (opCount >= Object.keys(req.files).length - 1) {
                                                log("UPLOAD | RETURNING UPLOAD CALLBACK w/ " + opCount + " items", 0);
                                                res.json(returner);
                                            } else {
                                                opCount++;
                                            }
                                        });
                                    }
                                });
                                var decrement = fileSizeInMegabytes *= -1;
                                done(null, decrement);
                            }
                        }, function(decrement, done) {
                            // reducing user's storage space
                            db.users.update({
                                username: req.session.authUser.username.toLowerCase()
                            }, {
                                $inc: {
                                    remainingSpace: decrement
                                }
                            }, {
                                returnUpdatedDocs: true,
                                multi: false
                            }, function(err, numAffected, affectedDocument) {
                                // updating session
                                req.session.authUser = affectedDocument;

                            });
                        }], function(err) {
                            if (err) {
                                log("UPLOAD | " + err, 1);
                            }

                        });
                    }
                }
            }
        });
    }
});


// removing usre from req.session on logout
app.post('/api/logout', function(req, res) {
    delete req.session.authUser;
    res.json({
        ok: true
    });
});

//TODO: recalculate user remaining space each start?

//nuxt config
let nuxt_config = require('../nuxt.config.js');
nuxt_config.dev = !(process.env.NODE_ENV === 'production');
const nuxt = new Nuxt(nuxt_config);

//nuxt build
if (nuxt_config.dev) {
    const builder = new Builder(nuxt);
    builder.build();
};
// No build in production

app.use(nuxt.render);

if (config.self_hosted == "1") {
    // handles acme-challenge and redirects to https
    require('http').createServer(lex.middleware(require('redirect-https')())).listen(80, function() {
        console.log("Listening for ACME http-01 challenges on", this.address());
    });

    // https handler
    var server = require('https').createServer(lex.httpsOptions, lex.middleware(app))
    server.listen(443, function() {
        console.log("Listening for ACME tls-sni-01 challenges and serve app on", this.address());
    });
} else {
    app.listen(10700);
    console.log('Server is listening on http://localhost:10700');
}


// used once at login as a precaution 
function performSecurityChecks(docs) {
    if (docs.length == 0) { // no user with that username
        log(chalk.bgRed("No matching account."), 0);
        throw {
            status: 555,
            message: 'No account with that username found.'
        };
    }

    if (docs.length > 1) { // duplicate username users
        log(chalk.bgRed("==DUPLICATE ACCOUNTS FOUND=="), 1);
        throw {
            status: 556,
            message: 'Server error.'
        };
    }
}

// password hashing function
function hashUpPass(pass) {
    var hash = bcrypt.hashSync(pass, 10);
    return hash;
}

// logger
function log(message, type) {
    if (config.production_logging === "all" || process.env.NODE_ENV !== 'production') {
        console.log(message);
    } else if (config.production_logging === "error" && type === 1) {
        console.log(message);
    }
}