const config = require("../../config.json");
var Datastore = require("nedb");

module.exports = {
  users: new Datastore({
    filename: config.dbPath + "users",
    autoload: true
  }),
  codes: new Datastore({
    filename: config.dbPath + "codes",
    corruptAlertThreshold: 1 // headway manually pridetiems kodams
  }),
  videos: new Datastore({
    filename: config.dbPath + "videos",
    autoload: true
  }),
  ratings: new Datastore({
    filename: config.dbPath + "ratings",
    autoload: true
  })
};
