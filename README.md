# [WIP] Scharkee-vid

#### - a redistributable private video hosting platform.
*linux only for the time being*

* Uncompressed video hosting, resulting in fast uploads and minuscule processing times
* Link-based video sharing, no public video searching and/or display
* Anonymous likes/dislikes
* Admin panel:
    * Content management, cumulative video list
    * Space management 
    * User stats
* User dashboard:
    * Statistics
    * Video list w/ video renaming, removal and link regeneration

## Quick setup:

```shell
git clone http://padan.ga:23343/root/scharkee-vid.git
npm install
npm run dev 
```
* The application can now be accessed at localhost:10700
* The first registered user will be set as admin
* The registration page is accessible by pressing Alt+R while editing the username field in the landing/login page

## Prerequisites:
* **config.json file in the root directory with the following contents:**
    1. ``file_path`` - video storage path, must also be served as static content, relative to the root dir
    2. `session_key` - a random string, needed for the express-session module
    3. `databases` - `db_users_path`, `db_videos_path`,`db_codes_path` and `db_ratings_path` - database paths, relative to root dir. No need to change the default values.
    4. `total_space` - the total amount of space you are willing to dedicate for the website. It will not allow any more registrations when the amount of reserved user space exceeds **(in bytes)**
    5. `mail` - `username` and `password` - gmail account credentials, will be used for password resets
    6. `video_link_prefix` - set up the domain you want your website to be accessible through. Pay attention to HTTP and HTTPS, choose whichever is right for you!
*  A config.json file is in the root dir with most settings set. Change the personalized settings out, and you'll be good to go!
*  There will soon be automatic config.json generation with input dialogs when installing. [WIP]



## Scripts:

* ``npm run dev`` rebuilds and runs the server
* ``npm run codes`` opens the code manipulation console interface (upgrade and registration codes: space upgrades, admin status codes)
* ``npm run maintain`` [WIP] opens the maintenance interface. Used for checking the integrity and health of the platform, as well as performing certain tasks.