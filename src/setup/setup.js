const jsonfile = require('jsonfile');
const chalk = require('chalk');
const prompt = require('prompt-sync')();
const configPath = 'config.json';

//base values (example config)
let config = {
    "file_path": "static/videos/",
    "host_prefix": "https://yourHostname.domain/v/",
    "total_space": 100000000000,
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
console.log(chalk.bold.bgYellow.black("                                                    "));
console.log(chalk.underline.bold.bgYellow.black("SUCCESS! Starting setup...                          "));
console.log(chalk.bold.bgYellow.black("                                                    "));

config.file_path = prompt('Enter video storage path (ENTER for default):', config.file_path);

console.log("Enter video link generation prefix,");
config.host_prefix = prompt('(Example: https://yourHostname.domain/):');

config.total_space = prompt('Enter total space in bytes (ENTER for 100GB as default):', config.total_space);

config.mail.username = prompt('Enter gmail username:');

config.mail.password = prompt('Enter gmail password:', null, { echo: "*" });

console.log(chalk.bold.bgYellow.black("                                                    "));
console.log(chalk.underline.bold.bgYellow.black("SETUP DONE!                                         "));
console.log(chalk.bold.bgYellow.black("                                                    "));

jsonfile.writeFileSync(configPath, config);