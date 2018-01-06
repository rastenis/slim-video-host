# [WIP] Scharkee-vid
---
##### - a redistributable private video hosting platform.
*linux only for the time being*

* Uncompressed video hosting, resulting in fast uploads and minuscule processing times
* Link-based video sharing, no public video searching and/or display
* Anonymous likes/dislikes
* Admin panel (video list, remaining space & user stats)
* User dashboard:
    * Statistics
    * Video list w/ video renaming, removal and link regeneration

---
## Quick setup:

```shell
git clone http://padan.ga:23343/root/scharkee-vid.git
npm install
npm run dev 
```
* The application can now be accessed at localhost:10700
* The first registered user will be set as admin
* The registration page is accessible by pressing Alt+R while editing the username field in the landing/login page

---
##### PREREQUISITES:
* **.env file in the root directory with the following contents:**
    1. ``FILE_PATH`` - video storage path, must also be served as static content, relative to the root dir
    2. `SESSION_KEY` - a random string, needed for the express-session module
    3. `DB_USERS_PATH`,`DB_VIDEOS_PATH`, `DB_CODES_PATH` and `DB_RATINGS_PATH` - database paths, relative to root dir, no extension needed
    4. `TOTAL_SPACE` - the total amount of space you are willing to dedicate for the website. It will not allow any more registrations when the amount of reserved user space exceeds `TOTAL_SPACE` **(in bytes)**
    5. `MAIL_UN` and `MAIL_PASS` - gmail account credentials, will be used for password resets

---
##### SCRIPTS:

* ``npm run dev`` rebuilds and runs the server
* ``npm run codes`` opens the code manipulation console interface (upgrade and registration codes: space upgrades, admin status codes)