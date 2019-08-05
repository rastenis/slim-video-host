const fs = require("fs-extra");
const du = require("du");
const path = require("path");
const config = require(path.resolve("config.json"));
const db = require(path.resolve("src", "external", "db.js"));
const extractFrames = require("ffmpeg-extract-frames");
const async = require("async");
const bcrypt = require("bcrypt");
const shortid = require("shortid");

const logger = require(path.resolve("src", "helpers", "logger.js"));
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
router.put("/api/act", check, function(req, res) {
  logger.l("ACT | requester: " + req.session.authUser.username);

  let userRatings = {};
  userRatings.liked = false;
  userRatings.disliked = false;

  db.ratings
    .find({
      username: req.session.authUser.username,
      videoID: req.body.videoID
    })
    .then(docs => {
      if (docs.length > 2 || docs.length < 0) {
        logger.l("ACT | rating error.");
      }

      // assigning likes/dislikes
      docs.forEach(doc => {
        if (doc.action == 0) {
          // disliked
          userRatings.disliked = true;
        } else if (doc.action == 1) {
          userRatings.liked = true;
        }
      });

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

      if (prep.revert) {
        return db.ratings.remove(
          {
            username: req.session.authUser.username,
            videoID: req.body.videoID,
            action: prep.action
          },
          {}
        );
      } else {
        return db.ratings.insert({
          username: req.session.authUser.username,
          videoID: req.body.videoID,
          action: prep.action
        });
      }
    });
});

// route for getting user's videos
router.get("/api/dash", check, function(req, res) {
  let returner = genericResponseObject();

  logger.l("DASH | requester : " + req.session.authUser.username);

  // refreshing user data and getting videos
  db.users
    .findOne({ _id: req.session.authUser._id })
    .then(user => {
      req.session.authUser = user;
      return db.videos.find({
        username: user.username.toLowerCase()
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
          returner.videos = docs;
          return res.json(returner);
        }
      );
    })
    .catch(e => {
      logger.e(e);
      return res
        .status(500)
        .json(genericErrorObject("Could not fetch dashboard."));
    });
});

// route for storage upgrades
router.post("/api/upgrade", check, function(req, res) {
  logger.l(
    "UPGRADE | requester : " +
      req.session.authUser.username +
      ", code:" +
      req.body.code
  );

  db.codes
    .fineOne({
      code: req.body.code,
      active: true
    })
    .then(code => {
      if (!code) {
        logger.l("UPGRADE | unsuccessful: no such code");
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
        .then(affectedDocument => {
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

      logger.l("UPGRADE | successful upgrade");
    })
    .catch(e => {
      logger.e("UPGRADE | " + e);
      return res.json(
        genericErrorObject("Server error. Couldn't handle code.")
      );
    });
});

// route for account deletion
router.delete("/api/deleteAccount", check, function(req, res) {
  logger.l("ACCOUNT DELETION | requester: " + req.session.authUser.username);

  // account deletion chain
  db.users
    .findOne({
      email: req.session.authUser.email
    })
    .then(user => {
      if (!user) {
        logger.e(
          "ACCOUNT DELETION | delete reqests for non-existent accounts!"
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
      logger.e(e);
      return res.json(genericErrorObject(e));
    });
});

// new link generation
router.patch("/api/newLink", check, function(req, res) {
  logger.l("NEW LINKS | requester: " + req.session.authUser.username);

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
        .then((numAffected, affectedDocs) => {
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
          logger.e(e);
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
router.patch("/api/rename", check, function(req, res) {
  logger.l("RENAME | requester: " + req.session.authUser.username);

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
    .then((numAffected, affectedDocs) => {
      if (numAffected < 1) {
        returner = genericErrorObject("Renaming failed; No such video.");
      } else {
        returner = genericResponseObject("Video successfully renamed!");
      }
      returner.newName = req.body.newName;

      return res.json(returner);
    })
    .catch(e => {
      logger.e(e);
      return res.json(genericErrorObject(e));
    });
});

// route for video upload finalization (cancel or confirm)
router.put("/api/finalizeUpload", check, function(req, res) {
  logger.l("UPLOAD FINALIZATION | requester: " + req.session.authUser.username);

  if (req.body.cancelled) {
    logger.l("UPLOAD FINALIZATION | upload(s) cancelled");
    return res.json(genericErrorObject("You have cancelled the upload."));
  }

  async.each(
    Object.keys(req.body.newNames),
    (oldName, cb) => {
      if (!req.body.newNames.hasOwnProperty(oldName)) {
        return cb();
      }

      logger.l(
        "UPLOAD FINALIZATION | got new name " +
          req.body.newNames[oldName] +
          " for " +
          oldName
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
        {}
      );

      return cb();
    },
    () => {
      // removing all unconfirmed
      removeUnconfirmed(req.session.authUser.username);
      return res.json(
        genericResponseObject("You have successfully uploaded the video.")
      );
    }
  );
});

// post to remove video
router.delete("/api/removeVideo", check, function(req, res) {
  logger.l("VIDEO DELETION | requester: " + req.session.authUser.username);
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
        .then(affectedDocument => {
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
router.post("/api/upload", check, function(req, res) {
  let returner = genericResponseObject(),
    totalSizeInMegabytes = 0;
  returner.newVideos = [];

  du(path.resolve("static", config.storagePath))
    .then(size => {
      if (size >= config.spaceLimit) {
        logger.e("UPLOAD | Max space exceeded! Interrupting download...");
        returner = genericErrorObject(
          "The server cannot accept videos at the moment. Try again later!"
        );
        returner.meta.msgType = "info";
        return res.json(returner);
      }
    })
    .then(() => {
      // getting user data to compute space requirements
      return db.users.findOne({ _id: req.session.authUser._id });
    })
    .then(user => {
      if (!user) {
        throw "Internal error.";
      }

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
          logger.l(
            "UPLOAD | uploaded video size is " + fileSizeInMegabytes + "mb"
          );

          // checking against users limits
          if (user.remainingSpace < totalSizeInMegabytes) {
            logger.l("UPLOAD | skipping video due to insufficient user space.");
            return res
              .status(500)
              .json(
                genericErrorObject(
                  "You do not have enough space remaining to upload one or more files."
                )
              );
          }

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
              logger.l("UPLOAD | unsupported video format!");
              return res
                .status(500)
                .json(
                  genericErrorObject("That video format cannot be uploaded.")
                );
          }

          let cleanedName = req.files[file].name.replace(/[^a-z0-9\s]/gi, "");
          // checking if user's storage space is sufficient

          // storing video
          let videoID = shortid.generate();
          let vidLink = config.host + "/v/" + videoID;
          logger.l("UPLOAD | storing video!");

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
                    logger.e("Failed to save thumbnail:", e);
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
            .then(affectedDocument => {
              // updating session
              req.session.authUser = affectedDocument;
              return res.json(returner);
            });
        }
      );
    })
    .catch(e => {
      logger.e(e);
      return res.json(genericErrorObject(e));
    });
});

// post to actually change the password (both in-profile and token-based password reset)
router.patch("/api/password/regular", check, function(req, res) {
  logger.l("PASSWORD CHANGE || regular");

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
      logger.e(e);
      return res.json(genericErrorObject(e));
    });
});

// removing usre from req.session on logout
router.post("/api/logout", check, function(req, res) {
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
    logger.e(e);
  }

  // removing ratings
  db.ratings.remove(
    {
      videoID: video.videoID
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
        logger.l("UPLOAD FINALIZATION | removing unconfirmed");

        removeVideo(unconfirmedVideo);

        // restoring user space
        db.users.update(
          {
            username: user.username
          },
          {
            $inc: {
              // restoring user's storage space for each deleted
              remainingSpace: Math.abs(unconfirmedVideo.size)
            }
          },
          {}
        );

        // removing video
        db.videos.remove({
          videoID: selection.videoID
        });
      });
    });
}

module.exports = router;
