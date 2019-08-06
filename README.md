# slim-video-host

[![Status](https://travis-ci.org/scharkee/slim-video-host.svg?branch=master)](https://travis-ci.org/scharkee/slim-video-host)

### a cross-platform private video hosting platform.

## Features

- NuxtJS scaffolding (Vue + vue-router + Vuex)
- ElementUI-based web interface
- Express backend, with auth-gated routes, (optional) auto TLS certificate generation, and a lightweight database provided by NeDB.
- Uncompressed video hosting, resulting in fast uploads and minuscule processing times
- 'Bufferless' upload process - files larger than available RAM can be uploaded
- Link-based video sharing, no public video searching and/or display
- Anonymous likes/dislikes
- Admin tools:
  - Space management
  - User stats
  - Content management:
    - Cumulative video list
    - Video deletion
    - User warnings/bans for inappropriate uploads
- User dashboard:
  - Statistics
  - Video list w/ video renaming, removal and link regeneration
  - Code entry dialog, used for space expansion/priviledge elevation

## Quick setup

```bash
# clone the repo
$ git clone https://repo.hepha.co.uk/root/slim-video-host.git
# instal dependencies and trigger setup (you must have an interactive shell)
$ npm install
# perform setup (you must have an interactive shell)
$ npm run setup
# run the system in devmode
$ npm run dev
```

- The application can now be accessed at port you configured.
- The first registered user will be set as admin.
  - You can create codes via `npm run codes` that upgrade other users to admins,
  - Or you can adjust their userStatus directly in the database file.
- The registration page is accessible by pressing **Alt+R** in the landing/login page or by going to the /regg route( `//hostname.domain/regg` )

## Prerequisites:

- **config.json file must be in the root directory with the following contents:**

  > The config generator gets automatically launched after the initial installation. Be sure to fill everything in correctly! It can be rerun with `npm run setup`

1. `storagePath` - video storage path, must also be served as static content, relative to the root dir
2. `host` - set up the domain you want your website to be accessible through. HTTP/HTTPS will be automatically added according to the `selfHosted` setting.
3. `spaceLimit` - the total amount of space you are willing to dedicate for the website. It will not allow any more registrations when the amount of reserved user space exceeds
4. `productionLogging` - either "all", "error" or "none" - sets production-time logging severity
5. `port` - custom port for when auto TLS generation is disabled.
6. `selfHosted` - sets mode of operation:
   - true - takes over ports 80 and 443, automatically generates TLS certs, must run as root.
   - false - runs on port defined in config, http only. Use when a routing system is setup(Apache, etc.), or for testing.
7. `tls` - Let's Encrypt options
8. `mail` - `username` and `password` - gmail account credentials, used for password resets
9. `dbPath` - database path, relative to root dir. No need to change the default value.
10. `infiniteSessions` - whether user sessions should persist forever ar have a 24h lifespan.

- ConfigExample.json is in the root dir with demo settings set. If needed, use it as guidance while filling out `npm run setup`

## Scripts

- Development:
  - `npm run dev` runs the server in devmode
- Production:
  - `npm run build` builds the server for production
  - `npm run start` starts the built server
- Setup and maintenance:
  - `npm run setup` or `npm run config` - starts the config generation sequence. Runs automatically after npm install.
  - `npm run codes` opens the code manipulation console interface (upgrade and registration codes: space upgrades, admin status codes)
  - `npm run care` or `npm run maintenance` - opens the maintenance console interface. Used for manually runnign tasks that check the integrity and health of the platform, as well as other operations, such as a complete wipe. Config.json must be present in order for these commands to work.

### Independant TLS precautions

- The server will most likely need to be ran as root, so it can take control of 80/443 ports
- This may in turn generate databases, temporary files and certs that have root ownership:
  - Shouldn't be a problem if the TLS mode isn't changed
  - System wipe will also need to be ran as root. When it's finished, normal non-root operation without auto TLS generation can be reinstated (after reconfiguring config.json via `npm run setup`).

### Email setup

Google requires "Less secure app access" to be enabled for you to be able to use a basic login (email,password) in order to send out password reset tokens. You can enable it by going to your [Google account settings](https://myaccount.google.com/), and by enabling "Less secure app access".

You can also use OAuth, but that requires additional setup within Google's Developer console, and some manual reconfiguration in the transport setup. More information can be found in the [nodemailer docs.](https://nodemailer.com/usage/using-gmail/)

### Issues and contributions

Submit bugs and requests through the project's [issue tracker.](https://repo.hepha.co.uk/root/slim-video-host/issues)

Contributions are welcome! [Submit a merge request to my GitLab.](https://repo.hepha.co.uk/root/slim-video-host/merge_requests)

### Automatic maintenance

On launch:

- All unconfirmed videos (stored videos w/o confirmation & naming from the user) are removed.
- All videos & thumbnails without entries in the database are purged.
- User remaining space ir recalculated, in order to avoid issues caused by malformed uploads and/or client crashes.
- Videos without a thumbnail get their thumbnails regenerated.
- Total space is checked with current space. A **Warning** will be displayed on build if the storagePath is exceeded (the system will still function, but uploads will no longer be accepted).
