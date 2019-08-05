const du = require("du");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcrypt");
const chalk = require("chalk");
const config = require(path.resolve("config.json"));
const db = require(path.resolve("src", "external", "db.js"));

// default options
const defaultUserStatus = 0; //1 - admin
const defaultStorageSpace = 10000; // in megabytes
const defaultTokenExpiry = 1800000; // 30 mins
const saltAmount = 12; // 30 mins

const { Router } = require("express");

let router = Router();

// reject if the user is not signed in
const check = (req, res, next) => {
  if (req.session.authUser) {
    return res.status(500).send("You are already signed in!");
  }
  return next();
};

// post for the login procedure
router.post("/api/login", check, function(req, res) {
  log("LOGIN | requester: " + req.body.username, 0);
  let found;

  db.users
    .find({
      username: req.body.username.toLowerCase()
    })
    .then(docs => {
      found = docs;
      if (found.length == 0) {
        // no user with that username
        log(chalk.bgRed("No matching account."), 0);

        return res
          .status(500)
          .json({ error: true, msg: "No account with that username found." });
      }

      return bcrypt.compare(req.body.password, docs[0].password);
    })
    .then(match => {
      // user exists, no duplicates. Proceeding to the password check
      if (match) {
        //password matches
        log(chalk.green("LOGIN | passwords match!"), 0);
        req.session.authUser = found[0];
        return res.json(found[0]);
      }

      log(chalk.red("LOGIN | passwords don't match!"));
      return res.status(403).json({
        error: "Bad credentials"
      });
    })
    .catch(e => {
      console.error(e);
      return res.status(500).json({
        error: "Could not log you in. Try again later."
      });
    });
});

// post to request a password reset
router.post("/api/requestReset", function(req, res) {
  console.log("PASSWORD RESET | reset request", 0);

  db.users
    .findOne({
      email: req.body.email
    })
    .then(user => {
      if (!user) {
        throw "No account with that email.";
      }
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
          "You received this email because a password reset for your account was requested.\n\n" +
          "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
          config.host +
          "/r/" +
          token +
          "\n\n" +
          "If you did not request this, please ignore this email and your password will remain unchanged.\n\n"
      };
      nmlTrans.sendMail(mailOptions, function(err) {
        if (err) {
          console.log("PASS RESET | " + err, 1);
        }
      });

      //store token
      return db.users.update(
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
        }
      );
    })
    .then(() => {
      return res.json(
        genericResponseObject(
          "Success! Check your email for further instructions."
        )
      );
    })
    .catch(e => {
      console.error(e);
      return res.json(genericErrorObject(e));
    });
});

// token checking route
router.get("/api/checkToken/:token", function(req, res) {
  let returner = genericResponseObject();
  returner.valid = false;

  console.log("PASS RESET | checking for token " + req.params.token, 0);

  db.users
    .findOne({
      resetToken: req.params.token,
      tokenExpiry: {
        $gt: Date.now()
      }
    })
    .then(token => {
      if (!token) {
        throw "Invalid password reset token";
      }

      //token found
      console.log("PASS RESET | found token!", 0);
      returner.token = token.resetToken;
      returner.valid = true;
      returner.meta.error = false;

      return res.json(returner);
    })
    .catch(e => {
      console.error(e);
      return res.json(genericErrorObject(e));
    });
});

// registration post
router.post("/api/register", function(req, res) {
  let storageSpace = defaultStorageSpace,
    userStatus = defaultUserStatus;

  du(path.resolve("static", config.storagePath))
    .then(size => {
      console.log(
        "REGISTRATION | The size of the video folder is:" + size + "bytes",
        0
      );
      if (size >= config.spaceLimit) {
        return res.status(500).json({
          error: "No registrations accepted at this time."
        });
      }

      console.log("registering");

      console.log(
        chalk.bgRed(
          chalk.bgCyanBright.black(
            "REGISTRATION | no duplicate account! proceeding with the creation of the account."
          )
        ),
        0
      );

      return db.users.find({
        $or: [
          { username: req.body.username.toLowerCase() },
          { email: req.body.email }
        ]
      });
    })
    .then(docs => {
      if (docs.length != 0) {
        //duplicate email
        console.log(
          chalk.bgRed(
            "REGISTRATION | Failed account creation (duplicate emails)"
          ),
          0
        );
        return res.status(597).json({
          error: "An account with that email or username already exists."
        });
      }

      return db.codes.find({
        code: req.body.code,
        active: true,
        type: "reg"
      });
    })
    .then(foundCodes => {
      if (foundCodes.length != 0) {
        // got a matching code!
        // setting the code to 'inactive' state
        return db.codes.update(
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
      }
      return null;
    })
    .then(code => {
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
    })
    .then(() => {
      // handling admin assignment for freshly run systems
      db.users.count({}).then(userCount => {
        if (userCount == 0) {
          // no users; first one will become an admin
          userStatus = 1;
        } else {
          userStatus = 0;
        }
        return null;
      });
    })
    .then(() => {
      //inserting the new user
      bcrypt.hash(req.body.password, saltAmount).then(hashed => {
        db.users
          .insert({
            username: req.body.username.toLowerCase(),
            password: hashed,
            email: req.body.email,
            totalSpace: storageSpace,
            remainingSpace: storageSpace,
            userStatus: userStatus,
            accountStanding: 0
          })
          .then(doc => {
            console.log(
              chalk.bgCyanBright.black(
                "REGISTRATION | successfully inserted user " + doc.username
              ),
              0
            );
            req.session.authUser = doc; // attaching to session for easy access
            return res.json(doc);
          });
      });
    })
    .catch(e => {
      console.log(e);
      return res.status(500).json({
        error: e
      });
    });
});

// post to actually change the password (both in-profile and token-based password reset)
router.patch("/api/changePassword", function(req, res) {
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
          //shouldnt ever hrouteren, severe edge
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
