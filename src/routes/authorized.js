const fs = require("fs-extra");
const du = require("du");
const path = require("path");
const config = require(path.resolve("config.json"));
const db = require(path.resolve("src", "external", "db.js"));
const extractFrames = require("ffmpeg-extract-frames");
const async = require("async");
const chalk = require("chalk");
const bcrypt = require("bcrypt");

const { Router } = require("express");

let router = Router();

// reject if the user is not signed in
const check = (req, res, next) => {
  if (!req.session.authUser) {
    return res.status(403).send("Please log in.");
  }
  return next();
};

// post for the login procedure
router.post("/api/login", check, function(req, res) {
  log("LOGIN | requester: " + req.body.username, 0);

  db.users.find(
    {
      username: req.body.username.toLowerCase()
    },
    function(err, docs) {
      try {
        // checks for duplicate usernames
        performSecurityChecks(docs);
        // user exists, no duplicates. Proceeding to the password check
        if (bcrypt.compareSync(req.body.password, docs[0].password)) {
          //password matches
          log(chalk.green("LOGIN | passwords match!"), 0);
          req.session.authUser = docs[0];
          return res.json(docs[0]);
        } else {
          log(chalk.red("LOGIN | passwords don't match!"));
          res.status(556).json({
            error: "Bad credentials"
          });
        }
      } catch (e) {
        if (e.status) {
          res.status(e.status).json({
            error: e.message
          });
        } else {
          // stay silent
        }
      }
    }
  );
});

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

  async.waterfall(
    [
      function(done) {
        db.videos.find(
          {
            username: req.session.authUser.username.toLowerCase()
          },
          function(err, docs) {
            if (err) {
              log(chalk.bgRed.white("DASH | " + err), 1);
              returner.meta.error = 1;
              return res.json(null);
            }
            if (docs.length > 0) {
              done(null, docs);
            } else {
              return res.json(null);
            }
          }
        );
      },
      function(docs, done) {
        docs.forEach(function(i, index) {
          docs[index].thumbnailSrc = path.join(
            config.storagePath,
            "thumbs",
            docs[index].videoID + ".jpg"
          );
          async.waterfall(
            [
              function(finished) {
                db.ratings.count(
                  {
                    videoID: docs[index].videoID,
                    action: 1
                  },
                  function(err, count) {
                    docs[index].likes = count;
                    finished();
                  }
                );
              },
              function(finished) {
                db.ratings.count(
                  {
                    videoID: docs[index].videoID,
                    action: 0
                  },
                  function(err, count) {
                    docs[index].dislikes = count;
                    finished();
                  }
                );
              },
              function(finished) {
                // user instance refreshment
                db.users.find(
                  {
                    username: req.session.authUser.username.toLowerCase()
                  },
                  function(err, docs) {
                    req.session.authUser = docs[0];
                    returner.user = docs[0];
                    finished();
                  }
                );
              }
            ],
            function(err) {
              if (err) {
                log("DASH | " + err, 1);
              }
              if (index == docs.length - 1) {
                returner.meta.error = 0;
                returner.videos = docs;
                return res.json(returner);
              }
            }
          );
        });
      }
    ],
    function(err) {
      if (err) {
        log("DASH | " + err, 1);
      }
    }
  );
});

// route for storage upgrades
router.post("/api/upgrade", function(req, res) {
  let returner = genericResponseObject();
  log(
    "UPGRADE | requester : " +
      req.session.authUser.username +
      ", code:" +
      req.body.code,
    0
  );

  db.codes.loadDatabase(function(err) {
    db.codes.find(
      {
        code: req.body.code,
        active: true
      },
      function(err, docs) {
        if (err) {
          log(chalk.bgRed.white("UPGRADE | " + err), 1);
          res.json(genericErrorObject("Server error :("));
        }
        if (docs.length == 0) {
          log("UPGRADE | unsuccessful: no such code", 0);
          res.json(genericErrorObject("No such code exists."));
        } else {
          // adding granted benefit:
          // space
          if (docs[0].benefit == 0) {
            db.users.update(
              {
                username: req.session.authUser.username.toLowerCase()
              },
              {
                $inc: {
                  totalSpace: docs[0].space,
                  remainingSpace: docs[0].space
                }
              },
              {
                returnUpdatedDocs: true,
                multi: false
              },
              function(err, numAffected, affectedDocument) {
                if (err) {
                  log("UPGRADE | " + err, 1);
                }
                // refreshing session
                req.session.authUser = affectedDocument;

                // res
                res.json(
                  genericResponseObject(
                    "You have successfully expanded your space limit!"
                  )
                );
              }
            );
            // admin status
          } else if (docs[0].benefit == 1) {
            db.users.update(
              {
                username: req.session.authUser.username.toLowerCase()
              },
              {
                $set: {
                  userStatus: 1
                }
              },
              {
                returnUpdatedDocs: true,
                multi: false
              },
              function(err, numAffected, affectedDocument) {
                if (err) {
                  log("UPGRADE | " + err, 1);
                }
                // refreshing session
                req.session.authUser = affectedDocument;

                // res
                res.json(genericResponseObject("You are now an admin!"));
              }
            );
          } else if (docs[0].benefit == 2) {
            db.users.update(
              {
                username: req.session.authUser.username.toLowerCase()
              },
              {
                $set: {
                  accountStanding: 0
                }
              },
              {
                returnUpdatedDocs: true,
                multi: false
              },
              function(err, numAffected, affectedDocument) {
                if (err) {
                  log("UPGRADE | " + err, 1);
                }
                // refreshing session
                req.session.authUser = affectedDocument;

                // res
                res.json(
                  genericResponseObject(
                    "Your account standing has been cleared!"
                  )
                );
              }
            );
          }

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
            {},
            function(err, doc) {
              if (err) {
                log("UPGRADE | " + err, 1);
              }
            }
          );

          log("UPGRADE | successful upgrade", 0);
        }
      }
    );
  });
});

// route for account deletion
router.delete("/api/deleteAccount", function(req, res) {
  log("ACCOUNT DELETION | requester: " + req.session.authUser.username, 0);

  let returner = genericResponseObject(),
    opCount = 0;

  if (!req.session.authUser) {
    res.json(genericErrorObject("No authentication. Please sign in."));
  } else {
    async.waterfall(
      [
        function(done) {
          db.users.find(
            {
              email: req.session.authUser.email
            },
            function(err, docs) {
              if (err) {
                log("ACCOUNT DELETION | " + err, 1);
              } else {
                if (docs.length == 0) {
                  log(
                    chalk.bgRed.white("CRITICAL!") +
                      "ACCOUNT DELETION | delete reqests for non-existent accounts!",
                    1
                  );
                  returner.meta.error = 1;
                } else if (docs.length > 1) {
                  log(
                    chalk.bgRed.white("CRITICAL!") +
                      "ACCOUNT DELETION | delete reqest matches multiple accounts!",
                    1
                  );
                  returner.meta.error = 1;
                } else {
                  //all fine, re-fetching to make sure there are no duplicates and that this exact account gets deleted.
                  done(null, docs[0]);
                }
              }
            }
          );
        },
        function(fetchedUser, done) {
          bcrypt.compare(
            req.body.passwordConfirmation,
            fetchedUser.password,
            function(err, valid) {
              if (err) {
                log("ACCOUNT DELETION | " + err, 1);
              } else {
                returner.meta.error = !valid;
                done(null, valid);
              }
            }
          );
        },
        function(valid, done) {
          if (!valid) {
            //wrong confirmation password
            returner = genericErrorObject(
              "The confirmation password is incorrect! Try again."
            );
            done();
          } else if (returner.meta.error) {
            returner = genericErrorObject(
              "An error occured when deleting your account. Please try again later."
            );
            done();
          } else {
            db.users.remove(
              {
                email: req.session.authUser.email
              },
              {
                multi: false
              },
              function(err) {
                if (err) {
                  log("ACCOUNT DELETION | " + err, 1);
                  returner = genericErrorObject(
                    "An internal error occured. Please try again later."
                  );
                } else {
                  returner = genericResponseObject(
                    "You have successfully deleted your account!"
                  );
                }
                done();
              }
            );
          }
        },
        function(done) {
          db.users.find(
            {
              username: req.session.authUser.username
            },
            function(err, docs) {
              if (err) {
                log("ACCOUNT DELETION | " + err, 1);
              } else {
                docs.forEach(video => {
                  try {
                    fs.unlink(
                      path.resolve(
                        "static",
                        config.storagePath,
                        video.videoID + video.extension
                      )
                    );
                  } catch (err) {
                    log("ACCOUNT DELETION | " + err, 1);
                  }
                  try {
                    fs.unlink(
                      path.resolve(
                        "static",
                        config.storagePath,
                        "thumbs",
                        video.videoID + ".jpg"
                      )
                    );
                  } catch (err) {
                    log("ACCOUNT DELETION | " + err, 1);
                  }
                });
                done();
              }
            }
          );
        },
        function(done) {
          db.ratings.remove(
            {
              username: req.session.authUser.username
            },
            {
              multi: true
            },
            function(err, docs) {
              if (err) {
                log("ACCOUNT DELETION | " + err, 1);
              }
              done();
            }
          );
        }
      ],
      function(err) {
        if (err) {
          log("ACCOUNT DELETION | " + err, 1);
        }
        res.json(returner);
      }
    );
  }
});

// new link generation
router.patch("/api/newLink", function(req, res) {
  log("NEW LINKS | requester: " + req.session.authUser.username, 0);

  let returner = genericResponseObject(),
    opCount = 0;

  if (!req.session.authUser) {
    res.json(genericErrorObject("No authentication. Please sign in."));
  } else {
    returner.newData = req.body.selection;
    req.body.selection.forEach((sel, index) => {
      let newVideoID = shortid.generate();
      let newVidLink = config.host + "/v/" + newVideoID;

      async.waterfall(
        [
          function(done) {
            db.videos.update(
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
              },
              function(err, numAffected, affectedDocs) {
                done(null, numAffected);
              }
            );
          },
          function(numAffected, done) {
            if (numAffected < 1) {
              returner = genericErrorObject("Link regeneration failed.");
            }

            returner.newData[index].newVideoID = newVideoID;
            returner.newData[index].newLink = newVidLink;
            done();
          },
          function(done) {
            // updating likes/dislikes
            db.ratings.update(
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
              },
              function(err) {
                if (err) {
                  log("NEW LINKS | " + err, 1);
                }
                done();
              }
            );
          },
          function(done) {
            // video file renaming
            // TODO: ensure ownership
            fs.rename(
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
            )
              .then(r => {
                return done();
              })
              .catch(e => {
                log("NEW LINKS | " + e, 1);
              });
          },
          function(done) {
            // thumbnail renaming

            fs.rename(
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
            )
              .then(r => {
                return done();
              })
              .catch(e => {
                log("NEW LINKS | " + e, 1);
              });
          }
        ],
        function(err) {
          if (err) {
            log("NEW LINKS | " + err, 1);
          }
          if (opCount == req.body.selection.length - 1) {
            if (!returner.meta.error) {
              returner.meta.msg = "Links successfully updated!";
            }
            return res.json(returner);
          } else {
            opCount++;
          }
        }
      );
    });
  }
});

// route for video name changes
router.patch("/api/rename", function(req, res) {
  log("RENAME | requester: " + req.session.authUser.username, 0);

  let returner = genericResponseObject();

  if (!req.session.authUser) {
    res.json(
      res.json(genericErrorObject("No authentication. Please sign in."))
    );
  } else {
    //updating the requested video's name
    db.videos.update(
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
      },
      function(err, numAffected, affectedDocs) {
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
      }
    );
  }
});

// route for video upload finalization (cancel or confirm)
router.put("/api/finalizeUpload", function(req, res) {
  log("UPLOAD FINALIZATION | requester: " + req.session.authUser.username, 0);

  let returner = genericResponseObject(),
    opCount = 0;

  if (!req.session.authUser) {
    return res.json(genericErrorObject("No authentication. Please sign in."));
  }

  if (req.body.cancelled) {
    log(chalk.red("UPLOAD FINALIZATION | upload(s) cancelled"), 0);
    res.json(genericErrorObject("You have cancelled the upload."));
  }

  // proceeding to name assignment, if the upload wasn't cancelled
  async.waterfall(
    [
      function(done) {
        if (req.body.cancelled) {
          done();
        }
        for (const oldName in req.body.newNames) {
          if (req.body.newNames.hasOwnProperty(oldName)) {
            log(
              "UPLOAD FINALIZATION | got new name " +
                req.body.newNames[oldName] +
                " for " +
                oldName,
              0
            );

            let newName = req.body.newNames[oldName].replace(
              /[^a-z0-9\s]/gi,
              ""
            ); // should already be clean coming from the client, redundancy
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
              },
              function(err, numAffected, affectedDocuments) {
                if (err) {
                  log(chalk.bgRed.white("UPLOAD FINALIZATION | " + err), 1);
                  returner.meta.error = 1;
                }

                if (opCount === Object.keys(req.body.newNames).length - 1) {
                  res.json(
                    genericResponseObject(
                      "You successfully uploaded the video."
                    )
                  );
                  done();
                } else {
                  opCount++;
                }
              }
            );
          }
        }
      },
      function(done) {
        // unnamed (old unconfirmed) video removal
        db.videos.find(
          {
            username: req.session.authUser.username,
            confirmed: false
          },
          function(err, docs) {
            if (err) {
              log("UPLOAD FINALIZATION | " + err, 1);
            }
            done(null, docs);
          }
        );
      },
      function(unconfirmedvideos, done) {
        unconfirmedvideos.forEach(selection => {
          log(chalk.red("UPLOAD FINALIZATION | removing unconfirmed"), 0);
          db.videos.find(
            {
              videoID: selection.videoID
            },
            function(err, docs) {
              if (err) {
                log(chalk.bgRed.white("UPLOAD FINALIZATION | " + err), 1);
              } else {
                db.users.update(
                  {
                    username: req.session.authUser.username
                  },
                  {
                    $inc: {
                      // restoring user's storage space for each deleted
                      remainingSpace: Math.abs(docs[0].size)
                    }
                  },
                  {
                    returnUpdatedDocs: true,
                    multi: false
                  },
                  function(err, numAffected, affectedDocument) {
                    // removing video from storage
                    try {
                      fs.unlink(
                        path.resolve(
                          "static",
                          config.storagePath,
                          selection.videoID + selection.extension
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
                          selection.videoID + ".jpg"
                        )
                      );
                    } catch (e) {
                      log("UPLOAD FINALIZATION | " + e, 1);
                    }

                    // updating active user
                    req.session.authUser = affectedDocument;
                  }
                );

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
              }
            }
          );
        });
        //FIXME ?
        done(); //foreach will be +- synced up
      }
    ],
    function(err) {
      if (err) {
        log("UPLOAD FINALIZATION | " + err, 1);
      }
    }
  );
});

// post to remove video
router.delete("/api/removeVideo", function(req, res) {
  if (!req.session.authUser) {
    res.json(genericErrorObject("You are not auhorized to do that action!"));
  } else {
    log("VIDEO DELETION | " + "requester: " + req.session.authUser.username, 0);
    let returner = genericResponseObject();
    returner.selection = req.body.selection;
    let opCount = 0;

    req.body.selection.forEach(selection => {
      db.videos.find(
        {
          videoID: selection.videoID
        },
        function(err, docs) {
          if (err) {
            log(chalk.bgRed.white("VIDEO DELETION | " + err), 1);
            returner.meta.error = 1;
            returner.meta.msg = "Internal error. Try again.";
          } else {
            async.waterfall(
              [
                function(done) {
                  db.users.update(
                    {
                      username: selection.username
                    },
                    {
                      $inc: {
                        // restoring user's storage space
                        remainingSpace: Math.abs(docs[0].size)
                      }
                    },
                    {
                      returnUpdatedDocs: true,
                      multi: false
                    },
                    function(err, numAffected, affectedDocument) {
                      if (err) {
                        log("VIDEO DELETION | " + err, 1);
                      }
                      // rm cached vid
                      try {
                        fs.remove(
                          "static",
                          config.storagePath +
                            selection.videoID +
                            selection.extension,
                          function(err) {
                            if (err) {
                              log("VIDEO DELETION | " + err, 1);
                            }
                          }
                        );
                      } catch (error) {
                        log(
                          "VIDEO DELETION | " + "couldn't remove video file.",
                          1
                        );
                      }
                      // rm thumbnail
                      try {
                        fs.remove(
                          path.resolve(
                            "static",
                            config.storagePath,
                            "thumbs",
                            selection.videoID + ".jpg"
                          ),
                          function(err) {
                            if (err) {
                              log("VIDEO DELETION | " + err, 1);
                            }
                          }
                        );
                      } catch (error) {
                        log(
                          "VIDEO DELETION | " +
                            "couldn't remove video thumbnail.",
                          1
                        );
                      }

                      // renewing session user, but not if the user is an admin
                      if (req.session.authUser.userStatus != 1) {
                        req.session.authUser = affectedDocument;
                      }
                      done();
                    }
                  );
                },
                function(done) {
                  db.videos.remove(
                    {
                      videoID: selection.videoID
                    },
                    function(err, docs) {
                      if (err) {
                        log(chalk.bgRed.white("VIDEO DELETION | " + err), 1);
                        returner.meta.error = 1;
                        returner.meta.msg = "Internal error. Try again.";
                        res.json(returner);
                      }

                      if (opCount == req.body.selection.length - 1) {
                        returner.meta.msgType = "info";
                        returner.meta.error = 0;
                        returner.meta.msg = "Successfully deleted video(s)!";
                        res.json(returner);
                        return done();
                      }

                      opCount++;
                      return done();
                      //TODO: returner + refrac both removal routes into one AND waterwall or promise it, b/c cant
                      //return errors from foreach async operations.
                    }
                  );
                },
                function(done) {
                  db.ratings.remove(
                    {
                      videoID: selection.videoID
                    },
                    {
                      multi: true
                    },
                    function(err, docs) {
                      if (err) {
                        log("AVIDEO DELETION | " + err, 1);
                      }
                      done();
                    }
                  );
                },
                function(done) {
                  if (
                    req.session.authUser.userStatus == 1 &&
                    selection.warning != 0
                  ) {
                    // admin has chosen to warn/block user
                    db.users.update(
                      {
                        username: selection.username
                      },
                      {
                        $set: {
                          accountStanding: selection.warning
                        }
                      },
                      {
                        multi: false
                      },
                      err => {
                        if (err) {
                          log(chalk.bgRed.white("VIDEO DELETION | " + err), 1);
                        }
                      }
                    );
                  }
                  done(); //doesn't really matter if operation doesn't finish before returning
                }
              ],
              function(err) {
                if (err) {
                  log("VIDEO DELETION | " + err, 1);
                }
              }
            );
          }
        }
      );
    });
  }
});

// route for video uploads
router.post("/api/upload", function(req, res) {
  if (!req.session.authUser) {
    return res.status(557).json({
      error: "User not signed in."
    });
  }
  let returner = genericResponseObject(),
    opCount = 0;
  returner.newVideos = [];

  async.waterfall(
    [
      function(done) {
        // checking space first
        du(path.resolve("static", config.storagePath), function(err, size) {
          if (size >= config.spaceLimit) {
            log("UPLOAD | Max space exceeded! Interrupting download...", 1);
            returner = genericErrorObject(
              "The server cannot accept videos at the moment. Try again later!"
            );
            returner.meta.msgType = "info";
            return res.json(returner);
          }
          return done();
        });
      }
    ],
    function(err) {
      // PER-FILE handling

      for (const file in req.files) {
        if (req.files.hasOwnProperty(file)) {
          // filesize handling
          let fileSizeInBytes = req.files[file].dataSize;
          let fileSizeInMegabytes = fileSizeInBytes / 1000 / 1000;
          log(
            "UPLOAD | uploaded video size is " + fileSizeInMegabytes + "mb",
            0
          );

          if (fileSizeInMegabytes > 10000) {
            //hard limitas to avoid files over 10gb
            res.status(557).json({
              error: "File is too big. Must be <10 gigabytes."
            });
          } else {
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
                return res.status(557).json({
                  error: "That video format cannot be uploaded."
                });
            }

            async.waterfall(
              [
                function(done) {
                  db.users.find(
                    {
                      username: req.session.authUser.username.toLowerCase()
                    },
                    function(err, docs) {
                      return done(null, docs);
                    }
                  );
                },
                function(docs, done) {
                  var cleanedName = req.files[file].name.replace(
                    /[^a-z0-9\s]/gi,
                    ""
                  );
                  // checking if user's storage space is sufficient
                  if (docs[0].remainingSpace < fileSizeInMegabytes) {
                    return res.status(557).json({
                      error:
                        "You do not have enough space remaining to upload this file."
                    });
                  }
                  // dedam video i storage
                  var videoID = shortid.generate();
                  var vidLink = config.host + "/v/" + videoID;
                  log(chalk.green("UPLOAD | storing video!"), 0);

                  db.videos.insert(
                    {
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
                    },
                    function(err, newDoc) {
                      if (err) {
                        return log("UPLOAD | " + err, 1);
                      }
                      req.files[file].mv(
                        path.resolve(
                          "static",
                          config.storagePath,
                          videoID + extension
                        ),
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

                          if (opCount >= Object.keys(req.files).length - 1) {
                            log(
                              "UPLOAD | RETURNING UPLOAD CALLBACK w/ " +
                                opCount +
                                " items",
                              0
                            );
                            return res.json(returner);
                          }

                          // incrementing uploaded video counter
                          opCount++;
                        }
                      );
                    }
                  );
                  var decrement = (fileSizeInMegabytes *= -1);
                  done(null, decrement);
                },
                function(decrement, done) {
                  // reducing user's storage space
                  db.users.update(
                    {
                      username: req.session.authUser.username.toLowerCase()
                    },
                    {
                      $inc: {
                        remainingSpace: decrement
                      }
                    },
                    {
                      returnUpdatedDocs: true,
                      multi: false
                    },
                    function(err, numAffected, affectedDocument) {
                      // updating session
                      req.session.authUser = affectedDocument;
                    }
                  );
                }
              ],
              function(err) {
                if (err) {
                  log("UPLOAD | " + err, 1);
                }
              }
            );
          }
        }
      }
    }
  );
});

// removing usre from req.session on logout
router.post("/api/logout", function(req, res) {
  delete req.session.authUser;
  res.json({
    ok: true
  });
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
