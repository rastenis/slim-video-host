const fs = require('fs-extra');


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


}

module.exports = {
    preLaunch: preLaunch
}