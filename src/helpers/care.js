const chalk = require('chalk');
const prompt = require('prompt-sync')({});
var maintenance = require('../external/maintenance.js');
const fs = require('fs-extra');
const config = require('../../config');
const async = require('async');


mainLoop: while (true) {
    console.log(chalk.bgCyan.black("========MAINTENANCE========"));
    console.log("1. Perform maintenance");
    console.log("2. " + chalk.red("Delete all data (FULL RESET)"));
    console.log("ENTER. Exit.");

    let choice = prompt('choose:');

    switch (choice) {
        case "1":
            maintenance.preLaunch(config.file_path);
            console.log(chalk.green("DONE! Maintenance launched!"));
            break;
        case "2":
            let conf = prompt('Are you sure? This is irreversible!(1=yes,0=no):');
            if (conf === "1") {
                let path = "../../" + config.file_path;

                async.waterfall([
                    function(done) {
                        //removing all videos + thumbnails
                        fs.remove(path, err => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('Wiped videos + thumbnails...');
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.remove("../../db", err => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('Wiped databases...');
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.remove("../../config.json", err => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('Wiped configuration...');
                            }
                            done();
                        });
                    }
                ], function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            }
            break;
        case "":
            console.log("finishing up....");
            break mainLoop;
            break;

        default:
            break;
    }
}

setTimeout(() => {
    // slight buffer
    console.log(chalk.green("BYE!"));
    process.exit(0);

}, 1000);