const Datastore = require('nedb');
const chalk = require('chalk');
const prompt = require('prompt-sync')({sigint:true});

var db = {};
db.codes = new Datastore({
    filename: '../db/codes',
    autoload: true,
    corruptAlertThreshold: 0.5 //added for testing
});


mainLoop: while (true) {
    console.log(chalk.bgCyan.black("========CODE MANAGER========"));
    console.log("1. Add code for storage space");
    console.log("2. Add code for admin status");
    console.log("3. Remove code");
    console.log("4. Update 'active' state of a specific code");
    console.log("ENTER. Exit.");

    var choice = prompt('choose:');

    switch (choice) {
        case "1":
            var code = prompt('enter code:');
            var space = prompt('enter space ammount in GB:');
            var typeBool = prompt('enter type (0 for registration code, 1 for upgrade code):');
            type = (typeBool ? "upgrade" : "reg");
            db.codes.insert({ code: code, space: parseFloat(space) * 1000, type: type, benefit: 0, active: true }, function(err) {
                if (err) {
                    console.log(err);
                }
            });
            console.log(chalk.green("DONE! Code ") + chalk.yellow(code) + chalk.green(" inserted!"));
            break;
        case "2":
            var code = prompt('enter code:');
            var typeBool = prompt('enter type (0 for registration code, 1 for upgrade code):');
            type = (typeBool ? "upgrade" : "reg");
            db.codes.insert({ code: code, space: null, type: type, benefit: 1, active: true }, function(err) {
                if (err) {
                    console.log(err);
                }
            });
            console.log(chalk.green("DONE! Code ") + chalk.yellow(code) + chalk.green(" inserted!"));
            break;
        case "3":
            var code = prompt('enter code:');
            db.codes.remove({ code: code }, {});
            console.log(chalk.green("DONE!"));
            break;
        case "4":
            var code = prompt('enter code:');
            var active = prompt('enter state (0 for inactive, 1 for active):');
            db.codes.update({ code: code }, { $set: { active: active } }, {});
            console.log(chalk.green("DONE!"));
            break;
        case "":
            console.log(chalk.green("BYE!"));
            break mainLoop;
            break;
        default:
            break;
    }
}

process.exit(0);