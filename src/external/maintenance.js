const fs = require('fs-extra');
var db = require('../external/db.js');
const chalk = require('chalk');
const async = require('async');
const exec = require('child_process').exec;


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

    let videoNames = [],
        thumbnailNames = [];

    //checking through all thumbnails & the videos themselves
    db.videos.find({}, function(err, docs) {
        if (err) {
            console.log(err);
        } else {
            docs.forEach((video) => {

                // adding for further cleaning
                videoNames.push(video.videoID + video.video.extension);
                thumbnailNames.push(video.videoID + ".jpg");

                async.waterfall([
                    function(done) {
                        fs.pathExists(videoDir + video.videoID + video.extension, (err, exists) => {
                            if (err) {
                                console.log(err);
                            }
                            if (!exists) {
                                //console.log(chalk.bgRed.black("ERROR! Video " + video.videoID + " has no file! Deleting..."));
                                db.videos.remove({ videoID: video.videoID }, {}, function(err) {
                                    if (err) {
                                        console.log(err);
                                    }
                                });
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.pathExists(videoDir + "thumbs/" + video.videoID + ".jpg", (err, exists) => {
                            if (err) {
                                console.log(err);
                            }
                            if (!exists) {
                                //console.log(chalk.bgYellow.black("WARN! Video " + video.videoID + " has no thumbnail! Creating..."));
                                //savinu thumbnail
                                try {
                                    exec("ffmpeg -i '../../" + videoDir + video.videoID + video.extension + "' -ss 0 -vframes 1 '../../" + videoDir + "thumbs/" + video.videoID + ".jpg'", {
                                        cwd: __dirname
                                    }, function(error, stdout, stderr) {
                                        if (error) {
                                            console.log(error);
                                        }
                                    });
                                } catch (e) {
                                    console.log(chalk.bgYellow.black("WARN") + "failed to save thumbnail ");
                                }
                            }
                            done();
                        });
                    }

                ], function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            });


            fs.readdir(videoDir, (err, files) => {
                if (docs.length < files.length - 1) {
                    //console.log("WARN! Detected undeleted video files.");
                    if (files.includes(video.videoID + video.video.extension)) {

                    }
                }
                console.log(files);

                console.log(files.length - 1 + " vs this(in db): " + docs.length);
            });

            fs.readdir(videoDir + "thumbs/", (err, files) => {
                if (docs.length < files.length) {
                    //console.log("WARN! Detected undeleted video thumbnails.");
                }
                console.log(files.length + " vs this(in db): " + docs.length);
            });
        }
    });
}

module.exports = {
    preLaunch: preLaunch
}