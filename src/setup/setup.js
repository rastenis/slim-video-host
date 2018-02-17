const jsonfile = require('jsonfile');
const chalk = require('chalk');
const prompt = require('prompt-sync')({ sigint: true });
const configPath = 'config.json';
const figlet = require('figlet');

//base values (example config)
let config = {
    "file_path": "static/videos/",
    "host_prefix": "https://yourHostname.domain/v/",
    "total_space": 100000000000,
    "production_logging": "none",
    "self_hosted": "0",
    "port": 10700,
    "tls": {
        "email": "email@example.com",
        "domains": ["domain1.com", "domain2.com"]
    },
    "mail": {
        "username": "something@gmail.com",
        "password": "password"
    },
    "db_path": "db/"
};

// all of this will be more or less sync

// outputting intro splash
console.log(chalk.yellow(figlet.textSync('S-VidHost', {
    font: 'Doom',
    horizontalLayout: 'default',
    verticalLayout: 'default'
})));

console.log(chalk.bgYellow.black("                                                    "));
console.log(chalk.bgYellow.black("SUCCESS! Starting setup...                          "));
console.log(chalk.bgYellow.black("                                                    "));

config.file_path = prompt('Enter video storage path (ENTER for default): ', config.file_path);

config.total_space = prompt('Enter total space in bytes (ENTER for 100GB as default): ', config.total_space);

config.mail.username = prompt('Enter gmail username: ');

config.mail.password = prompt('Enter gmail password: ', null, { echo: "*" });

config.production_logging = prompt('Select production logging mode (all/error/none): ');


console.log("Enter video link generation prefix,");
config.host_prefix = prompt('(Example: https://yourHostname.domain/): ');

config.self_hosted = prompt('Independant TLS? (will require ports 80 and 443) (1:yes, 0:no): ');

if (config.self_hosted == "1") {
    console.log(chalk.yellow("Showing additional TLS options:"));
    config.tls.email = prompt('Enter Letsencrypt email (your email): ');
    config.tls.agree_tos = prompt('Do you agree with the Letsencrypt TOS? (1:yes, 0:no): ');
    if (config.tls.agree_tos == "0") {
        config.self_hosted = false;
        console.log(chalk.yellow("Reverting..."));
    } else {
        let current = 0;
        while (true) {
            config.tls.domains[current] = prompt('Please enter domain ' + (current + 1) + ' (ENTER to cancel): ');
            if (config.tls.domains[current] == "") {
                config.tls.domains.splice(current, 1)
                break;
            } else {
                current++;
            }
        }
    }
} else {
    config.tls.port = prompt('Enter port (ENTER for default 10700): ', config.port);
}

console.log(chalk.bgYellow.black("                                                    "));
console.log(chalk.bgYellow.black.bold("SETUP DONE!                                         "));
console.log(chalk.bgYellow.black("                                                    "));

jsonfile.writeFileSync(configPath, config);