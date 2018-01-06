# [WIP] Scharkee-vid
---
##### - a redistributable private video hosting platform.
*linux only for the time being*

---
## Quick setup:

```shell
git clone http://padan.ga:23343/root/scharkee-vid.git
npm install
npm run dev
```

##### PREREQUISITES:
* **.env file in the root directory with the following contents:**
    1. `FILE_PATH` - video storage path, must also be served as static content, relative to the root dir
    2. `SESSION_KEY` - a random string, needed for the express-session module
    3. `DB_USERS_PATH`,`DB_VIDEOS_PATH`, `DB_CODES_PATH` and `DB_RATINGS_PATH` - database paths, relative to root dir, no extension needed
    4. `TOTAL_SPACE` - the total amount of space you are willing to dedicate for the website. It will not allow any more registrations when the amount of reserved user space exceeds `TOTAL_SPACE` **(in bytes)**
    5. `MAIL_UN` and `MAIL_PASS` - gmail account credentials, will be used for password resets
