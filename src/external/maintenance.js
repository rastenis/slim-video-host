const fs = require("fs-extra");
var db = require("../external/db.js");
const du = require("du");
const chalk = require("chalk");
const async = require("async");
const crypto = require("crypto");
const path = require("path");
const extractFrames = require("ffmpeg-extract-frames");

// custom array diff prototype
Array.prototype.diff = function(a) {
  return this.filter(function(i) {
    return a.indexOf(i) < 0;
  });
};

function preLaunch(config) {
  // make sure the designated video directory is up
  fs.ensureDir(path.resolve("static", config.storagePath))
    .then(() => {
      return fs.ensureDir(path.resolve("static", config.storagePath, "thumbs"));
    })
    .then(() => {
      return fs.emptyDir(path.resolve("static", "tmp"));
    })
    .then(() => {
      return du(path.resolve("static", config.storagePath));
    })
    .then(size => {
      if (size >= config.spaceLimit) {
        console.log("WARNING! Space limit exceeded!");
      }
    })
    .catch(e => {
      console.error("Errored during directory maintenance:", e);
    });

  // checking if settings exist & creating them if not
  try {
    let settings = require(path.resolve(
      config.dbPath,
      "system",
      "settings.json"
    ));
    if (
      settings !== undefined ||
      settings.theme !== undefined ||
      settings.ss !== undefined
    ) {
      // settings in place!
    }
  } catch (e) {
    // overwrite w/ defaults

    let defaults = {
      theme: 0,
      ss: crypto.randomBytes(23).toString("hex")
    };

    //make sure the directory exists first
    fs.ensureDirSync(path.resolve(config.dbPath, "system"));
    //write the change
    fs.writeJSONSync(
      path.resolve(config.dbPath, "system", "settings.json"),
      defaults
    );
  }

  let videoNames = [],
    thumbnailNames = [];

  // checking through all thumbnails & the videos themselves
  db.videos
    .remove({ confirmed: false }, { multi: true })
    .then(() => {
      return db.videos.find({});
    })
    .then(docs => {
      fs.readdir(path.resolve("static", config.storagePath), (err, files) => {
        if (docs.length < files.length - 1) {
          console.log("Detected undeleted video files.");

          // leaving the thumbs dir alone
          let index = files.indexOf("thumbs");
          files.splice(index, 1);

          let difference = files.diff(videoNames);
          if (difference.length != 0) {
            difference.forEach(item => {
              //removing unneeded
              fs.unlink(path.resolve("static", config.storagePath, item));
            });
          }
        }
      });

      fs.readdir(
        path.resolve("static", config.storagePath, "thumbs"),
        (err, files) => {
          if (docs.length < files.length) {
            console.log("Detected undeleted video thumbnails.");

            let difference = files.diff(thumbnailNames);
            if (difference.length != 0) {
              difference.forEach(item => {
                //removing unneeded
                fs.unlink(
                  path.resolve("static", config.storagePath, "thumbs", item)
                );
              });
            }
          }
        }
      );

      docs.forEach(video => {
        // adding for further cleaning
        videoNames.push(video.videoID + video.extension);
        thumbnailNames.push(video.videoID + ".jpg");

        fs.pathExists(
          path.resolve(
            "static",
            config.storagePath,
            video.videoID + video.extension
          )
        )
          .then(exists => {
            if (!exists) {
              // removing ghost video and returning
              db.videos.remove(
                {
                  videoID: video.videoID
                },
                {}
              );
              return;
            }

            return fs.pathExists(
              path.resolve(
                "static",
                config.storagePath,
                "thumbs",
                video.videoID + ".jpg"
              )
            );
          })
          .then(exists => {
            if (exists) {
              return;
            }
            // generating thumbnail if it does not exist
            extractFrames({
              input: path.resolve(
                "static",
                config.storagePath,
                video.videoID + video.extension
              ),
              output: path.resolve(
                "static",
                config.storagePath,
                "thumbs",
                video.videoID + ".jpg"
              ),
              offsets: [0]
            })
              .then(r => {})
              .catch(e => {
                console.log(
                  chalk.bgYellow.black("WARN") + "failed to save thumbnail ",
                  e
                );
              });
          })
          .catch(e => {
            console.error("Could not generate thumbnails:", e);
          });
      });

      recalculateUserSpace();
    })
    .catch(e => {
      console.error(e);
    });
}

function recalculateUserSpace() {
  // recalculating user space
  let users, videos;
  db.users
    .find({})
    .then(foundUsers => {
      users = foundUsers;
      return db.videos.find({});
    })
    .then(foundVideos => {
      videos = foundVideos;

      let userSpaceMap = {};
      users.forEach(user => {
        userSpaceMap[user.username] = 0;
      });

      videos.forEach(video => {
        userSpaceMap[video.username] += video.size;
      });

      // updating space
      users.forEach(user => {
        if (
          Math.abs(
            users.remainingSpace -
              (user.totalSpace - userSpaceMap[user.username])
          ) > 1
        ) {
          // 2 mb headroom
          db.users.update(
            { _id: users._id },
            {
              $set: {
                remainingSpace: user.totalSpace - userSpaceMap[user.username]
              }
            }
          );
        }
      });
    });
}

module.exports = {
  preLaunch: preLaunch
};
