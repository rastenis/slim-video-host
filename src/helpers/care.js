const chalk = require('chalk');
const prompt = require('prompt-sync')({});
const fs = require('fs-extra');
const async = require('async');

const config = require('../../config');


mainLoop: while (true) {
    console.log(" ");
    console.log(chalk.bgCyan.black("========MAINTENANCE========"));
    console.log("1. Perform maintenance");
    console.log("2. " + chalk.red("Delete all data (FULL RESET)"));
    console.log("ENTER. Exit.");

    let choice = prompt('choose:');

    switch (choice) {
        case "1":
            require('../external/maintenance.js').preLaunch(config);
            console.log(chalk.green("DONE! Maintenance launched!"));
            break;
        case "2":
            let conf = prompt('Are you sure? This is irreversible!(1=yes,0=no):');
            if (conf === "1") {

                async.waterfall([
                    function(done) {
                        //removing all videos + thumbnails
                        fs.remove(config.file_path, err => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('Wiped videos + thumbnails...');
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.remove("./db", err => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('Wiped databases...');
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.remove("./.nuxt", err => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('Wiped nuxt build...');
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.remove("./tmp", err => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('Wiped certs...');
                            }
                            done();
                        });
                    },
                    function(done) {
                        fs.remove("config.json", err => {
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
                    console.log("FINISHED! Leaving maintenance....");
                    leave();
                });
                break mainLoop;
            }
            break;
        case "":
            console.log("finishing up....");
            break mainLoop;
            leave();
            break;

        default:
            break;
    }
}


function leave() {
    setTimeout(() => {
        // slight buffer
        console.log(chalk.green("BYE!"));
        process.exit(0);

    }, 1000);
}