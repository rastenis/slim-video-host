const fs = require("fs-extra");
const path = require("path");
const config = require(path.resolve("config.json"));
const db = require(path.resolve("src", "external", "db.js"));
const themes = require(path.resolve("static", "style", "themes"));
const async = require("async");
const chalk = require("chalk");

const { Router } = require("express");

let router = Router();

let settings = require(path.resolve(config.dbPath, "system", "settings.json"));

// video fetch route
router.get("/api/cv/:id", function(req, res) {
  log("FETCHING VIDEO | id: " + req.params.id, 0);

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
    .then((numAffected, affectedDocument, upsert) => {
      if (!affectedDocument) {
        log("FETCHING VIDEO | no such video!", 0);
        returner.meta.error = 1;
        return res.json(returner);
      }
      log(
        "FETCHING VIDEO | added a view to video " + affectedDocument.videoID,
        0
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
              log(chalk.yellow("FETCHING VIDEO | RATING ERROR==========="), 1);
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
      log("FETCHING VIDEO | anonymous viewer", 0);
      return;
    })
    .then(() => {
      return db.ratings.count({
        action: 1, //like
        videoID: returner.video.videoID
      });
    })
    .then(() => {
      returner.ratings.likes = count;
      return db.ratings.count({
        action: 0, //dislike
        videoID: returner.video.videoID
      });
    })
    .then(() => {
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
    log("SETTINGS | no settings in db", 1);
  }

  return res.json(returner);
});

// password hashing function
function hashUpPass(pass) {
  var hash = bcrypt.hashSync(pass, 12);
  return hash;
}

// a base object for most api responses
function genericResponseObject(message) {
  return {
    meta: {
      error: false,
      msgType: "success",
      msg: message ? message : null
    }
  };
}

function genericErrorObject(message) {
  return {
    meta: {
      error: true,
      msgType: "error",
      msg: message ? message : "An error has occured."
    }
  };
}

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
