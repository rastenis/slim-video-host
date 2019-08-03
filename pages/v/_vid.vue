<template>
  <div class="mainDiv">
    <div v-if="nonExistent" class="nonExistentText">
      <h1>Requested video does not exist. (404)</h1>
    </div>
    <div v-else>
      <h1 class="title">{{video.name}}</h1>
      <div class="sideControls" v-if="$store.state.authUser">
        <div class="icc" id="iccTop" @click="action(1)">
          <transition name="el-zoom-in-bottom">
            <i
              v-show="userRatings.liked"
              class="fa fa-thumbs-up fa-inverse fa-stack-1x"
              aria-hidden="true"
            ></i>
          </transition>
          <transition name="el-zoom-in-top">
            <i
              v-show="!userRatings.liked"
              class="fa fa-thumbs-o-up fa-inverse fa-stack-1x iccTopBreaker"
              aria-hidden="true"
            ></i>
          </transition>
          <p class="sidebarCount">{{ratings.likes}}</p>
        </div>
        <div class="icc" @click="action(0)">
          <transition name="el-zoom-in-bottom">
            <div v-show="userRatings.disliked">
              <i class="fa fa-thumbs-up fa-inverse fa-rotate-180 fa-stack-1x" aria-hidden="true"></i>
            </div>
          </transition>
          <transition name="el-zoom-in-top">
            <div v-show="!userRatings.disliked">
              <i
                class="fa fa-thumbs-o-up fa-inverse fa-rotate-180 fa-stack-1x iccTopBreaker"
                aria-hidden="true"
              ></i>
            </div>
          </transition>
          <p class="sidebarCount">{{ratings.dislikes}}</p>
        </div>
        <div class="icc">
          <i @click="copyLink" class="fa fa-external-link fa-inverse shareNudge" aria-hidden="true"></i>
        </div>
      </div>
      <div class="vidDiv">
        <video
          onclick="this.paused ? this.play() : this.pause();"
          fluid
          v-if="video.src!=''"
          id="mainPlayer"
          class="videoDiv"
          v-loading="loading"
          controls
          preload="auto"
          autoplay
        >
          <source :src="video.src" :type="video.mimetype" />
        </video>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";

export default {
  data() {
    return {
      video: null,
      nonExistent: true,
      loading: true,
      ratings: null,
      userRatings: null
    };
  },
  asyncData(context) {
    var nonExistent = false;
    var video, ratings, userRatings;
    return axios({
      url: `${context.env.baseUrl}/api/cv/${context.params.vid}`,
      method: "get",
      credentials: "same-origin",
      data: {
        id: context.params.vid,
        user: context.app.store.state.authUser
      }
    })
      .then(res => {
        if (res.data.meta.error == 0) {
          video = res.data.video;
          ratings = res.data.ratings;
          userRatings = res.data.userRatings;
        } else {
          nonExistent = true;
        }
        return {
          nonExistent: nonExistent,
          video: video,
          loading: false,
          userRatings: userRatings,
          ratings: ratings
        };
      })
      .catch(err => {
        console.log(err);
      });
  },
  methods: {
    action(action) {
      if (action ? this.userRatings.liked : this.userRatings.disliked) {
        //like
        //jau palaikinta/dislaikinta, revertinam
        if (action == 1) {
          this.userRatings.liked = false;
          this.ratings.likes--;
        } else if (action == 0) {
          this.userRatings.disliked = false;
          this.ratings.dislikes--;
        }
      } else {
        //normal like/dislike
        if (action == 1) {
          this.userRatings.liked = true;
          this.ratings.likes++;
        } else if (action == 0) {
          this.userRatings.disliked = true;
          this.ratings.dislikes++;
        }
      }
      axios({
        url: "/api/act",
        method: "put",
        credentials: "same-origin",
        data: {
          user: this.$store.state.authUser,
          videoID: this.video.videoID,
          action: action
        }
      })
        .then(res => {
          if (res.data.meta.error) {
            console.log(
              "error while performing " + (action == 0 ? "dislike" : "like")
            );
          }
        })
        .catch(function(e) {
          console.log(e);
        });
    },
    copyLink() {
      var outt = this;
      this.$copyText(this.video.link).then(
        function(e) {
          outt.$message({
            type: "success",
            message: "Copied link!",
            duration: 2000
          });
        },
        function(e) {
          outt.$message({
            type: "error",
            message: "Couldn't copy link!",
            duration: 2000
          });
        }
      );
    }
  },
  computed: {
    og_url() {
      return this.video
        ? "/v/" + this.video.videoID
        : "/404";
    },
    og_title() {
      return this.video ? this.video.name : "404";
    },
    og_type() {
      return "video.other";
      //maybe integrate with other formats
    },
    og_image() {
      return this.video ? "/videos/thumbs/" + this.video.videoID + ".jpg" : "";
    }
  },
  head() {
    return {
      title: this.video ? this.video.name : "404",
      meta: [
        { property: "og:url", content: this.og_url },
        { property: "og:title", content: this.og_title },
        { property: "og:type", content: this.og_type },
        { property: "og:image", content: this.og_image }
      ]
    };
  },
  layout: "video"
};
</script>

<style>
body {
  overflow: hidden;
}

@font-face {
  font-family: "LatoLight";
  src: url("/fonts/LatoLight/Lato-Light.eot"),
    url("/fonts/LatoLight/Lato-Light.woff") format("woff"),
    url("/fonts/LatoLight/Lato-Light.ttf") format("truetype");
  font-style: normal;
  font-weight: normal;
}

template {
  overflow: hidden;
}

.mainDiv {
  height: 100vh;
  width: 100vw;
}

.sideControls {
  position: absolute;
  left: 0;
  top: 0;
  width: 10vw;
  height: 20vh;
  background: transparent;
  display: block;
  text-align: center;
  font-size: 10vh;
  -webkit-transition-duration: 0.2s;
  transition-duration: 0.2s;
  -webkit-transition-property: color, background-color;
  transition-property: color, background-color;
  cursor: pointer;
}

.icc:hover {
  background-color: white;
  color: black;
  opacity: 0.95;
}

.icc:hover .fa {
  color: black;
}

.icc:hover .sidebarCount {
  color: black;
}

.icc:hover i {
  -webkit-text-stroke: 2px white;
}

#iccTop {
  margin-top: 20vh;
}

.iccTopBreaker {
  margin-top: 0.5vh;
}

.shareNudge {
  margin-top: 4vh;
}

.icc {
  position: relative;
  margin-top: 6vh;
  -webkit-transition-duration: 0.2s;
  transition-duration: 0.2s;
  -webkit-transition-property: color, background-color, -webkit-text-stroke;
  transition-property: color, background-color, -webkit-text-stroke;
  height: 17vh;
}

i {
  -webkit-transition-duration: 0.1s;
  transition-duration: 0.1s;
  -webkit-transition-property: -webkit-text-stroke;
  transition-property: -webkit-text-stroke;
  -webkit-text-stroke: 2px #191919;
}

.sidebarCount {
  font-size: 4vh;
  font-family: LatoLight;
  color: white;
  font-weight: bold;
  position: absolute;
  margin-top: 3vh;
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 70%);
}

.title {
  color: white;
  text-align: center;
  font-family: LatoLight;
  font-weight: 400;
}

.nonExistentText {
  color: white;
  text-align: center;
  font-family: LatoLight;
  background: gray;
  margin: auto;
  position: relative;
  top: 50%;
  transform: translateY(-50%);
}

.vidDiv {
  position: relative;
  text-align: center;
  margin: 0 auto;
  cursor: pointer;
  width: 70vw;
}

.videoDiv {
  height: 80vh;
}
</style>
