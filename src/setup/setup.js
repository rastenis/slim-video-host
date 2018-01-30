const jsonfile = require('jsonfile');
const chalk = require('chalk');
const configPath = 'config.json';

//base values (example config)
let config = {
    "file_path": "static/videos/",
    "session_key": "very-secret-super-secure-key",
    "video_link_prefix": "https://yourHostname.domain/v/",
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
console.log(chalk.bold.bgYellow.black("                          "));
console.log(chalk.underline.bold.bgYellow.black("SUCCESS! Starting setup..."));
console.log(chalk.bold.bgYellow.black("                          "));


jsonfile.writeFileSync(file, obj);