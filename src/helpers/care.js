const chalk = require("chalk");
const prompt = require("prompt-sync")({});
const fs = require("fs-extra");
const path = require("path");

const config = require(path.resolve("config.json"));

mainLoop: while (true) {
  console.log(" ");
  console.log(chalk.bgCyan.black("========MAINTENANCE========"));
  console.log("1. Perform maintenance");
  console.log("2. " + chalk.red("Delete all data (FULL RESET)"));
  console.log("ENTER. Exit.");

  let choice = prompt("choose:");

  switch (choice) {
    case "1":
      require(path.resolve("src", "external", "maintenance.js")).preLaunch(
        config
      );
      console.log(chalk.green("DONE! Maintenance launched!"));
      break;
    case "2":
      let conf =
        prompt(
          "Are you sure? This is irreversible! (y/N):",
          "N"
        ).toUpperCase() == "Y";
      if (!conf) {
        break;
      }
      // removing everything
      fs.remove(path.resolve(config.storagePath))
        .then(() => {
          console.log("Wiped videos + thumbnails...");
          return fs.remove(path.resolve(config.dbPath));
        })
        .then(() => {
          console.log("Wiped databases...");
          return fs.remove(path.resolve(".nuxt"));
        })
        .then(() => {
          console.log("Wiped nuxt build data...");
          return fs.remove(path.resolve("tmp"));
        })
        .then(() => {
          console.log("Wiped certs...");
          return fs.remove(path.resolve("config.json"));
        })
        .then(() => {
          console.log("Wiped configuraton...");
          console.log("FINISHED! Leaving maintenance....");
          leave();
        })
        .catch(e => {
          console.log(e);
        });
      break mainLoop;
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
