const app = require("express")();
const du = require("du");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const config = require("../config");
const db = require("./external/db.js");

// default options
const defaultUserStatus = 0; //1 - admin
const defaultStorageSpace = 10000; // in megabytes
const defaultTokenExpiry = 1800000; // 30 mins

const { Router } = require("express");

let router = Router();

// reject if the user is not signed in
const check = (req, res, next) => {
  if (req.session.authUser) {
    return res.status(500).send("You are already signed in!");
  }
  return next();
};

// post to request a password reset
app.post("/api/requestReset", function(req, res) {
  log("PASSWORD RESET | reset request", 0);

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

module.exports = router;
