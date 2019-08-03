const config = require("../../config.json");
var Datastore = require("nedb");
var path = require("path");

module.exports = {
  users: new Datastore({
    filename: path.resolve(config.dbPath, "users"),
    autoload: true
  }),
  codes: new Datastore({
    filename: path.resolve(config.dbPath, "codes"),
    corruptAlertThreshold: 1 // headway manually pridetiems kodams
  }),
  videos: new Datastore({
    filename: path.resolve(config.dbPath, "videos"),
    autoload: true
  }),
  ratings: new Datastore({
    filename: path.resolve(config.dbPath, "ratings"),
    autoload: true
  })
};
