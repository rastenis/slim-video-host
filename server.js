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

//isemu - ir _ is generatoriaus, nes nuxtjs dynamic routing sistemai nepatinka jie
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

//uzkraunam DB
db = {};
db.users = new Datastore({
    filename: process.env.DB_USERS_PATH,
    autoload: true
});
db.codes = new Datastore({
    filename: process.env.DB_CODES_PATH,
    autoload: true,
    corruptAlertThreshold: 0.6 //truputis headway manually pridetiems kodams
});
db.videos = new Datastore({
    filename: process.env.DB_VIDEOS_PATH,
    autoload: true
});

db.ratings = new Datastore({
    filename: process.env.DB_RATINGS_PATH,
    autoload: true
});

//default optionai
var defaultUserStatus = 0; //1 - admin
var defaultStorageSpace = 10000; //megabaitais

// video storage path
const storagePath = process.env.FILE_PATH;

app.use(helmet());
app.use(fileUpload({
    limits: {
        fileSize: 100 * 1000 * 1000 * 1000 //100 GB
    },
    safeFileNames: true
}));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 6 * 60 * 60 * 1000
    }
}));

// postas loginui. Reikalingas, kad butu pasiekiama $store.state.authUser
app.post('/api/login', function(req, res) {
    console.log("LOGGING IN | requester: " + req.body.username);
    db.users.find({
        username: req.body.username.toLowerCase()
    }, function(err, docs) {

        //checkai del duplicate usernames
        try {
            performSecurityChecks(docs);
        } catch (e) {
            res.status(e.status).json({
                error: e.message
            });
        }

        docs.forEach(function(doc) {
            console.log(chalk.bgGreen("ELEMENT: " + doc.username));

            if (bcrypt.compareSync(req.body.password, doc.password)) { //passwordas atitinka
                console.log(chalk.green("passwords match!"));
                req.session.authUser = doc;
                return res.json(doc);
            } else {
                console.log(chalk.red("passwords don't match!"));
                res.status(556).json({
                    error: 'Bad credentials'
                });
            }

        });

    });

});

//patikra ar yra toks video
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

                    //assigning likes/dislikes
                    docs.forEach(doc => {
                        if (doc.action == 0) //disliked
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
                if (prep.action) { //like
                    if (userRatings.liked) { //revert
                        prep.revert = true;
                        prep.increment = -1;
                    } else { //just like
                        prep.increment = 1
                    }
                } else { //dislike
                    if (userRatings.disliked) { //revert
                        prep.revert = true;
                        prep.increment = -1;
                    } else { //just dislike
                        prep.increment = 1;
                    }
                }
                console.log("revert is " + prep.revert);
                //updating rating DB
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
                if (size >= process.env.TOTAL_SPACE) {
                    enoughSpace = false;
                }
                done(null, docs, enoughSpace);
            })
        });
    }, function(docs, enoughSpace, done) {

        //checkai del duplicate usernames
        if (docs.length != 0) { //rado useri su tokiu paciu username
            console.log(chalk.bgRed("Failed account creation (duplicate username)"));
            res.status(401).json({
                error: 'An account with that username already exists.'
            });
            //TODO: add handle for this in vuex
        } else if (!enoughSpace) {
            console.log(chalk.bgRed("Failed account creation (TOTAL_SPACE exceeded)"));
            res.status(401).json({
                error: 'The server cannot accept new registratios at this moment.'
            });
        } else { //ok, dedam i DB ir prikabinam prie session kad nereiktu loginintis
            var storageSpace = defaultStorageSpace;
            var userStatus = defaultUserStatus;
            console.log(chalk.bgRed(chalk.bgCyanBright.black("no duplicate account! proceeding with the creation of the account.")));

            async.waterfall([
                function(done) { //tikrinimas ar yra atitinkanciu privelegiju kodu
                    db.codes.find({
                        code: req.body.code,
                        active: true,
                        type: "reg"
                    }, function(err, docs) {
                        if (docs.length == 0) { //rado useri su tokiu paciu username
                            //no matching code, go on
                            done(null, null);
                        } else {
                            //got a matching code!

                            // settinu 'active' flag i false by default
                            db.codes.update({ code: req.body.code }, { $set: { active: false } }, {}, function(err) {
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
                        if (code.benefit == 0) { // daugiau base space
                            storageSpace = code.space;
                        } else if (code.benefit == 1) { //grant admin status
                            userStatus = 1;
                        }
                    }
                    db.users.find({}, function(err, docs) {
                        var userCount = 0;
                        docs.forEach(function(doc) {
                            userCount++;
                        });

                        if (userCount == 0) { //ADMINAS DAR NEPRISIREGISTRAVES; settinam admin flag to true
                            userStatus = 1
                        } else {
                            userStatus = 0;
                        }

                        var hashedPass = hashUpPass(req.body.password);

                        db.users.insert({
                            username: req.body.username.toLowerCase(),
                            password: hashedPass,
                            email: req.body.email,
                            totalSpace: storageSpace,
                            remainingSpace: storageSpace,
                            userStatus: userStatus
                        }, function(err, doc) {
                            console.log(chalk.bgCyanBright.black("successfully inserted user " + doc.username));
                            req.session.authUser = doc; //kabinam visa user ant authUser
                            return res.json(doc);
                        });
                    });
                }
            ], function(err, res) {
                if (err) { //catchas jei pareitu koks unexpected error
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

// postas userio video paimimui
app.post('/api/getVideos', function(req, res) {

    var returner = {};
    console.log("VIDEOS | requester : " + req.body.user.username);

    db.videos.find({
        username: req.body.user.username.toLowerCase()
    }, function(err, docs) {
        if (err) {
            console.log(chalk.bgRed.white(err));
            returner.error = 1;
        }
        if (docs.length > 0) {
            docs.forEach(function(i, index) {
                async.waterfall([
                    function(done) {
                        db.ratings.count({
                            videoID: docs[index].videoID,
                            action: 1
                        }, function(err, count) {
                            docs[index].likes = count;
                            done();
                        });
                    },
                    function(done) {
                        db.ratings.count({
                            videoID: docs[index].videoID,
                            action: 0
                        }, function(err, count) {
                            docs[index].dislikes = count;
                            done();
                        });
                    }
                ], function(err) {
                    if (err) {
                        console.log(err);
                    }
                    if (index == (docs.length - 1)) {
                        returner.error = 0;
                        returner.videos = docs;
                        console.log("RETURNINGGG at index " + index);
                        return res.json(returner);
                    }
                });
            });
        } else {
            return res.json(null);
        }
    });
});

// postas vietos upgrade'ui
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

//new link generation
app.post('/api/newLink', function(req, res) {
    console.log("NEW LINK | requester: " + req.session.authUser.username);

    var returner = {};
    if (!req.session.authUser) {
        res.json({
            error: true,
            msg: "No authentication. Please sign in.",
            msgType: "error"
        });
    } else {
        //getting new info for the video

        var newVideoID = shortid.generate();
        var newVidLink = process.env.VIDEO_LINK_PRE + newVideoID;

        db.videos.update({
            username: req.session.authUser.username,
            videoID: req.body.videoID
        }, {
            $set: {
                videoID: newVideoID,
                link: newVidLink
            }
        }, {
            upsert: false
        }, function(err, numAffected, affectedDocs) {
            if (numAffected < 1) {
                returner.error = true;
                returner.msgType = "error";
                returner.msg = "Link regeneration failed; No such video.";
            } else {
                returner.error = false;
                returner.msgType = "success";
                returner.msg = "Link successfully updated!";
            }

            fs.rename(storagePath + req.body.videoID + ".mp4", storagePath + newVideoID + ".mp4", function(err) {
                if (err) throw err;
            });

            returner.newID = newVideoID;
            returner.newLink = newVidLink;

            return res.json(returner);
        });
    }
});

// vardo pakeitimas
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

// postas video ikelimo uzbaigimui (cancel or finalize)
app.post('/api/finalizeUpload', function(req, res) {

    console.log("UPLOAD FINALIZATION | requester: " + req.session.authUser.username);
    var returner = {};
    if (!req.session.authUser) {
        res.json({
            error: true,
            msg: "No authentication. Please sign in.",
            msgType: "error"
        });
    } else {
        if (req.body.video.finalizationStatus == 0) { //video was successfully uploaded and named
            db.videos.update({
                confirmed: false,
                username: req.session.authUser.username.toLowerCase()
            }, {
                $set: {
                    name: req.body.video.name,
                    confirmed: true,
                    uploadDate: new Date()
                }
            }, {}, function(err) {
                if (err) {
                    console.log(chalk.bgRed.white(err));
                    returner.error = 1;
                }

                returner.error = 0;
                returner.msg = "You successfully uploaded the video.";
                returner.msgType = "success";
                return res.json(returner);
            });
        } else if (req.body.video.finalizationStatus == 1) { //video was not successfully uploaded (canceled)
            //non-multi removal (gal ir praverstu multi false check, TODO)
            console.log(chalk.red("cancelled " + req.body.video.name));

            db.videos.find({
                confirmed: false,
                username: req.session.authUser.username.toLowerCase()
            }, function(err, docs) {
                if (docs.length == 0) {
                    console.log("video hasnt been uploaded yet, not cancelling");
                } else {
                    docs.forEach(function(video) {
                        console.log(chalk.red("removing unconfirmed video " + video.name));
                        // removing video from both database and storage
                        db.videos.remove({
                            videoID: video.videoID
                        }, function(err, res) {});
                        fs.unlink(storagePath + video.videoID + ".mp4");
                    });
                }
            });

            returner.error = 2;
            returner.msgType = "info";
            returner.msg = "You have cancelled the upload.";
            return res.json(returner);
        }
    }


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
                    returner.stats.totalSpaceA = process.env.TOTAL_SPACE;
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

// postas userio video pasalinimui
app.post('/api/removeVideo', function(req, res) {

    console.log("REMOVING VIDEO | requester: " + req.session.authUser.username + "video ID : " + req.body.videoID);

    var returner = {};
    db.videos.find({
        videoID: req.body.videoID
    }, function(err, docs) {
        if (err) {
            console.log(chalk.bgRed.white(err));
            returner.error = 1;
            returner.msg = "Internal error. Try again.";
        } else {
            db.users.update({
                username: req.session.authUser.username
            }, {
                $inc: {
                    remainingSpace: Math.abs(docs[0].size)
                }
            }, {}, function() {
                //pridejom atgal storage space useriui

                //taip pat ir istrinam pati video is storage
                fs.unlink(storagePath + req.body.videoID + ".mp4");
            });

            db.videos.remove({
                videoID: req.body.videoID
            }, function(err, docs) {
                if (err) {
                    console.log(chalk.bgRed.white(err));
                    returner.error = 1;
                }
                returner.msgType = "info";
                returner.error = 0;
                returner.msg = "Successfully deleted video!";
                return res.json(returner);
            });
        }
    });
});

// postas video ikelimui
app.post('/api/upload', function(req, res) {

    if (!req.session.authUser) {
        res.status(557).json({
            error: 'User not signed in.'
        });
    } else {
        // console.log(util.inspect(req.files.file, { showHidden: false, depth: null }))

        var fileSizeInBytes = req.files.file.data.byteLength;

        // pasiverciam i megabaitus
        var fileSizeInMegabytes = fileSizeInBytes / 1000 / 1000;
        console.log("size is " + fileSizeInMegabytes + "mb");

        if (fileSizeInMegabytes > 100000) { //hard limitas kad neikeltu didesniu uz 100gb failu
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

                // checkai del duplicate usernames
                try {
                    performSecurityChecks(docs);
                } catch (e) {
                    res.status(e.status).json({
                        error: e.message
                    });
                }

                var cleanedName = req.files.file.name.replace(/[^a-z0-9\s]/gi, "");
                // patikrinam, ar useriui pakanka storage space
                if (docs[0].remainingSpace < fileSizeInMegabytes) {
                    res.status(557).json({
                        error: 'You do not have enough space remaining to upload this file.'
                    });
                } else {
                    // dedam video i storage
                    var videoID = shortid.generate();
                    var vidLink = process.env.VIDEO_LINK_PRE + videoID;
                    console.log(chalk.bgGreen.black("storing video!"));

                    db.videos.find({
                        confirmed: false
                    }, function(err, docs) {
                        if (docs.length != 0) {
                            //removing all unconfirmed videos
                            docs.forEach(function(video) {
                                console.log(chalk.red("removing unconfirmed video " + video.name));
                                // removing video from both database and storage
                                db.videos.remove({
                                    videoID: video.videoID
                                }, function(err, res) {});
                                fs.unlink(storagePath + video.videoID + ".mp4");
                            });
                        } else {
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
                            }, function() {
                                req.files.file.mv(storagePath + videoID + extension);
                            });
                        }
                    });

                    var decrement = fileSizeInMegabytes *= -1;

                    // atimam is userio atitnkama kieki duomenu
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

});

// removinam useri is req.session on logout
app.post('/api/logout', function(req, res) {
    delete req.session.authUser;
    res.json({
        ok: true
    });
});

//TODO: recalculate user remaining space each start?

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

function performSecurityChecks(docs) {
    if (docs.length == 0) { //nerado userio su tokiu username
        console.log(chalk.bgRed("No matching account."));
        throw {
            status: 555,
            message: 'No account with that username found.'
        };
    }

    if (docs.length > 1) { //rado daugiau nei 1 useri su tokiu username
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