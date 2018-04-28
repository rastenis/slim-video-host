const Datastore = require('nedb');
const chalk = require('chalk');
const prompt = require('prompt-sync')({});

var db = {};
db.codes = new Datastore({
    filename: 'db/codes',
    autoload: true,
    corruptAlertThreshold: 1
});


mainLoop: while (true) {
    console.log(chalk.bgCyan.black("========CODE MANAGER========"));
    console.log("1. Add code - storage space");
    console.log("2. Add code - admin status");
    console.log("3. Remove code");
    console.log("4. Update 'active' state of a specific code");
    console.log("5. Add code - account standing reset");
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
            db.codes.update({ code: code }, { $set: { active: Boolean(active) } }, {});
            console.log(chalk.green("DONE!"));
            break;
        case "5":
            var code = prompt('enter code:');
            db.codes.insert({ code: code, space: null, type: "upgrade", benefit: 2, active: true }, function(err) {
                if (err) {
                    console.log(err);
                }
            });
            console.log(chalk.green("DONE!"));
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
    console.log(chalk.green("BYE!"));
    process.exit(0);

}, 1000);