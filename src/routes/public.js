const fs = require("fs-extra");
const path = require("path");
const config = require(path.resolve("config.json"));
const db = require(path.resolve("src", "external", "db.js"));
const themes = require(path.resolve("static", "style", "themes"));
const chalk = require("chalk");

// importing helpers
const logger = require(path.resolve("src", "helpers", "logger.js"));
const { genericResponseObject, genericErrorObject } = require(path.resolve(
  "src",
  "helpers",
  "responses.js"
));

const { Router } = require("express");

let router = Router();

let settings = require(path.resolve(config.dbPath, "system", "settings.json"));

// video fetch route
router.get("/api/cv/:id", function(req, res) {
  logger.l("FETCHING VIDEO | id: " + req.params.id);

  let returner = genericResponseObject();
  returner.ratings = {};
  returner.userRatings = {};

  if (!req.params.id) {
    return res.json(genericErrorObject());
  }

  db.videos
    .update(
      {
        videoID: req.params.id
      },
      {
        $inc: {
          views: 1
        }
      },
      {
        returnUpdatedDocs: true,
        multi: false
      }
    )
    .then(affectedDocument => {
      if (!affectedDocument) {
        logger.l("FETCHING VIDEO | no such video!");
        returner.meta.error = 1;
        return res.json(returner);
      }
      logger.l(
        "FETCHING VIDEO | added a view to video " + affectedDocument.videoID
      );
      affectedDocument.src =
        "/" +
        config.storagePath +
        "/" +
        req.params.id +
        affectedDocument.extension;
      //removing traces of the user that uploaded
      delete affectedDocument.username;

      returner.video = affectedDocument;

      let vidPath = path.resolve(
        "static",
        config.storagePath,
        req.params.id + returner.video.extension
      );

      // video does not exist.
      if (!returner.video || !fs.existsSync(vidPath)) {
        return res.json(returner);
      }

      // logged in viewer.
      if (req.body.user) {
        return db.ratings
          .find(
            {
              username: req.body.user.username,
              videoID: req.params.id
            },
            {}
          )
          .then(docs => {
            if (docs.length > 2 || docs.length < 0) {
              logger.e(
                chalk.yellow("FETCHING VIDEO | RATING ERROR===========")
              );
            }
            returner.userRatings.liked = false;
            returner.userRatings.disliked = false;

            //assigning likes/dislikes
            docs.forEach(doc => {
              if (doc.action == 0) {
                //disliked
                returner.userRatings.disliked = true;
              } else if (doc.action == 1) {
                returner.userRatings.liked = true;
              }
            });

            return null;
          });
      }
      // anonymous viewer.
      logger.l("FETCHING VIDEO | anonymous viewer");
      return db.ratings.count({
        action: 1, //like
        videoID: returner.video.videoID
      });
    })
    .then(count => {
      returner.ratings.likes = count;
      return db.ratings.count({
        action: 0, //dislike
        videoID: returner.video.videoID
      });
    })
    .then(count => {
      returner.ratings.dislikes = count;
      return res.json(returner);
    });
});

router.get("/api/settings", function(req, res) {
  let returner = genericResponseObject();

  // settings fetch
  if (settings.theme !== null) {
    returner.settings = {};
    returner.settings.theme = themes[settings.theme];
    returner.settings.themeID = settings.theme;
  } else {
    logger.l("SETTINGS | no settings in db");
  }

  return res.json(returner);
});

module.exports = router;
