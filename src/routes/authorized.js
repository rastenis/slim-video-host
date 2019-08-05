const fs = require("fs-extra");
const du = require("du");
const path = require("path");
const config = require(path.resolve("config.json"));
const db = require(path.resolve("src", "external", "db.js"));
const extractFrames = require("ffmpeg-extract-frames");
const async = require("async");
const chalk = require("chalk");
const bcrypt = require("bcrypt");

const { genericResponseObject, genericErrorObject } = require(path.resolve(
  "src",
  "helpers",
  "responses.js"
));

const { Router } = require("express");

let router = Router();

// reject if the user is not signed in
const check = (req, res, next) => {
  if (!req.session.authUser) {
    return res.status(403).json(genericErrorObject("Unauthorized."));
  }
  return next();
};

// route for video actions (like/dislike)
router.put("/api/act", function(req, res) {
  //ignore unauthorized acts
  if (!req.session.authUser) {
    return;
  }

  log("ACT | requester: " + req.session.authUser.username, 0);
  async.waterfall(
    [
      function(done) {
        db.ratings.find(
          {
            username: req.session.authUser.username,
            videoID: req.body.videoID
          },
          function(err, docs) {
            if (docs.length > 2 || docs.length < 0) {
              log(chalk.bgRed.white("CRITICAL!") + "ACT | rating error.", 1);
            }
            let userRatings = {};
            userRatings.liked = false;
            userRatings.disliked = false;

            // assigning likes/dislikes
            docs.forEach(doc => {
              if (doc.action == 0) {
                // disliked
                userRatings.disliked = true;
              } else if (doc.action == 1) {
                userRatings.liked = true;
              }
            });
            done(null, userRatings);
          }
        );
      },
      function(userRatings, done) {
        let prep = {};
        prep.action = req.body.action;
        prep.revert = false;
        if (prep.action) {
          // like
          if (userRatings.liked) {
            // revert
            prep.revert = true;
            prep.increment = -1;
          } else {
            // just like
            prep.increment = 1;
          }
        } else {
          // dislike
          if (userRatings.disliked) {
            // revert
            prep.revert = true;
            prep.increment = -1;
          } else {
            // just dislike
            prep.increment = 1;
          }
        }
        // updating rating DB
        if (prep.revert) {
          db.ratings.remove(
            {
              username: req.session.authUser.username,
              videoID: req.body.videoID,
              action: prep.action
            },
            {},
            function(err) {
              if (err) {
                log("ACT | " + err, 1);
              }
              done();
            }
          );
        } else {
          db.ratings.insert(
            {
              username: req.session.authUser.username,
              videoID: req.body.videoID,
              action: prep.action
            },
            function(err) {
              if (err) {
                log("ACT | " + err, 1);
              }
              done();
            }
          );
        }
      }
    ],
    function(err) {
      if (err) {
        log("ACT | " + err, 1);
      }
    }
  );
});

// route for getting user's videos
router.get("/api/dash", function(req, res) {
  let returner = genericResponseObject();

  log("DASH | requester : " + req.session.authUser.username, 0);

  // refreshing user data and getting videos
  db.users
    .findOne({ _id: req.session.authUser._id })
    .then(user => {
      req.ression.authUser = user;
      return db.videos.find({
        username: req.session.authUser.username.toLowerCase()
      });
    })
    .then(docs => {
      if (docs.length === 0) {
        return res.json(null);
      }
      async.eachOf(
        docs,
        (doc, index, cb) => {
          docs[index].thumbnailSrc = path.join(
            config.storagePath,
            "thumbs",
            docs[index].videoID + ".jpg"
          );
          db.ratings
            .count({
              videoID: docs[index].videoID,
              action: 1
            })
            .then(count => {
              docs[index].likes = count;
              return db.ratings.count({
                videoID: docs[index].videoID,
                action: 0
              });
            })
            .then(count => {
              docs[index].dislikes = count;

              return cb();
            });
        },
        () => {
          return res.json(returner);
        }
      );
    })
    .catch(e => {
      return res
        .status(500)
        .json(genericErrorObject("Could not fetch dashboard."));
    });
});

// route for storage upgrades
router.post("/api/upgrade", function(req, res) {
  log(
    "UPGRADE | requester : " +
      req.session.authUser.username +
      ", code:" +
      req.body.code,
    0
  );

  db.codes
    .fineOne({
      code: req.body.code,
      active: true
    })
    .then(code => {
      if (!code) {
        log("UPGRADE | unsuccessful: no such code", 0);
        return res.json(genericErrorObject("No such code exists."));
      }
      // adding granted benefit:
      let userUpgrade = {},
        userUpgradeMessage = "Success!";

      switch (code.benefit) {
        case 0: // space upgrade
          userUpgrade = {
            $inc: {
              totalSpace: code.space,
              remainingSpace: code.space
            }
          };
          userUpgradeMessage =
            "You have successfully expanded your space limit!";
          break;
        case 1: //admin status
          userUpgrade = {
            $set: {
              userStatus: 1
            }
          };
          userUpgradeMessage = "You are now an admin!";
          break;
        case 2: // account standing clear
          userUpgrade = {
            $set: {
              accountStanding: 0
            }
          };
          userUpgradeMessage = "Your account standing has been cleared!";
          break;
        default:
          break;
      }

      db.users
        .update(
          {
            username: req.session.authUser.username.toLowerCase()
          },
          userUpgrade,
          {
            returnUpdatedDocs: true,
            multi: false
          }
        )
        .then((numAffected, affectedDocument) => {
          // updating user session
          req.session.authUser = affectedDocument;

          // res
          res.json(genericResponseObject(userUpgradeMessage));
        });

      // disable code
      db.codes.update(
        {
          code: req.body.code
        },
        {
          $set: {
            active: false
          }
        },
        {}
      );

      log("UPGRADE | successful upgrade", 0);
    })
    .catch(e => {
      log(chalk.bgRed.white("UPGRADE | " + err), 1);
      return res.json(
        genericErrorObject("Server error. Couldn't handle code.")
      );
    });
});

// route for account deletion
router.delete("/api/deleteAccount", function(req, res) {
  log("ACCOUNT DELETION | requester: " + req.session.authUser.username, 0);

  // account deletion chain
  db.users
    .findOne({
      email: req.session.authUser.email
    })
    .then(user => {
      if (!user) {
        log(
          chalk.bgRed.white("CRITICAL!") +
            "ACCOUNT DELETION | delete reqests for non-existent accounts!",
          1
        );
        throw "Server error.";
      }

      return bcrypt.compare(req.body.passwordConfirmation, user.password);
    })
    .then(match => {
      if (!match) {
        //wrong confirmation password
        throw "The confirmation password is incorrect! Try again.";
      }

      // removing user
      return db.users.remove(
        {
          email: req.session.authUser.email
        },
        {
          multi: false
        }
      );
    })
    .then(() => {
      return db.videos.find({ username: req.session.authUser.username });
    })
    .then(videos => {
      // removing user's videos
      videos.forEach(video => {
        removeVideo(video);
      });
    })
    .then(() => {
      return res.json(genericResponseObject);
    })
    .catch(e => {
      console.error(e);
      return res.json(genericErrorObject(e));
    });
});

// new link generation
router.patch("/api/newLink", function(req, res) {
  log("NEW LINKS | requester: " + req.session.authUser.username, 0);

  let returner = genericResponseObject();

  returner.newData = req.body.selection;

  async.eachOf(
    req.body.selection,
    (sel, index, cb) => {
      let newVideoID = shortid.generate();
      let newVidLink = config.host + "/v/" + newVideoID;

      db.videos
        .update(
          {
            username: req.session.authUser.username,
            videoID: sel.videoID
          },
          {
            $set: {
              videoID: newVideoID,
              link: newVidLink
            }
          },
          {
            upsert: false,
            returnUpdatedDocs: true
          }
        )
        .then((err, numAffected, affectedDocs) => {
          if (numAffected < 1) {
            return cb("Link regeneration failed.");
          }

          returner.newData[index].newVideoID = newVideoID;
          returner.newData[index].newLink = newVidLink;

          return db.ratings.update(
            {
              videoID: sel.videoID
            },
            {
              $set: {
                videoID: newVideoID
              }
            },
            {
              multi: true
            }
          );
        })
        .then(() => {
          // video file renaming
          return fs.rename(
            path.resolve(
              "static",
              config.storagePath,
              sel.videoID + sel.extension
            ),
            path.resolve(
              "static",
              config.storagePath,
              newVideoID + sel.extension
            )
          );
        })
        .then(() => {
          // thumbnail renaming
          return fs.rename(
            path.resolve(
              "static",
              config.storagePath,
              "thumbs",
              sel.videoID + ".jpg"
            ),
            path.resolve(
              "static",
              config.storagePath,
              "thumbs",
              newVideoID + ".jpg"
            )
          );
        })
        .then(() => {
          return cb();
        })
        .catch(e => {
          console.error(e);
          return res.json(genericErrorObject(e));
        });
    },
    err => {
      if (err) {
        return res.json(genericResponseObject(err));
      }
      returner.meta.msg = "Links successfully updated!";
      return res.json(returner);
    }
  );
});

// route for video name changes
router.patch("/api/rename", function(req, res) {
  log("RENAME | requester: " + req.session.authUser.username, 0);

  let returner = genericResponseObject();

  //updating the requested video's name
  db.videos
    .update(
      {
        username: req.session.authUser.username,
        videoID: req.body.videoID
      },
      {
        $set: {
          name: req.body.newName
        }
      },
      {
        upsert: false
      }
    )
    .then((err, numAffected, affectedDocs) => {
      if (err) {
        log("RENAME | " + err, 1);
      }
      if (numAffected < 1) {
        returner = genericErrorObject("Renaming failed; No such video.");
      } else {
        returner = genericResponseObject("Video successfully renamed!");
      }
      returner.newName = req.body.newName;

      return res.json(returner);
    })
    .catch(e => {
      console.error(e);
      return res.json(genericErrorObject(e));
    });
});

// route for video upload finalization (cancel or confirm)
router.put("/api/finalizeUpload", function(req, res) {
  log("UPLOAD FINALIZATION | requester: " + req.session.authUser.username, 0);

  let returner = genericResponseObject();

  if (req.body.cancelled) {
    log(chalk.red("UPLOAD FINALIZATION | upload(s) cancelled"), 0);
    return res.json(genericErrorObject("You have cancelled the upload."));
  }

  async.eachOf(
    Object.keys(req.body.newNames),
    (oldName, index, cb) => {
      if (!req.body.newNames.hasOwnProperty(oldName)) {
        return cb();
      }

      log(
        "UPLOAD FINALIZATION | got new name " +
          req.body.newNames[oldName] +
          " for " +
          oldName,
        0
      );

      let newName = req.body.newNames[oldName].replace(/[^a-z0-9\s]/gi, "");
      let cleanedName = oldName.replace(/[^a-z0-9]/gi, "");

      db.videos.update(
        {
          confirmed: false,
          username: req.session.authUser.username,
          name: cleanedName
        },
        {
          $set: {
            name: newName,
            confirmed: true,
            uploadDate: new Date()
          }
        },
        {
          returnUpdatedDocs: true,
          multi: false
        }
      );
    },
    () => {
      // removing all unconfirmed
      removeUnconfirmed(req.session.authUser.username);
      return res.json(
        genericResponseObject("You successfully uploaded the video.")
      );
    }
  );
});

// post to remove video
router.delete("/api/removeVideo", function(req, res) {
  log("VIDEO DELETION | " + "requester: " + req.session.authUser.username, 0);
  let returner = genericResponseObject();
  returner.selection = req.body.selection;

  async.each(
    req.body.selection,
    (videoToDelete, cb) => {
      db.videos
        .findOne({
          videoID: videoToDelete.videoID,
          username: req.session.authUser.userStatus
            ? videoToDelete.username
            : req.session.authUser.username // only videos from the signed in user, unless admin is deleting.
        })
        .then(foundVideoToDelete => {
          if (!foundVideoToDelete) {
            throw "Could not delete video.";
          }

          removeVideo(foundVideoToDelete);

          return db.users.update(
            {
              username: videoToDelete.username
            },
            {
              $inc: {
                // restoring user's storage space
                remainingSpace: Math.abs(foundVideoToDelete.size)
              }
            },
            {
              returnUpdatedDocs: true,
              multi: false
            }
          );
        })
        .then((numAffected, affectedDocument) => {
          // removing video
          // renewing session user, but not if the user is an admin
          if (req.session.authUser.userStatus != 1) {
            req.session.authUser = affectedDocument;
          }

          return db.videos.remove({
            videoID: videoToDelete.videoID
          });
        })
        .then(() => {
          if (
            req.session.authUser.userStatus == 1 &&
            videoToDelete.warning != 0
          ) {
            // admin has chosen to warn/block user
            db.users.update(
              {
                username: videoToDelete.username
              },
              {
                $set: {
                  accountStanding: videoToDelete.warning
                }
              },
              {
                multi: false
              }
            );
          }
          return cb();
        })
        .catch(e => {
          return cb(e);
        });
    },
    err => {
      if (err) {
        return res.json(genericErrorObject(err));
      }
      returner.meta.msgType = "info";
      returner.meta.error = 0;
      returner.meta.msg = "Successfully deleted video(s)!";
      return res.json(returner);
    }
  );
});

// route for video uploads
router.post("/api/upload", function(req, res) {
  let returner = genericResponseObject(),
    totalSizeInMegabytes = 0;
  returner.newVideos = [];

  du(path.resolve("static", config.storagePath))
    .then(size => {
      if (size >= config.spaceLimit) {
        log("UPLOAD | Max space exceeded! Interrupting download...", 1);
        returner = genericErrorObject(
          "The server cannot accept videos at the moment. Try again later!"
        );
        returner.meta.msgType = "info";
        return res.json(returner);
      }
    })
    .then(() => {
      async.each(
        Object.keys(req.files),
        (file, cb) => {
          if (!req.files.hasOwnProperty(file)) {
            return cb();
          }

          // filesize handling
          let fileSizeInBytes = req.files[file].dataSize;
          let fileSizeInMegabytes = fileSizeInBytes / 1000 / 1000;
          totalSizeInMegabytes += fileSizeInMegabytes;
          log(
            "UPLOAD | uploaded video size is " + fileSizeInMegabytes + "mb",
            0
          );

          if (fileSizeInMegabytes > 10000) {
            //hard limitas to avoid files over 10gb
            return res
              .status(500)
              .json(
                genericErrorObject("File is too big. Must be <10 gigabytes.")
              );
          }
          let extension;

          switch (req.files[file].mimetype) {
            case "video/webm":
              extension = ".webm";
              break;
            case "video/ogg":
              extension = ".ogv";
              break;
            case "video/mp4":
              extension = ".mp4";
              break;
            default:
              log("UPLOAD | unsupported video format!", 0);
              return res
                .status(500)
                .json(
                  genericErrorObject("That video format cannot be uploaded.")
                );
          }

          var cleanedName = req.files[file].name.replace(/[^a-z0-9\s]/gi, "");
          // checking if user's storage space is sufficient
          if (docs[0].remainingSpace < fileSizeInMegabytes) {
            return res
              .status(500)
              .json(
                genericErrorObject(
                  "You do not have enough space remaining to upload this file."
                )
              );
          }
          // dedam video i storage
          var videoID = shortid.generate();
          var vidLink = config.host + "/v/" + videoID;
          log(chalk.green("UPLOAD | storing video!"), 0);

          db.videos
            .insert({
              username: req.session.authUser.username.toLowerCase(),
              link: vidLink,
              name: cleanedName,
              videoID: videoID,
              views: 0,
              likes: 0,
              dislikes: 0,
              size: fileSizeInMegabytes,
              mimetype: req.files[file].mimetype,
              extension: extension,
              confirmed: false
            })
            .then(newDoc => {
              req.files[file].mv(
                path.resolve("static", config.storagePath, videoID + extension),
                function(err) {
                  //generating thumbnail

                  extractFrames({
                    input: path.resolve(
                      "static",
                      config.storagePath,
                      videoID + extension
                    ),
                    output: path.resolve(
                      "static",
                      config.storagePath,
                      "thumbs",
                      videoID + ".jpg"
                    ),
                    offsets: [0]
                  }).catch(e => {
                    console.log(
                      chalk.bgYellow.black("WARN") +
                        "Failed to save thumbnail:",
                      e
                    );
                  });

                  returner.newVideos.push(newDoc);

                  return cb();
                }
              );
            });
        },
        () => {
          // reducing user's storage space
          db.users
            .update(
              {
                username: req.session.authUser.username.toLowerCase()
              },
              {
                $inc: {
                  remainingSpace: totalSizeInMegabytes * -1
                }
              },
              {
                returnUpdatedDocs: true,
                multi: false
              }
            )
            .then((err, numAffected, affectedDocument) => {
              // updating session
              req.session.authUser = affectedDocument;
            });
        }
      );
    })
    .catch(e => {
      console.error(e);
      return res.json(genericErrorObject(e));
    });
});

// post to actually change the password (both in-profile and token-based password reset)
router.patch("/api/password/regular", function(req, res) {
  log("PASSWORD CHANGE || regular", 0);

  // resetting password
  db.users
    .findOne({
      username: req.session.authUser.username.toLowerCase()
    })
    .then(user => {
      return bcrypt.compare(req.body.currentPassword, user.password);
    })
    .then(match => {
      if (!match) {
        throw "Incorrect old password!";
      }
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
        }
      );
    })
    .then(() => {
      return res.json(
        genericResponseObject("You have successfully changed your password!")
      );
    })
    .catch(e => {
      console.error(e);
      return res.json(genericErrorObject(e));
    });
});

// removing usre from req.session on logout
router.post("/api/logout", function(req, res) {
  delete req.session.authUser;
  return res.json({
    ok: true
  });
});

function removeVideo(video) {
  // removing files
  try {
    // removing video
    fs.unlink(
      path.resolve(
        "static",
        config.storagePath,
        video.videoID + video.extension
      )
    );
    // removing thumbnail
    fs.unlink(
      path.resolve(
        "static",
        config.storagePath,
        "thumbs",
        video.videoID + ".jpg"
      )
    );
  } catch (e) {
    console.error(e);
  }

  // removing ratings
  db.ratings.remove(
    {
      videoID: selection.videoID
    },
    {
      multi: true
    }
  );
}

function removeUnconfirmed(user) {
  db.videos
    .find({
      username: user,
      confirmed: false
    })
    .then(unconfirmedvideos => {
      // no need to be in order, we're not returning anything to the client.
      unconfirmedvideos.forEach(unconfirmedVideo => {
        log(chalk.red("UPLOAD FINALIZATION | removing unconfirmed"), 0);

        // deleting video and thumbnail
        try {
          fs.unlink(
            path.resolve(
              "static",
              config.storagePath,
              unconfirmedVideo.videoID + unconfirmedVideo.extension
            )
          );
        } catch (e) {
          log("UPLOAD FINALIZATION | " + e, 1);
        }
        // removing thumbnail
        try {
          fs.unlink(
            path.resolve(
              "static",
              config.storagePath,
              "thumbs",
              unconfirmedVideo.videoID + ".jpg"
            )
          );
        } catch (e) {
          log("UPLOAD FINALIZATION | " + e, 1);
        }

        // restoring user space
        db.users.update(
          {
            username: req.session.authUser.username
          },
          {
            $inc: {
              // restoring user's storage space for each deleted
              remainingSpace: Math.abs(unconfirmedVideo.size)
            }
          },
          {
            returnUpdatedDocs: true,
            multi: false
          }
        );

        // removing video
        db.videos.remove(
          {
            videoID: selection.videoID
          },
          function(err, docs) {
            if (err) {
              log(chalk.bgRed.white("UPLOAD FINALIZATION | " + err, 1));
            }
            //TODO: returner + refrac both removal routes into one AND waterwall or promise it, b/c cant
            //return errors from foreach async operations.
          }
        );
      });
    });
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
