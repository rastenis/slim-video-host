const fs = require('fs-extra');
var db = require('../external/db.js');
const chalk = require('chalk');
const async = require('async');


function preLaunch(videoDir) {

    // make sure the designated video directory is up
    fs.ensureDir(videoDir, err => {
        if (err) {
            console.log(err);
        }
    });

    // thumbnail dir too
    fs.ensureDir(videoDir + "thumbs/", err => {
        if (err) {
            console.log(err);
        }
    });

    //checking through all thumbnails & the videos themselves
    db.videos.find({}, function(err, docs) {
        if (err) {
            console.log(err);
        } else {
            docs.forEach((video) => {
                async.waterfall([
                    function(done) {
                        fs.pathExists(videoDir + video.videoID + video.extension, (err, exists) => {
                            if (err) {
                                console.log(err);
                            }
                            if (!exists) {
                                console.log(chalk.bgRed.black("ERROR! Video " + video.videoID + " has no file! Deleting..."));
                                db.videos.remove({ videoID: video.videoID }, {}, function(err) {
                                    if (err) {
                                        console.log(err);
                                    }
                                });
                            }
                            done();
                        })
                    },
                    function(done) {

                    }
                ], function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            });
        }
    });
}

module.exports = {
    preLaunch: preLaunch
}