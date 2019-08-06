const fs = require("fs-extra");
const path = require("path");
const config = require(path.resolve("config.json"));
const maintenance = require(path.resolve("src", "external", "maintenance.js"));
const db = require(path.resolve("src", "external", "db.js"));
const themes = require(path.resolve("static", "style", "themes"));
const chalk = require("chalk");

// importing helpers
const logger = require(path.resolve("src", "helpers", "logger.js"));
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
    logger.e("Unauthorized attempt to access admin API.");
    return res.sendStatus(403);
  }
  return next();
};

router.post("/api/changeTheme", check, function(req, res) {
  logger.l("THEME CHANGE | requester: " + req.session.authUser.username);
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

router.post("/api/runMaintenance", check, function(req, res) {
  let returner = genericResponseObject();
  logger.l("RUN MAINTENANCE | requester: " + req.session.authUser.username);

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
router.get("/api/getAdminStats", check, function(req, res) {
  logger.l(
    "FETCHING ADMIN STATS | requester: " + req.session.authUser.username
  );
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
      logger.e(chalk.bgRed.white("FETCHING ADMIN STATS | " + e));
      returner.meta.error = 1;
      return res.json(returner);
    });
});

module.exports = router;
