const app = require("express")();
const fs = require("fs-extra");
const config = require("../config");
const db = require("./external/db.js");
const path = require("path");
const themes = require("../static/style/themes");

const { Router } = require("express");

let router = Router();

// video fetch route
app.get("/api/cv/:id", function(req, res) {
  log("FETCHING VIDEO | id: " + req.params.id, 0);

  let returner = genericResponseObject();
  returner.ratings = {};
  returner.userRatings = {};

  if (!req.params.id) {
    return res.json(genericErrorObject());
  }

  async.waterfall(
    [
      function(done) {
        //immedately calling an update, won't add a view if the video doesn't exist.
        db.videos.update(
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
          },
          function(err, numAffected, affectedDocument, upsert) {
            if (!affectedDocument) {
              log("FETCHING VIDEO | no such video!", 0);
              returner.meta.error = 1;
              return res.json(returner);
            }
            log(
              "FETCHING VIDEO | added a view to video " +
                affectedDocument.videoID,
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
            return done();
          }
        );
      },
      function(done) {
        //check if requested video exists
        let vidPath = path.resolve(
          "static",
          config.storagePath,
          req.params.id + returner.video.extension
        );

        if (returner.video && fs.existsSync(vidPath)) {
          return done();
        }
        //else just return it; no point in going forward
        return res.json(returner);
      },
      function(done) {
        if (req.body.user) {
          db.ratings.find(
            {
              username: req.body.user.username,
              videoID: req.params.id
            },
            {},
            function(err, docs) {
              if (docs.length > 2 || docs.length < 0) {
                log(
                  chalk.yellow("FETCHING VIDEO | RATING ERROR==========="),
                  1
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

              done();
            }
          );
        } else {
          log("FETCHING VIDEO | anonymous viewer", 0);
          done();
        }
      },
      function(done) {
        db.ratings.count(
          {
            action: 1, //like
            videoID: returner.video.videoID
          },
          function(err, count) {
            returner.ratings.likes = count;
            done();
          }
        );
      },
      function(done) {
        db.ratings.count(
          {
            action: 0, //dislike
            videoID: returner.video.videoID
          },
          function(err, count) {
            returner.ratings.dislikes = count;
            done();
          }
        );
      }
    ],
    function(err) {
      if (err) {
        log(err, 1);
      }
      return res.json(returner);
    }
  );
});

// post to actually change the password (both in-profile and token-based password reset)
app.patch("/api/changePassword", function(req, res) {
  log(
    "PASSWORD CHANGE || " + (req.body.resetType == 0 ? "normal" : "token"),
    0
  );

  let returner = genericResponseObject();
  // single route for both the standard password reset and the 'forgot password' token based reset
  if (req.body.resetType == 1) {
    //token reset
    let hashedPass = hashUpPass(req.body.newPass);
    // updating right away
    db.users.update(
      {
        resetToken: req.body.token,
        tokenExpiry: {
          $gt: Date.now()
        }
      },
      {
        $set: {
          password: hashedPass,
          tokenExpiry: 0
        }
      },
      {
        upsert: false,
        returnUpdatedDocs: true
      },
      function(err, numAffected, affectedDocs) {
        log("PASSWORD CHANGE || found the token", 0);
        if (numAffected == 0) {
          log("PASSWORD CHANGE || password was NOT successfully changed", 0);
          returner = genericErrorObject(
            "Password reset token is invalid or has expired."
          );
        } else if (numAffected > 1) {
          //shouldnt ever happen, severe edge
          log(
            chalk.bgRed.white("CRITICAL!") +
              "PASSWORD CHANGE || multiple passwords updated somehow",
            1
          );
        } else {
          //all ok
          log("PASSWORD CHANGE || password was successfully changed", 0);
          returner = genericResponseObject(
            "You have successfully changed your password!"
          );
          res.json(returner);
        }
      }
    );
  } else {
    // regular reset
    if (!req.session.authUser) {
      // cannot initiate password change without logging in
      returner = genericErrorObject("You are not authorized for this action.");
      res.json(returner);
    } else {
      // user is logged in
      // password checks
      async.waterfall(
        [
          function(done) {
            db.users.find(
              {
                username: req.session.authUser.username.toLowerCase()
              },
              function(err, docs) {
                done(null, docs[0]);
              }
            );
          },
          function(fetchedUser, done) {
            bcrypt.compare(
              req.body.currentPassword,
              fetchedUser.password,
              function(err, valid) {
                if (err) {
                  log("PASSWORD CHANGE || " + err, 1);
                } else {
                  done(null, valid);
                }
              }
            );
          },
          function(valid, done) {
            if (valid) {
              //all fine
              // hashing the new password
              let hashedPass = hashUpPass(req.body.newPassword);

              // changing the password
              db.users.update(
                {
                  email: req.session.authUser.email
                },
                {
                  $set: {
                    password: hashedPass
                  }
                },
                {
                  upsert: false
                },
                function(err) {
                  if (err) {
                    log("PASSWORD CHANGE || " + err, 1);
                  } else {
                    returner = genericResponseObject(
                      "You have successfully changed your password!"
                    );
                    done(null);
                  }
                }
              );
            } else {
              returner = genericErrorObject("Incorrect old password!");
              done(null);
            }
          }
        ],
        function(err) {
          if (err) {
            log("PASSWORD CHANGE || " + err, 1);
          } else {
            res.json(returner);
          }
        }
      );
    }
  }
});

app.get("/api/settings", function(req, res) {
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

module.exports = router;
