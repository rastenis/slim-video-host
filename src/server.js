process.env.DEBUG = process.env.NODE_ENV === "production" ? "" : "nuxt:*";
const bcrypt = require("bcrypt");
const shortid = require("shortid");
const chalk = require("chalk");
const { Nuxt, Builder } = require("nuxt");
const bodyParser = require("body-parser");
const session = require("express-session");
const app = require("express")();
const fileUpload = require("express-fileupload");
const helmet = require("helmet");
const NedbStore = require("nedb-session-store")(session);
const config = require("../config");
const maintenance = require("./external/maintenance.js");
const favicon = require("serve-favicon");
const path = require("path");

// removed _ and - from the generator because of issues with nuxt dynamic routing
shortid.characters(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@"
);

// route imports
const adminRoutes = require("./routes/admin");
const authorizedRoutes = require("./routes/authorized");
const unAuthorizedRoutes = require("./routes/unAuthorized");
const publicRoutes = require("./routes/public");

// on-start auto maintenance
maintenance.preLaunch(config);

// post maintenance requires
let settings = require(path.resolve(config.dbPath, "system", "settings.json"));

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

// Route declarations:

// only unauthenticated users allowed
app.use("/", adminRoutes);
// only authenticated users allowed
app.use("/", authorizedRoutes);
// everyone is allowed
app.use("/", unAuthorizedRoutes);
// only admins are allowed
app.use("/", publicRoutes);

//nuxt config
let nuxt_config = require(path.resolve("nuxt.config.js"));
nuxt_config.dev = process.env.NODE_ENV !== "production";
const nuxt = new Nuxt(nuxt_config);

//nuxt build
// Nuxt is pre-built in production, so building is not required.
if (nuxt_config.dev) {
  const builder = new Builder(nuxt);
  builder.build();
}

//TODO: recalculate user remaining space each start

app.use(nuxt.render);

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

module.exports = app;
