const crypto = require("crypto");
const path = require("path");
const fs = require("fs-extra");
const configPath = "config.json";

let config = require(path.resolve("configExample.json"));
fs.writeJSONSync(configPath, config);
fs.ensureDirSync(path.resolve(config.dbPath, "system"));
fs.writeJSONSync(path.resolve(config.dbPath, "system", "settings.json"), {
  theme: 0,
  ss: crypto.randomBytes(23).toString("hex")
});
