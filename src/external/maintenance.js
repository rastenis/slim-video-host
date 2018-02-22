const fs = require('fs-extra');
var db = require('../external/db.js');
const jsonfile = require('jsonfile');
const du = require('du');
const chalk = require('chalk');
const async = require('async');
const exec = require('child_process').exec;

// custom array diff prototype
Array.prototype.diff = function(a) {
    return this.filter(function(i) {
        return a.indexOf(i) < 0;
    });
};

function preLaunch(config) {

    // make sure the designated video directory is up
    fs.ensureDir(config.file_path, err => {
        if (err) {
            console.log(err);
        }
    });

    // thumbnail dir too
    fs.ensureDir(config.file_path + "thumbs/", err => {
        if (err) {
            console.log(err);
        }
    });

    du(config.file_path, function(err, size) {
        if (size >= config.total_space) {
            console.log("WARNING! Max space exceeded!");
        }
    });

    // checking if settings exist & creating them if not
    try {
        let settings = require(config.db_path + 'system/settings.json');
        if (settings !== undefined || settings.theme !== undefined) {
            // settings in place!
        }

    } catch (e) {
        // overwrite w/ defaults

        let defaults = {
            "theme": 0
        };

        jsonfile.writeFileSync(config.db_path + 'system/settings.json', defaults);
    }

    let videoNames = [],
        thumbnailNames = [];

    // checking through all thumbnails & the videos themselves
    db.videos.find({}, function(err, docs) {
        if (err) {
            console.log(err);
        } else {
            docs.forEach((video) => {

                // adding for further cleaning
                videoNames.push(video.videoID + video.extension);
                thumbnailNames.push(video.videoID + ".jpg");

                async.waterfall([
                    function(done) {
                        fs.pathExists(config.file_path + video.videoID + video.extension, (err, exists) => {
                            if (err) {
                                console.log(err);
                            }
                            if (!exists) {
                                //console.log(chalk.bgRed.black("ERROR! Video " + video.videoID + " has no file! Deleting..."));
                                db.videos.remove({
                                    videoID: video.videoID
                                }, {}, function(err) {
                                    if (err) {
                                        console.log(err);
                                    }
                                });
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.pathExists(config.file_path + "thumbs/" + video.videoID + ".jpg", (err, exists) => {
                            if (err) {
                                console.log(err);
                            }
                            if (!exists) {
                                //console.log(chalk.bgYellow.black("WARN! Video " + video.videoID + " has no thumbnail! Creating..."));
                                //savinu thumbnail
                                try {
                                    exec("ffmpeg -i '../../" + config.file_path + video.videoID + video.extension + "' -ss 0 -vframes 1 '../../" + config.file_path + "thumbs/" + video.videoID + ".jpg'", {
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

            fs.readdir(config.file_path, (err, files) => {
                if (docs.length < files.length - 1) {
                    //console.log("WARN! Detected undeleted video files.");

                    // leaving the thumbs dir alone
                    let index = files.indexOf("thumbs");
                    files.splice(index, 1);

                    let difference = files.diff(videoNames);
                    if (difference.length != 0) {
                        difference.forEach((item) => {
                            //removing unneeded
                            fs.unlink(config.file_path + item, function(err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                        });
                    }
                }
            });
            fs.readdir(config.file_path + "thumbs/", (err, files) => {
                if (docs.length < files.length) {
                    //console.log("WARN! Detected undeleted video thumbnails.");

                    let difference = files.diff(thumbnailNames);
                    if (difference.length != 0) {
                        difference.forEach((item) => {
                            //removing unneeded
                            fs.unlink(config.file_path + "thumbs/" + item, function(err) {
                                if (err) {
                                    console.log(err);
                                }
                            });
                        });
                    }
                }
            });
        }
    });
}

module.exports = {
    preLaunch: preLaunch
}