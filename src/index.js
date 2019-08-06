"use strict";

const path = require("path");
const server = require(path.resolve("src", "server.js"));
const config = require(path.resolve("config.json"));
const greenlock = require("greenlock-express");
const greenlockStore = require("greenlock-store-fs");

// TLS auto-setup if selfHosted is true in the config
if (config.selfHosted) {
  greenlock
    .create({
      email: config.tls.email,
      agreeTos: config.tls.tos,
      approveDomains: config.tls.domains,
      configDir: "~/.config/acme/",
      store: greenlockStore,
      app: server
      //debug: true
    })
    .listen(80, 443);
  console.log(`Server listening on ports 80 and 443`);
} else {
  let port = config.port || process.env.PORT || 7777;
  server.listen(port, console.log(`Server listening on port ${port}`));
}
