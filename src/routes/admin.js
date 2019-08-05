const fs = require("fs-extra");
const path = require("path");
const config = require(path.resolve("config.json"));
const maintenance = require(path.resolve("src", "external", "maintenance.js"));

const db = require(path.resolve("src", "external", "db.js"));
const themes = require(path.resolve("static", "style", "themes"));
const chalk = require("chalk");

const { genericResponseObject } = require(path.resolve(
  "src",
  "helpers",
  "responses.js"
));

const { Router } = require("express");

let router = Router();

let settings = require(path.resolve(config.dbPath, "system", "settings.json"));

// reject if the user is not signed in
const check = (req, res, next) => {
  if (!req.session.authUser || req.session.authUser.userStatus != 1) {
    console.error("Unauthorized attempt to access admin API.");
    return res.sendStatus(403);
  }
  return next();
};

router.post("/api/changeTheme", check, function(req, res) {
  log("THEME CHANGE | requester: " + req.session.authUser.username, 0);
  // only signed in admins
  let returner = genericResponseObject();

  settings.theme = req.body.newTheme;
  fs.writeJSONSync(
    path.resolve(config.dbPath, "system", "settings.json"),
    settings
  );

  // return updated settings
  returner.newSettings = {};
  returner.newSettings = req.body.settings;
  returner.newSettings.theme = themes[req.body.newTheme];
  returner.newSettings.themeID = req.body.newTheme;
  returner.meta.msg = "You have successfully changed the theme!";

  return res.json(returner);
});

router.post("/api/runMaintenance", function(req, res) {
  let returner = genericResponseObject();
  log("RUN MAINTENANCE | requester: " + req.session.authUser.username, 0);

  try {
    maintenance.preLaunch(config);
    returner.meta.msg = "Maintenance successfully started!";
    return res.json(returner);
  } catch (e) {
    returner.meta.msg = "Couldn't start maintenance! " + e;
    return res.json(returner);
  }
});

// postas adminu statistikom
router.get("/api/getAdminStats", function(req, res) {
  log("FETCHING ADMIN STATS | requester: " + req.session.authUser.username, 0);
  let returner = genericResponseObject();
  returner.stats = {};

  db.users
    .count({})
    .then(count => {
      returner.stats.userCount = count;
      return db.videos.find({});
    })
    .then(videos => {
      returner.stats.videoCount = videos.length;

      let totalViews = 0,
        usedSpace = 0;

      // counting video views and total space used
      videos.forEach(video => {
        totalViews += video.views;
        usedSpace += Math.abs(video.size);
      });

      returner.stats.totalViews = totalViews;
      returner.stats.totalSpaceA = config.spaceLimit;
      returner.stats.usedSpaceA = usedSpace.toFixed(2);
      returner.videos = videos;

      return res.json(returner);
    })
    .catch(e => {
      log(chalk.bgRed.white("FETCHING ADMIN STATS | " + e), 1);
      returner.meta.error = 1;
      return res.json(returner);
    });
});

// logger
function log(message, type) {
  if (
    config.productionLogging === "all" ||
    process.env.NODE_ENV !== "production"
  ) {
    console.log(message);
  } else if (config.productionLogging === "error" && type === 1) {
    console.log(message);
  }
}

module.exports = router;
