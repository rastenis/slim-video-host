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

// post to request a password reset
router.post("/api/requestReset", function(req, res) {
  console.log("PASSWORD RESET | reset request", 0);

  db.users.find(
    {
      email: req.body.email
    },
    function(err, docs) {
      if (docs.length > 1) {
        console.log(
          chalk.bgRed.white("CRITICAL!") +
            chalk.bgRed.white("PASS RESET | duplicate account emails."),
          1
        );
        res.json(genericErrorObject("Internal error. Please try again later."));
      } else if (docs.length < 1) {
        console.log("PASS RESET | no such user.", 0);
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
            console.log("PASS RESET | " + err, 1);
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
router.get("/api/checkToken/:token", function(req, res) {
  let returner = genericResponseObject();
  returner.valid = false;

  console.log("PASS RESET | checking for token " + req.params.token, 0);

  db.users.find(
    {
      resetToken: req.params.token,
      tokenExpiry: {
        $gt: Date.now()
      }
    },
    function(err, docs) {
      if (docs.length > 1) {
        console.log("PASS RESET | duplicate tokens; purging all", 1);
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
              console.log("PASS RESET | " + err, 1);
            }
          }
        );
      } else if (docs.length < 1) {
        console.log("PASS RESET | no such token.", 0);
        returner.token = null;
        returner.meta.error = true;
      } else {
        //token found
        console.log("PASS RESET | found token!", 0);
        returner.token = docs[0].resetToken;
        returner.valid = true;
        returner.meta.error = false;
      }
      res.json(returner);
    }
  );
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
