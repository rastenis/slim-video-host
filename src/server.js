process.env.DEBUG = process.env.NODE_ENV === "production" ? "" : "nuxt:*";
const bcrypt = require("bcrypt");
const shortid = require("shortid");
const chalk = require("chalk");
const async = require("async");
const { Nuxt, Builder } = require("nuxt");
const bodyParser = require("body-parser");
const session = require("express-session");
const app = require("express")();
const fileUpload = require("express-fileupload");
const fs = require("fs-extra");
const util = require("util");
const helmet = require("helmet");
const du = require("du");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const exec = require("child_process").exec;
const NedbStore = require("nedb-session-store")(session);
const config = require("../config");
const maintenance = require("./external/maintenance.js");
const db = require("./external/db.js");
const favicon = require("serve-favicon");
const path = require("path");
const themes = require("../static/style/themes");
const extractFrames = require("ffmpeg-extract-frames");

// removed _ and - from the generator because of issues with nuxt dynamic routing
shortid.characters(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@"
);

// default options
var defaultUserStatus = 0; //1 - admin
var defaultStorageSpace = 10000; // in megabytes
var defaultTokenExpiry = 1800000; // 30 mins

// on-start auto maintenance
maintenance.preLaunch(config);

// post maintenance requires
var settings = require(path.resolve(config.dbPath, "system", "settings.json"));

// optional cert generation
if (config.selfHosted) {
  // returns an instance of node-greenlock with additional helper methods
  var lex = require("greenlock-express").create({
    server: "production",
    challenges: {
      "http-01": require("le-challenge-fs").create({
        webrootPath: "tmp/acme-challenges"
      })
    },
    store: require("le-store-certbot").create({
      webrootPath: "tmp/acme-challenges"
    }),
    approveDomains: function(opts, certs, cb) {
      if (certs) {
        opts.domains = config.tls.domains;
      } else {
        (opts.email = config.tls.email), (opts.agreeTos = config.tls.tos);
      }
      cb(null, {
        options: opts,
        certs: certs
      });
    }
  });
}

app.use(favicon(path.resolve("static", "fav", "favicon.ico")));
app.use(helmet());
app.use(
  fileUpload({
    limits: {
      fileSize: 10 * 1000 * 1000 * 1000 //100 GB
    },
    safeFileNames: true
  })
);
app.use(bodyParser.json());
app.use(
  session({
    secret: settings.ss,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.selfHosted,
      maxAge: config.infiniteSessions ? null : 24 * 60 * 60 * 1000 //24 hours or infinite, depending on the config
    },
    store: new NedbStore({
      filename: "db/persistance"
    })
  })
);

// post for the login procedure
app.post("/api/login", function(req, res) {
  log("LOGIN | requester: " + req.body.username, 0);

  if (req.session.authUser) {
    return;
  }

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

// token checking route
app.get("/api/checkToken/:token", function(req, res) {
  let returner = genericResponseObject();
  returner.valid = false;

  log("PASS RESET | checking for token " + req.params.token, 0);

  db.users.find(
    {
      resetToken: req.params.token,
      tokenExpiry: {
        $gt: Date.now()
      }
    },
    function(err, docs) {
      if (docs.length > 1) {
        log("PASS RESET | duplicate tokens; purging all", 1);
        returner.meta.error = true;
        db.users.remove(
          {
            resetToken: req.params.token
          },
          {
            multi: true
          },
          function(err, docs) {
            if (err) {
              log("PASS RESET | " + err, 1);
            }
          }
        );
      } else if (docs.length < 1) {
        log("PASS RESET | no such token.", 0);
        returner.token = null;
        returner.meta.error = true;
      } else {
        //token found
        log("PASS RESET | found token!", 0);
        returner.token = docs[0].resetToken;
        returner.valid = true;
        returner.meta.error = false;
      }
      res.json(returner);
    }
  );
});

// post to request a password reset
app.post("/api/requestReset", function(req, res) {
  if (req.session.authUser) {
    return;
  }

  log("PASS RESET | reset request", 0);

  db.users.find(
    {
      email: req.body.email
    },
    function(err, docs) {
      if (docs.length > 1) {
        log(
          chalk.bgRed.white("CRITICAL!") +
            chalk.bgRed.white("PASS RESET | duplicate account emails."),
          1
        );
        res.json(genericErrorObject("Internal error. Please try again later."));
      } else if (docs.length < 1) {
        log("PASS RESET | no such user.", 0);
        res.json(genericErrorObject("No account with that email."));
      } else {
        //token found
        let token = crypto.randomBytes(23).toString("hex");

        let nmlTrans = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: config.mail.username,
            pass: config.mail.password
          }
        });

        let mailOptions = {
          to: req.body.email,
          from: config.mail.username,
          subject: "Password Reset",
          text:
            "You are receiving this because a password reset for your account was requested.\n\n" +
            "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
            "https://" +
            req.headers.host +
            "/r/" +
            token +
            "\n\n" +
            "If you did not request this, please ignore this email and your password will remain unchanged.\n\n"
        };
        nmlTrans.sendMail(mailOptions, function(err) {
          if (err) {
            log("PASS RESET | " + err, 1);
          }
        });

        //store token
        db.users.update(
          {
            email: req.body.email
          },
          {
            $set: {
              resetToken: token,
              tokenExpiry: Date.now() + defaultTokenExpiry
            }
          },
          {
            upsert: false
          },
          function(err, docs) {
            res.json(
              genericResponseObject(
                "Success! Check your email for further instructions."
              )
            );
          }
        );
      }
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

// route for video actions (like/dislike)
app.put("/api/act", function(req, res) {
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

// registration post
app.post("/api/register", function(req, res) {
  if (req.session.authUser) {
    // can't register if signed in
    return;
  }
  async.waterfall(
    [
      function(done) {
        let enoughSpace = true;
        db.users.find(
          {
            username: req.body.username.toLowerCase()
          },
          function(err, docs) {
            du("static/videos", function(err, size) {
              log(
                "REGISTRATION | The size of the video folder is:" +
                  size +
                  "bytes",
                0
              );
              if (size >= config.spaceLimit) {
                enoughSpace = false;
              }
              done(null, docs, enoughSpace);
            });
          }
        );
      },
      function(docs, enoughSpace, done) {
        // checks for duplicate usernames
        if (docs.length != 0) {
          // user with duplicate username exists
          log(
            chalk.bgRed(
              "REGISTRATION | Failed account creation (duplicate username)"
            ),
            0
          );
          res.status(599).json({
            error: "An account with that username already exists."
          });
        } else if (!enoughSpace) {
          log(
            chalk.bgRed(
              "REGISTRATION | Failed account creation (spaceLimit exceeded)"
            ),
            1
          );
          res.status(598).json({
            error: "The server cannot accept new registrations at this moment."
          });
        } else {
          //ok, proceeding with the creation
          let storageSpace = defaultStorageSpace;
          let userStatus = defaultUserStatus;
          log(
            chalk.bgRed(
              chalk.bgCyanBright.black(
                "REGISTRATION | no duplicate account! proceeding with the creation of the account."
              )
            ),
            0
          );
          async.waterfall(
            [
              function(done) {
                db.users.find(
                  {
                    email: req.body.email
                  },
                  function(err, docs) {
                    if (docs.length != 0) {
                      //duplicate email
                      log(
                        chalk.bgRed(
                          "REGISTRATION | Failed account creation (duplicate emails)"
                        ),
                        0
                      );
                      return res.status(597).json({
                        error: "An account with that email already exists."
                      });
                    } else {
                      done();
                    }
                  }
                );
              },
              function(done) {
                // checking for matching privelege codes
                db.codes.loadDatabase(function(err) {
                  db.codes.find(
                    {
                      code: req.body.code,
                      active: true,
                      type: "reg"
                    },
                    function(err, docs) {
                      if (docs.length == 0) {
                        //no matching code, go on
                        done(null, null);
                      } else {
                        // got a matching code!
                        // setting the code to 'inactive' state
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
                          function(err) {
                            if (err) {
                              log("REGISTRATION | " + err, 1);
                            }
                          }
                        );
                        done(null, docs[0]);
                      }
                    }
                  );
                });
              },
              function(code, done) {
                // adding code benefits
                if (code !== null) {
                  // got code
                  if (code.benefit == 0) {
                    // increase base storage space
                    storageSpace = code.space;
                  } else if (code.benefit == 1) {
                    // grant admin status
                    userStatus = 1;
                  }
                }
                done();
              },
              function(done) {
                //handling admin assignment for freshly run systems
                db.users.find({}, function(err, docs) {
                  let userCount = 0;
                  docs.forEach(function(doc) {
                    userCount++;
                  });
                  if (userCount == 0) {
                    // no users; first one will become an admin
                    userStatus = 1;
                  } else {
                    userStatus = 0;
                  }
                  done();
                });
              },
              function(done) {
                //inserting the new user
                let hashedPass = hashUpPass(req.body.password);
                db.users.insert(
                  {
                    username: req.body.username.toLowerCase(),
                    password: hashedPass,
                    email: req.body.email,
                    totalSpace: storageSpace,
                    remainingSpace: storageSpace,
                    userStatus: userStatus,
                    accountStanding: 0
                  },
                  function(err, doc) {
                    log(
                      chalk.bgCyanBright.black(
                        "REGISTRATION | successfully inserted user " +
                          doc.username
                      ),
                      0
                    );
                    req.session.authUser = doc; // attaching to session for easy access
                    return res.json(doc);
                  }
                );
              }
            ],
            function(err, res) {
              if (err) {
                log(chalk.bgRed.white("REGISTRATION | " + err), 1);
              }
            }
          );
        }
      }
    ],
    function(err) {
      if (err) {
        log("REGISTRATION | " + err, 1);
      }
    }
  );
});

// route for getting user's videos
app.get("/api/dash", function(req, res) {
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

// route for storage upgrades
app.post("/api/upgrade", function(req, res) {
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
app.delete("/api/deleteAccount", function(req, res) {
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
app.patch("/api/newLink", function(req, res) {
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
            if (!returner.meta.error) {
              fs.rename(
                "static",
                config.storagePath + sel.videoID + sel.extension,
                "static",
                config.storagePath + newVideoID + sel.extension,
                function(err) {
                  if (err) {
                    log("NEW LINKS | " + err, 1);
                  }
                  return done();
                }
              );
            }
          },
          function(done) {
            // thumbnail renaming
            if (!returner.meta.error) {
              fs.rename(
                path.resolve(
                  "static",
                  config.storagePath,
                  thumb,
                  sel.videoID + ".jpg"
                ),
                path.resolve(
                  "static",
                  config.storagePath,
                  thumb,
                  newVideoID + ".jpg"
                ),
                function(err) {
                  if (err) {
                    log("NEW LINKS | " + err, 1);
                  }
                  return done();
                }
              );
            }
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
app.patch("/api/rename", function(req, res) {
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
app.put("/api/finalizeUpload", function(req, res) {
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

app.post("/api/changeTheme", function(req, res) {
  log("THEME CHANGE | requester: " + req.session.authUser.username, 0);
  // only signed in admins
  let returner = genericResponseObject();

  if (req.session.authUser && req.session.authUser.userStatus == 1) {
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
  } else {
    log(
      "BAD CALL @ THEME CHANGE | requester: " + req.session.authUser.username,
      1
    );
    return;
  }
});

app.post("/api/runMaintenance", function(req, res) {
  let returner = genericResponseObject();
  if (req.session.authUser && req.session.authUser.userStatus == 1) {
    log("RUN MAINTENANCE | requester: " + req.session.authUser.username, 0);

    try {
      maintenance.preLaunch(config);
      returner.meta.msg = "Maintenance successfully started!";
      return res.json(returner);
    } catch (e) {
      returner.meta.msg = "Couldn't start maintenance! " + e;
      return res.json(returner);
    }
  } else {
    log(
      "BAD CALL @ RUN MAINTENANCE | requester: " +
        req.session.authUser.username,
      1
    );
    return;
  }
});

// postas adminu statistikom
app.get("/api/getAdminStats", function(req, res) {
  log("FETCHING ADMIN STATS | requester: " + req.session.authUser.username, 0);
  let returner = genericResponseObject();
  returner.stats = {};

  if (req.session.authUser.userStatus != 1) {
    return;
  }

  async.waterfall(
    [
      function(done) {
        db.users.count({}, function(err, count) {
          if (err) {
            log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
            returner.meta.error = 1;
          }
          returner.stats.userCount = count;
          done();
        });
      },
      function(done) {
        db.videos.count({}, function(err, count) {
          if (err) {
            log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
            returner.meta.error = 1;
          }
          returner.stats.videoCount = count;
          done();
        });
      },
      function(done) {
        db.videos.find({}, function(err, docs) {
          if (err) {
            log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
            returner.meta.error = 1;
          }

          let totalViews = 0,
            usedSpace = 0;

          // counting video views and total space used
          docs.forEach(video => {
            totalViews += video.views;
            usedSpace += Math.abs(video.size);
          });

          returner.stats.totalViews = totalViews;
          returner.stats.totalSpaceA = config.spaceLimit;
          returner.stats.usedSpaceA = usedSpace.toFixed(2);
          returner.videos = docs;
          done();
        });
      }
    ],
    function(err) {
      if (err) {
        log(chalk.bgRed.white("FETCHING ADMIN STATS | " + err), 1);
        returner.meta.error = 1;
      }
      return res.json(returner);
    }
  );
});

// post to remove video
app.delete("/api/removeVideo", function(req, res) {
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
app.post("/api/upload", function(req, res) {
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
app.post("/api/logout", function(req, res) {
  delete req.session.authUser;
  res.json({
    ok: true
  });
});

//TODO: recalculate user remaining space each start?

//nuxt config
let nuxt_config = require(path.resolve("nuxt.config.js"));
nuxt_config.dev = process.env.NODE_ENV !== "production";
const nuxt = new Nuxt(nuxt_config);

//nuxt build
if (nuxt_config.dev) {
  const builder = new Builder(nuxt);
  builder.build();
}
// No build in production

app.use(nuxt.render);

if (config.selfHosted) {
  // handles acme-challenge and redirects to https
  require("http")
    .createServer(lex.middleware(require("redirect-https")()))
    .listen(80, function() {
      console.log("Listening for ACME http-01 challenges on", this.address());
    });

  // https handler
  var server = require("https").createServer(
    lex.httpsOptions,
    lex.middleware(app)
  );
  server.listen(443, function() {
    console.log(
      "Listening for ACME tls-sni-01 challenges and serve app on",
      this.address()
    );
  });
} else {
  app.listen(config.port);
  console.log("Server is listening on http://localhost:" + config.port);
}

// used once at login as a precaution
function performSecurityChecks(docs) {
  if (docs.length == 0) {
    // no user with that username
    log(chalk.bgRed("No matching account."), 0);
    throw {
      status: 555,
      message: "No account with that username found."
    };
  }

  if (docs.length > 1) {
    // duplicate username users
    log(chalk.bgRed("==DUPLICATE ACCOUNTS FOUND=="), 1);
    throw {
      status: 556,
      message: "Server error."
    };
  }
}

// password hashing function
function hashUpPass(pass) {
  var hash = bcrypt.hashSync(pass, 12);
  return hash;
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
