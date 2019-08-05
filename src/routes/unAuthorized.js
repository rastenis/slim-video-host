const du = require("du");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcrypt");
const chalk = require("chalk");
const config = require(path.resolve("config.json"));
const db = require(path.resolve("src", "external", "db.js"));

const logger = require(path.resolve("src", "helpers", "logger.js"));
const { genericResponseObject, genericErrorObject } = require(path.resolve(
  "src",
  "helpers",
  "responses.js"
));

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
  logger.l("LOGIN | requester: " + req.body.username);
  let found;

  db.users
    .find({
      username: req.body.username.toLowerCase()
    })
    .then(docs => {
      found = docs;
      if (found.length == 0) {
        // no user with that username
        logger.l("No matching account.");

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
        logger.l("LOGIN | passwords match!");
        req.session.authUser = found[0];
        return res.json(found[0]);
      }

      logger.l("LOGIN | passwords don't match!");
      return res.status(403).json({
        error: "Bad credentials"
      });
    })
    .catch(e => {
      logger.e(e);
      return res.status(500).json({
        error: "Could not log you in. Try again later."
      });
    });
});

// post to request a password reset
router.post("/api/requestReset", check, function(req, res) {
  logger.l("PASSWORD RESET | reset request");

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
          logger.l("PASS RESET | " + err);
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
      logger.e(e);
      return res.json(genericErrorObject(e));
    });
});

// token checking route
router.get("/api/checkToken/:token", check, function(req, res) {
  let returner = genericResponseObject();
  returner.valid = false;

  logger.l("PASS RESET | checking for token " + req.params.token);

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
      logger.l("PASS RESET | found token!");
      returner.token = token.resetToken;
      returner.valid = true;
      returner.meta.error = false;

      return res.json(returner);
    })
    .catch(e => {
      logger.e(e);
      return res.json(genericErrorObject(e));
    });
});

// registration post
router.post("/api/register", check, function(req, res) {
  let storageSpace = defaultStorageSpace,
    userStatus = defaultUserStatus;

  du(path.resolve("static", config.storagePath))
    .then(size => {
      logger.l(
        "REGISTRATION | The size of the video folder is:" + size + "bytes",
        0
      );
      if (size >= config.spaceLimit) {
        return res.status(500).json({
          error: "No registrations accepted at this time."
        });
      }

      logger.l("registering");

      logger.l(
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
        logger.l(
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
            logger.l(
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
      logger.l(e);
      return res.status(500).json(genericErrorObject(e));
    });
});

// post to actually change the password (both in-profile and token-based password reset)
router.patch("/api/password/token", check, function(req, res) {
  logger.l("PASSWORD CHANGE || token");

  //token reset
  let hashedPass = hashUpPass(req.body.newPass);
  // updating right away
  db.users
    .update(
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
      }
    )
    .then((numAffected, affectedDocs) => {
      if (numAffected == 0) {
        logger.l("PASSWORD CHANGE || password was NOT successfully changed");
        throw "Password reset token is invalid or has expired.";
      }

      //all ok
      logger.l("PASSWORD CHANGE || password was successfully changed");
      return res.json(
        genericResponseObject("You have successfully changed your password!")
      );
    })
    .catch(e => {
      logger.e(e);
      return res.json(genericErrorObject(e));
    });
});

module.exports = router;
