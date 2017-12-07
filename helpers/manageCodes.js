var Datastore = require('nedb');
var chalk = require('chalk');
var prompt = require('prompt-sync')();

db = {};
db.codes = new Datastore({
    filename: 'db/codes',
    autoload: true
});

var end = false;
while (!end) {
    console.log(chalk.bgCyan.black("========CODE MANAGER========"));
    console.log("1. Add code");
    console.log("2. Remove code");
    console.log("3. Update 'active' state of a specific code");
    console.log("ENTER. Exit.");

    var choice = prompt('choose:');


    switch (choice) {
        case "1":
            var code = prompt('enter code:');
            var space = prompt('enter space ammount in MB:');
            var typeBool = prompt('enter type (0 for initial, 1 for upgrade):');
            type = (typeBool ? "upgrade" : "initial");
            db.codes.insert({ code: code, space: space, type: type, active: true }, {});
            console.log(chalk.green("DONE!"));
            break;
        case "2":
            var code = prompt('enter code:');
            db.codes.remove({ code: code }, {});
            console.log(chalk.green("DONE!"));
            break;
        case "3":
            var code = prompt('enter code:');
            var active = prompt('enter state(0 for inactive, 1 for active):');
            db.codes.update({ code: code }, { $set: { active: active } }, {});
            console.log(chalk.green("DONE!"));
            break;
        case "":
            end = true;
            console.log(chalk.green("BYE!"));
            break;
        default:
            break;
    }
}

process.exit(0);