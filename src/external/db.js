const config = require('../../config.json');
var Datastore = require('nedb');


module.exports = {
    users: new Datastore({
        filename: config.databases.db_users_path,
        autoload: true
    }),
    codes: new Datastore({
        filename: config.databases.db_codes_path,
        autoload: true,
        corruptAlertThreshold: 1 // headway manually pridetiems kodams
    }),
    videos: new Datastore({
        filename: config.databases.db_videos_path,
        autoload: true
    }),
    ratings: new Datastore({
        filename: config.databases.db_ratings_path,
        autoload: true
    }),
    settings: new Datastore({
        filename: config.databases.db_settings_path,
        autoload: true
    })
}