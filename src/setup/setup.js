const chalk = require("chalk");
const prompt = require("prompt-sync")({ sigint: true });
const figlet = require("figlet");
const crypto = require("crypto");
const path = require("path");

const fs = require("fs-extra");

const configPath = "config.json";

//base values (example config)
let config = require(path.resolve("configExample.json"));
// all of this will be more or less sync

// outputting intro splash
console.log(
  chalk.yellow(
    figlet.textSync("slim-video-host", {
      font: "Doom",
      horizontalLayout: "default",
      verticalLayout: "default"
    })
  )
);

console.log(
  chalk.bgYellow.black("                                                    ")
);
console.log(
  chalk.bgYellow.black("Starting setup...                                   ")
);
console.log(
  chalk.bgYellow.black("                                                    ")
);

config.spaceLimit =
  prompt("Enter total space in bytes (100GB): ", 100) * 1000000000;

config.storagePath = prompt(
  `Enter video storage path (${config.storagePath}): `,
  config.storagePath
);

config.mail.username = prompt(`Enter gmail username:`);
config.mail.password = prompt(`Enter gmail password: `, null, { echo: "*" });

config.productionLogging = prompt(
  "Select production logging mode [all/error/none] (none): ",
  config.productionLogging
);

config.infiniteSessions =
  prompt(
    "Should infinite sessions be allowed when logging in? (Y/n): ",
    "Y"
  ).toUpperCase() == "Y"
    ? true
    : false;

config.host = prompt(`Enter host url (${config.host}):`, config.host);

config.selfHosted =
  prompt(
    "Enable TLS certificate generation? (will require ports 80 and 443) (y/N): ",
    "N"
  ).toUpperCase() == "Y"
    ? true
    : false;

if (config.selfHosted) {
  console.log(chalk.yellow("Showing additional TLS options:"));
  config.tls.email = prompt("Enter Letsencrypt email (your email): ");
  config.tls.tos =
    prompt(
      "Do you agree with the Letsencrypt TOS? (y/N): ",
      "N"
    ).toUpperCase() == "Y"
      ? true
      : false;
  if (!config.tls.tos) {
    config.selfHosted = false;
    console.log(chalk.yellow("Reverting..."));
  } else {
    let current = 0;
    while (true) {
      config.tls.domains[current] = prompt(
        "Please enter domain " + (current + 1) + " (ENTER to cancel): "
      );
      if (config.tls.domains[current] == "") {
        config.tls.domains.splice(current, 1);
        break;
      } else {
        current++;
      }
    }
  }
} else {
  config.port = prompt(`Enter port (${config.port}): `, config.port);
}

console.log("Finished!");
console.log("Writing config...");
fs.writeJSONSync(configPath, config);

// base system settings
console.log("Writing base system settings...");
fs.ensureDirSync(path.resolve(config.dbPath, "system"));
console.log("Generating session secret...");

fs.writeJSONSync(path.resolve(config.dbPath, "system", "settings.json"), {
  theme: 0,
  ss: crypto.randomBytes(23).toString("hex")
});

console.log(
  chalk.bgYellow.black("                                                    ")
);
console.log(
  chalk.bgYellow.black.bold(
    "SETUP DONE!                                         "
  )
);
console.log(
  chalk.bgYellow.black("                                                    ")
);
