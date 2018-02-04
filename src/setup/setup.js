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
    "production_logging": 'none',
    "self_hosted": true,
    "tls": {
        "email": "email@example.com",
        "domains": ["domain1.com", "domain2.com"]
    },
    "mail": {
        "username": "something@gmail.com",
        "password": "password"
    },
    "databases": {
        "db_users_path": "db/users",
        "db_videos_path": "db/videos",
        "db_codes_path": "db/codes",
        "db_ratings_path": "db/ratings"
    }
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



console.log(chalk.bgYellow.black("                                                    "));
console.log(chalk.bgYellow.black.bold("SETUP DONE!                                         "));
console.log(chalk.bgYellow.black("                                                    "));

jsonfile.writeFileSync(configPath, config);