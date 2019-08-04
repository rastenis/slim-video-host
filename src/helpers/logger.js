const chalk = require("chalk");
const path = require("path");
const fs = require("fs-extra");
const config = require(path.resolve("config.json"));

const logger = {
  l: function loggerLog(...m) {
    if (
      config.productionLogging !== "all" &&
      process.env.NODE_ENV === "production"
    ) {
      return;
    }
    console.log(chalk.white(moment().format("YYYY-MM-DD HH:mm:ss:SSS")), ...m);
  },
  e: function loggerError(...e) {
    if (
      config.productionLogging === "none" &&
      process.env.NODE_ENV === "production"
    ) {
      return;
    }
    console.error(
      chalk.white.inverse.bold(moment().format("YYYY-MM-DD HH:mm:ss:SSS")),
      chalk.red.inverse.bold("ERROR!:"),
      ...e
    );
  }
};

module.exports = logger;
