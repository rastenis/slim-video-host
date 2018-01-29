//deps
require('dotenv').config();
process.env.DEBUG = 'nuxt:*'
const bcrypt = require('bcrypt');
const shortid = require('shortid');
const chalk = require('chalk');
const async = require('async');
var Datastore = require('nedb');
const {
    Nuxt,
    Builder
} = require('nuxt');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = require('express')();
const fileUpload = require('express-fileupload');
const fs = require("fs");
const util = require('util');
const helmet = require('helmet');
const du = require('du');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const exec = require('child_process').exec;
const config = require('../config');

//isemu _ ir - is generatoriaus, nes nuxtjs dynamic routing sistemai nepatinka jie
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

//uzkraunam DB
db = {};
db.users = new Datastore({
    filename: config.databases.db_users_path,
    autoload: true
});
db.codes = new Datastore({
    filename: config.databases.db_codes_path,
    autoload: true,
    corruptAlertThreshold: 1 // headway manually pridetiems kodams
});
db.videos = new Datastore({
    filename: config.databases.db_videos_path,
    autoload: true
});
db.ratings = new Datastore({
    filename: config.databases.db_ratings_path,
    autoload: true
});

//default options
var defaultUserStatus = 0; //1 - admin
var defaultStorageSpace = 10000; // in megabytes
var defaultTokenExpiry = 1800000; //30 mins

// video storage path
const storagePath = config.file_path;

app.use(helmet());
app.use(fileUpload({
    limits: {
        fileSize: 100 * 1000 * 1000 * 1000 //100 GB
    },
    safeFileNames: true
}));
app.use(bodyParser.json());
app.use(session({
    secret: config.session_key,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 6 * 60 * 60 * 1000
    }
}));

// post for the login procedure
app.post('/api/login', function(req, res) {
    console.log("LOGGING IN | requester: " + req.body.username);
    db.users.find({
        username: req.body.username.toLowerCase()
    }, function(err, docs) {

        try {
            //checks for duplicate usernames
            performSecurityChecks(docs);
            // user exists, no duplicates. Proceeding to the password check
            if (bcrypt.compareSync(req.body.password, docs[0].password)) { //password matches
                console.log(chalk.green("passwords match!"));
                req.session.authUser = docs[0];
                return res.json(docs[0]);
            } else {
                console.log(chalk.red("passwords don't match!"));
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
                //stay silent
            }
        }
    });
});


// video fetch route
app.get('/api/cv/:id', function(req, res) {

    console.log("FETCHING VIDEO | id: " + req.params.id);

    var returner = {};
    returner.ratings = {};
    returner.userRatings = {};

    if (!req.params.id) {} else {
        var path = storagePath + req.params.id + '.mp4';

        //check if requested video exists
        if (fs.existsSync(path)) {

            async.waterfall([function(done) {
                db.videos.update({
                    videoID: req.params.id
                }, {
                    $inc: {
                        views: 1
                    }
                }, {
                    returnUpdatedDocs: true
                }, function(err, numAffected, affectedDocument, upsert) {
                    console.log("added a view to video " + affectedDocument.videoID);
                    affectedDocument.src = '/videos/' + req.params.id + '.mp4';
                    returner.video = affectedDocument;
                    returner.error = 0;
                    done();
                });
            }, function(done) {
                if (req.body.user) {
                    db.ratings.find({
                        username: req.body.user.username,
                        videoID: req.params.id
                    }, {}, function(err, docs) {
                        if (docs.length > 2 || docs.length < 0) {
                            console.log("RATING ERROR===========");
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
                    console.log("NO USER LEEEE");;
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
                    console.log(err);
                }
                res.json(returner);
            });
        } else {
            res.json({
                error: 1
            });
        }
    }
});


app.get('/api/checkToken/:token', function(req, res) {
    var returner = {};
    returner.valid = false;
    console.log("checking for token " + req.params.token);
    db.users.find({
        resetToken: req.params.token,
        tokenExpiry: {
            $gt: Date.now()
        }
    }, function(err, docs) {
        if (docs.length > 1) {
            console.log("duplicate tokens?? purge all");
            returner.error = true;
            db.users.remove({}, {
                multi: true
            }, function(err, docs) {
                if (err) {
                    console.log(err);
                }
            });
        } else if (docs.length < 1) {
            console.log("no such token.");
            returner.token = null;
            returner.error = true;
        } else { //token found
            console.log("found token!");
            returner.token = docs[0].resetToken;
            returner.valid = true;
            returner.error = false;
        }
        res.json(returner);
    });

});

app.post('/api/requestReset', function(req, res) {
    console.log("reset request");
    var returner = {};
    returner.error = true;
    returner.token = null;
    console.log(req.body.email);
    db.users.find({
        email: req.body.email
    }, function(err, docs) {
        if (docs.length > 1) {
            console.log(chalk.bgRed.white("duplicate account emails. CRITICAL"));
            returner.error = true;
        } else if (docs.length < 1) {
            console.log("no such user.");
            returner.error = true;
            returner.msg = "No account with that email.";
            returner.msgType = 'error';
            res.json(returner);
        } else { //token found
            let token = crypto.randomBytes(23).toString('hex');
            console.log("generated token is " + token);

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
                    console.log(err);
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

app.post('/api/changePassword', function(req, res) {
    console.log("PASSWORD CHANGE || " + (req.body.resetType == 1 ? "normal" : "token"));
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
            console.log("found the token");
            if (numAffected == 0) {
                console.log("password was NOT successfully changed");
                returner.msg = "Password reset token is invalid or has expired.";
                returner.msgType = "error";
                returner.error = 1;
            } else if (numAffected > 1) {
                //shouldnt ever happen, severe edge
                console.log(chalk.bgRed.white("CRITICAL! ") + "multiple passwords updated somehow");
            } else {
                //all ok
                console.log("password was successfully changed");
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
                        console.log(err);
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
                            console.log(err);
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
                    console.log(err);
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
    if (req.session.authUser) {
        console.log("ACT | requester: " + req.session.authUser.username);
        async.waterfall([
            function(done) {
                db.ratings.find({
                    username: req.session.authUser.username,
                    videoID: req.body.videoID
                }, function(err, docs) {
                    if (docs.length > 2 || docs.length < 0) {
                        console.log("RATING ERROR===========");
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
                console.log(userRatings.liked);
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
                            console.log(err);
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
                            console.log(err);
                        }
                        done();
                    });
                }
            }
        ], function(err) {
            if (err) {
                console.log(err);
            }
        });
    }
});

app.post('/api/register', function(req, res) {

    async.waterfall([function(done) {
        var enoughSpace = true;
        db.users.find({
            username: req.body.username.toLowerCase()
        }, function(err, docs) {
            du('static/videos', function(err, size) {
                console.log('The size of the video folder is:', size, 'bytes')
                if (size >= config.total_space) {
                    enoughSpace = false;
                }
                done(null, docs, enoughSpace);
            })
        });
    }, function(docs, enoughSpace, done) {

        // checks for duplicate usernames
        if (docs.length != 0) { // user with duplicate username exists
            console.log(chalk.bgRed("Failed account creation (duplicate username)"));
            res.status(599).json({
                error: 'An account with that username already exists.',
            });
        } else if (!enoughSpace) {
            console.log(chalk.bgRed("Failed account creation (TOTAL_SPACE exceeded)"));
            res.status(598).json({
                error: 'The server cannot accept new registrations at this moment.'
            });
        } else { //ok, proceeding with the creation
            var storageSpace = defaultStorageSpace;
            var userStatus = defaultUserStatus;
            console.log(chalk.bgRed(chalk.bgCyanBright.black("no duplicate account! proceeding with the creation of the account.")));
            async.waterfall([
                function(done) {
                    db.users.find({
                        email: req.body.email
                    }, function(err, docs) {
                        if (docs.length != 0) { //duplicate email
                            console.log(chalk.bgRed("Failed account creation (duplicate emails)"));
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
                                    console.log(err);
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
                        userStatus: userStatus
                    }, function(err, doc) {
                        console.log(chalk.bgCyanBright.black("successfully inserted user " + doc.username));
                        req.session.authUser = doc; // attaching to session for easy access
                        return res.json(doc);
                    });
                }
            ], function(err, res) {
                if (err) {
                    console.log(chalk.bgRed.white(err));
                }
            });
        }
    }], function(err) {
        if (err) {
            console.log(err);
        }
    });
});

// route for getting user's videos
app.post('/api/getVideos', function(req, res) {

    var returner = {};
    console.log("VIDEOS | requester : " + req.body.user.username);

    async.waterfall([function(done) {
        db.videos.find({
            username: req.body.user.username.toLowerCase()
        }, function(err, docs) {
            if (err) {
                console.log(chalk.bgRed.white(err));
                returner.error = 1;
                return res.json(null);
            }
            if (docs.length > 0) {
                done(null, docs);
            } else {
                return res.json(null);
            }
        });
    }, function(docs, done) {
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
                }
            ], function(err) {
                if (err) {
                    console.log(err);
                }
                if (index == (docs.length - 1)) {
                    returner.error = 0;
                    returner.videos = docs;
                    return res.json(returner);
                }
            });
        });
    }], function(err) {
        if (err) {
            console.log(err);
        }
    });

});

// route for storage upgrades
app.post('/api/upgradeStorage', function(req, res) {

    var returner = {};
    console.log("UPGRADE | requester : " + req.body.user.username + ", code:" + req.body.code);

    db.codes.find({
        code: req.body.code,
        type: "upgrade",
        active: true
    }, function(err, docs) {
        if (err) {
            console.log(chalk.bgRed.white(err));
            returner.error = 1;
            returner.msg = "server error :(";
            returner.msgType = "error";
        }
        if (docs.length == 0) {
            returner.error = 1;
            returner.msg = "No such code exists.";
            returner.msgType = "error";
            console.log("unsuccessfull no code upgrade");
        } else {
            db.users.update({
                username: req.body.user.username.toLowerCase()
            }, {
                $inc: {
                    totalSpace: docs[0].space
                }
            }, {}, function(err, doc) {});
            db.codes.update({
                code: req.body.code
            }, {
                $set: {
                    active: false
                }
            }, {}, function(err, doc) {});

            console.log("successful upgrade");
            returner.error = 0;
            returner.msg = "You have successfully expanded your space limit!";
            returner.msgType = "success";
        }
        return res.json(returner);
    });
});

// route for account deletion
app.post('/api/deleteAccount', function(req, res) {
    console.log("ACCOUNT DELETION | requester: " + req.session.authUser.username);
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
                    console.log(err);
                } else {
                    if (docs.length == 0) {
                        console.log(chalk.bgReg.white("CRITICAL! delete reqests for non-existent accounts!"));
                        returner.error = 1;
                    } else if (docs.length > 1) {
                        console.log(chalk.bgReg.white("CRITICAL! delete reqest matches multiple accounts!"));
                        returner.error = 1;
                    } else { //all fine, re-fetching to make sure there are no duplicates and that this exact account gets deleted.
                        done(null, docs[0]);
                    }
                }
            });
        }, function(fetchedUser, done) {
            bcrypt.compare(req.body.passwordConfirmation, fetchedUser.password, function(err, valid) {
                if (err) {
                    console.log(err);
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
                    multi: true
                }, function(err) {
                    if (err) {
                        console.log(err);
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
            res.json(returner);
        });
    }
});

// new link generation
app.post('/api/newLink', function(req, res) {
    console.log("NEW LINKS | requester: " + req.session.authUser.username);

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
            var newVidLink = config.video_link_prefix + newVideoID;

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
                        console.log(err);
                    }
                    done();

                });
            }, function(done) {
                // video file removal
                if (!returner.error) {
                    fs.rename(storagePath + sel.videoID + ".mp4", storagePath + newVideoID + ".mp4", function(err) {
                        if (err) {
                            console.log(err);
                        }

                        done();
                    });
                }

            }, function(done) {
                // thumbnail removal
                if (!returner.error) {
                    fs.rename(storagePath + "thumbs/" + sel.videoID + ".jpg", storagePath + "thumbs/" + newVideoID + ".jpg", function(err) {
                        if (err) {
                            console.log(err);
                        }

                        done();
                    });
                }
            }], function(err) {
                if (err) {
                    console.log(err);
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
    console.log("RENAME | requester: " + req.session.authUser.username);

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

    console.log("UPLOAD FINALIZATION | requester: " + req.session.authUser.username);
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
        console.log(chalk.red("upload(s) cancelled"));

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
                console.log("got new name " + req.body.newNames[oldName] + " for " + oldName);

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
                            console.log(chalk.bgRed.white(err));
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
            done(null, docs);
        });
    }, function(unconfirmedvideos, done) {
        unconfirmedvideos.forEach(selection => {
            console.log(chalk.red("removing unconfirmed"));
            db.videos.find({
                videoID: selection.videoID
            }, function(err, docs) {
                if (err) {
                    console.log(chalk.bgRed.white(err));
                } else {
                    db.users.update({
                        username: req.session.authUser.username
                    }, {
                        $inc: { // restoring user's storage space
                            remainingSpace: Math.abs(docs[0].size)
                        }
                    }, {}, function() {
                        // removing video from storage
                        try {
                            fs.unlink(storagePath + selection.videoID + ".mp4");
                        } catch (err) {
                            console.log(err);
                        }
                        // removing thumbnail
                        try {
                            fs.unlink(storagePath + "thumbs/" + selection.videoID + ".jpg");
                        } catch (err) {
                            console.log(err);
                        }
                    });

                    db.videos.remove({
                        videoID: selection.videoID
                    }, function(err, docs) {
                        if (err) {
                            console.log(chalk.bgRed.white(err));
                        }
                        //TODO: returner + refrac both removal routes into one AND waterwall or promise it, b/c cant 
                        //return errors from foreach async operations.
                    });
                }
            });
        });

        done(); //foreach will be +- synced up
    }], function(err) {
        if (err) {
            console.log(err);
        }
    });

});

// postas adminu statistikom
app.post('/api/getAdminStats', function(req, res) {

    console.log("FETCHING ADMIN STATS | requester: " + req.body.user.username);

    var returner = {};
    returner.stats = {};

    if (req.body.user.userStatus == 1) {

        async.waterfall([
            function(done) {
                db.users.count({}, function(err, count) {
                    if (err) {
                        console.log(chalk.bgRed.white(err));
                        returner.error = 1;
                    }
                    returner.stats.userCount = count;
                    done();
                });
            },
            function(done) {
                db.videos.count({}, function(err, count) {
                    if (err) {
                        console.log(chalk.bgRed.white(err));
                        returner.error = 1;
                    }

                    returner.stats.videoCount = count;
                    done();
                });
            },
            function(done) {
                db.videos.find({}, function(err, docs) {
                    if (err) {
                        console.log(chalk.bgRed.white(err));
                        returner.error = 1;
                    }

                    var totalViews = 0,
                        usedSpace = 0;
                    docs.forEach(video => {
                        totalViews += video.views;
                        usedSpace += Math.abs(video.size);
                    });

                    returner.error = 0;
                    returner.stats.totalViews = totalViews;
                    returner.stats.totalSpaceA = config.total_space;
                    returner.stats.usedSpaceA = usedSpace;
                    returner.videos = docs;
                    done();
                });
            }
        ], function(err) {
            if (err) {
                console.log(chalk.bgRed.white(err));
                returner.error = 1;
            }
            return res.json(returner);
        });
    }
});

app.post('/api/removeVideo', function(req, res) {
    if (!req.session.authUser) {
        res.json({
            msgType: "error",
            error: 1,
            msg: "You are not auhorized to do that action!"
        });
    } else {
        console.log("VIDEO DELETION | " + "requester: " + req.session.authUser.username);
        var returner = {};
        returner.selection = req.body.selection;
        var opCount = 0;
        returner.error = 0;
        req.body.selection.forEach(selection => {
            db.videos.find({
                videoID: selection.videoID
            }, function(err, docs) {
                if (err) {
                    console.log(chalk.bgRed.white(err));
                    returner.error = 1;
                    returner.msg = "Internal error. Try again.";
                } else {

                    async.waterfall([function(done) {
                        db.users.update({
                            username: req.session.authUser.username
                        }, {
                            $inc: { // restoring user's storage space
                                remainingSpace: Math.abs(docs[0].size)
                            }
                        }, {}, function(err) {

                            if (err) {
                                console.log(err);
                            }
                            // rm cached vid
                            try {
                                fs.unlink(storagePath + selection.videoID + ".mp4");
                            } catch (err) {
                                console.log(err);
                            }
                            // rm thumbnail
                            try {
                                fs.unlink(storagePath + "thumbs/" + selection.videoID + ".jpg");
                            } catch (err) {
                                console.log(err);
                            }

                            done();
                        });
                    }, function(done) {

                        db.videos.remove({
                            videoID: selection.videoID
                        }, function(err, docs) {
                            if (err) {
                                console.log(chalk.bgRed.white(err));
                                returner.error = 1;
                                returner.msg = "Internal error. Try again.";
                                res.json(returner);
                            }

                            if (opCount == req.body.selection.length - 1) {
                                returner.msgType = "info";
                                returner.error = 0;
                                returner.msg = "Successfully deleted video(s)!";
                                return res.json(returner);
                            } else {
                                opCount++;
                            }
                            //TODO: returner + refrac both removal routes into one AND waterwall or promise it, b/c cant 
                            //return errors from foreach async operations.
                        });
                    }], function(err) {
                        if (err) {
                            console.log(err);
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
            // runnign all-unconfirmed removal before starting
            // TODO: where's this go?
            done();
        }], function(err) {
            // PER-FILE handling  

            for (const file in req.files) { //turetu tik po viena faila postai eit
                if (req.files.hasOwnProperty(file)) {
                    // filesize handlingas
                    var fileSizeInBytes = req.files[file].data.byteLength;
                    var fileSizeInMegabytes = fileSizeInBytes / 1000 / 1000;
                    console.log("uploaded video size is " + fileSizeInMegabytes + "mb");

                    if (fileSizeInMegabytes > 10000) { //hard limitas kad neikeltu didesniu uz 10gb failu
                        res.status(557).json({
                            error: 'File too big.'
                        });
                    } else {

                        var extension = ".mp4";
                        // if (req.files.file.mimetype == "video/avi") {
                        //     extension = ".avi";
                        // } else if (req.files.file.mimetype == "video/webm") {
                        //     extension = ".webm";
                        // }

                        //TODO: support for more formats

                        db.users.find({
                            username: req.session.authUser.username.toLowerCase()
                        }, function(err, docs) {
                            var cleanedName = req.files[file].name.replace(/[^a-z0-9\s]/gi, "");
                            // checking if user's storage space is sufficient
                            if (docs[0].remainingSpace < fileSizeInMegabytes) {
                                res.status(557).json({
                                    error: 'You do not have enough space remaining to upload this file.'
                                });
                            } else {
                                // dedam video i storage
                                var videoID = shortid.generate();
                                var vidLink = config.video_link_prefix + videoID;
                                console.log(chalk.bgGreen.black("storing video!"));

                                db.videos.insert({
                                    username: req.session.authUser.username.toLowerCase(),
                                    link: vidLink,
                                    name: cleanedName,
                                    videoID: videoID,
                                    views: 0,
                                    likes: 0,
                                    dislikes: 0,
                                    size: fileSizeInMegabytes,
                                    confirmed: false
                                }, function(err, newDoc) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        req.files[file].mv(storagePath + videoID + extension, function(err) {
                                            //savinu thumbnail
                                            try {
                                                exec("ffmpeg -i '../" + storagePath + videoID + extension + "' -ss 0 -vframes 1 '../" + storagePath + "thumbs/" + videoID + ".jpg'", {
                                                    cwd: __dirname
                                                }, function(error, stdout, stderr) {
                                                    if (error) {
                                                        console.log(error);
                                                    }
                                                });
                                            } catch (e) {
                                                console.log(chalk.bgYellow.black("WARN") + "failed to save thumbnail ");
                                            }

                                            returner.newVideos.push(newDoc);

                                            if (opCount >= Object.keys(req.files).length - 1) {
                                                console.log("RETURNING UPLOAD CALLBACK w/ " + opCount + " items");
                                                res.json(returner);
                                            } else {
                                                opCount++;
                                            }
                                        });
                                    }

                                });

                                var decrement = fileSizeInMegabytes *= -1;

                                // reducing user's storage space
                                db.users.update({
                                    username: req.session.authUser.username.toLowerCase()
                                }, {
                                    $inc: {
                                        remainingSpace: decrement
                                    }
                                }, {}, function() {});
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
let nuxt_config = require('./nuxt.config.js');
nuxt_config.dev = !(process.env.NODE_ENV === 'production');
const nuxt = new Nuxt(nuxt_config);

//nuxt build
if (nuxt_config.dev) {
    const builder = new Builder(nuxt);
    builder.build();
};
// No build in production

app.use(nuxt.render);
app.listen(10700);
console.log('Server is listening on http://localhost:10700');

function performSecurityChecks(docs) {
    if (docs.length == 0) { // no user with that username
        console.log(chalk.bgRed("No matching account."));
        throw {
            status: 555,
            message: 'No account with that username found.'
        };
    }

    if (docs.length > 1) { // duplicate username users
        console.log(chalk.bgRed("==DUPLICATE ACCOUNTS FOUND=="));
        throw {
            status: 556,
            message: 'Server error.'
        };
    }
}

function hashUpPass(pass) {
    var hash = bcrypt.hashSync(pass, 10);
    return hash;
}