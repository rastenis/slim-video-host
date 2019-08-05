const Datastore = require("nedb-promises");
const chalk = require("chalk");
const prompt = require("prompt-sync")({});

let db = {};
db.codes = Datastore.create({
  filename: "db/codes",
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

  let choice = prompt("choose:");

  switch (choice) {
    case "1":
      let code = prompt("enter code:");
      let space = prompt("enter space ammount in GB:");
      let typeBool = prompt(
        "enter type (0 for registration code, 1 for upgrade code):"
      );
      type = typeBool ? "upgrade" : "reg";
      db.codes
        .insert({
          code: code,
          space: parseFloat(space) * 1000,
          type: type,
          benefit: 0,
          active: true
        })
        .then(() => {
          console.log(
            chalk.green("DONE! Code ") +
              chalk.yellow(code) +
              chalk.green(" inserted!")
          );
        })
        .catch(e => {
          console.error(e);
        });
      break;
    case "2":
      let code = prompt("enter code:");
      let typeBool = prompt(
        "enter type (0 for registration code, 1 for upgrade code):"
      );
      type = typeBool ? "upgrade" : "reg";
      db.codes
        .insert({
          code: code,
          space: null,
          type: type,
          benefit: 1,
          active: true
        })
        .then(() => {
          console.log(
            chalk.green("DONE! Code ") +
              chalk.yellow(code) +
              chalk.green(" inserted!")
          );
        })
        .catch(e => {
          console.error(e);
        });

      break;
    case "3":
      let code = prompt("enter code:");
      db.codes.remove({ code: code }, {});
      console.log(chalk.green("DONE!"));
      break;
    case "4":
      let code = prompt("enter code:");
      let active = prompt("enter state (0 for inactive, 1 for active):");
      db.codes.update(
        { code: code },
        { $set: { active: Boolean(active) } },
        {}
      );
      console.log(chalk.green("DONE!"));
      break;
    case "5":
      let code = prompt("enter code:");
      db.codes.insert({
        code: code,
        space: null,
        type: "upgrade",
        benefit: 2,
        active: true
      });
      console.log(chalk.green("DONE!"));
      break;
    case "":
      console.log("finishing up....");
      break mainLoop;
    default:
      break;
  }
}

setTimeout(() => {
  console.log(chalk.green("BYE!"));
  process.exit(0);
}, 1000);
