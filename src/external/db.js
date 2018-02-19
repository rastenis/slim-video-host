const config = require('../../config.json');
var Datastore = require('nedb');


module.exports = {
    users: new Datastore({
        filename: config.db_path + "users",
        autoload: true
    }),
    codes: new Datastore({
        filename: config.db_path + "codes",
        autoload: true,
        corruptAlertThreshold: 1 // headway manually pridetiems kodams
    }),
    videos: new Datastore({
        filename: config.db_path + "videos",
        autoload: true
    }),
    ratings: new Datastore({
        filename: config.db_path + "ratings",
        autoload: true
    }),
    settings: new Datastore({
        filename: config.db_path + "settings",
        autoload: true
    })
}