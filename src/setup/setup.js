const jsonfile = require("jsonfile");
const chalk = require("chalk");
const prompt = require("prompt-sync")({ sigint: true });
const configPath = "config.json";
const figlet = require("figlet");
const crypto = require("crypto");
const fs = require("fs-extra");

//base values (example config)
let config = require("../../configExample.json");
// all of this will be more or less sync

// outputting intro splash
console.log(
  chalk.yellow(
    figlet.textSync("S-VidHost", {
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
  chalk.bgYellow.black("SUCCESS! Starting setup...                          ")
);
console.log(
  chalk.bgYellow.black("                                                    ")
);

config.file_path = prompt(
  "Enter video storage path (ENTER for default): ",
  config.file_path
);

config.total_space = prompt(
  "Enter total space in bytes (ENTER for 100GB as default): ",
  config.total_space
);

config.mail.username = prompt("Enter gmail username: ");

config.mail.password = prompt("Enter gmail password: ", null, { echo: "*" });

config.production_logging = prompt(
  "Select production logging mode (all/error/none): ",
  config.production_logging
);

config.infinite_sessions = prompt(
  "Should infinite sessions be allowed when logging in? (1:yes, 0:no): ",
  config.infinite_sessions
);

console.log("Enter video link generation prefix,");
config.host_prefix = prompt("(Example: " + config.host_prefix + "): ");

config.self_hosted = prompt(
  "Independant TLS? (will require ports 80 and 443) (1:yes, 0:no): "
);

if (config.self_hosted == "1") {
  console.log(chalk.yellow("Showing additional TLS options:"));
  config.tls.email = prompt("Enter Letsencrypt email (your email): ");
  config.tls.agree_tos = prompt(
    "Do you agree with the Letsencrypt TOS? (1:yes, 0:no): "
  );
  if (config.tls.agree_tos == "0") {
    config.self_hosted = false;
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
  config.port = prompt("Enter port (ENTER for default 10700): ", config.port);
}

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

jsonfile.writeFileSync(configPath, config);

// base system settings
fs.ensureDirSync(config.db_path + "system/");
jsonfile.writeFileSync(config.db_path + "system/settings.json", {
  theme: 0,
  ss: crypto.randomBytes(23).toString("hex")
});
