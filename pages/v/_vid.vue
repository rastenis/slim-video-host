<template>

<div class="mainDiv">
  <div v-if="nonExistent" class="nonExistentText">
    <h1>
      Requested video does not exist. (404)
    </h1>
  </div>
  <div v-else>
    <h1 class="title">{{video.name}}</h1>
    <div class="sideControls" v-if="$store.state.authUser">
      <div class="icc" id="iccTop" @click="like()">
        <i class="fa fa-thumbs-o-up fa-inverse" aria-hidden="true"></i>
        <p class="sidebarCount">{{ratings.likes}}</p>
      </div>
      <div class="icc" @click="dislike()">
        <i class="fa fa-thumbs-o-up fa-inverse fa-rotate-180" aria-hidden="true"></i>
        <p class="sidebarCount">{{ratings.dislikes}}</p>
      </div>
      <div class="icc">
        <i @click="copyLink" class="fa fa-external-link fa-inverse shareNudge" aria-hidden="true"></i>
      </div>
    </div>
    <div class="vidDiv">
      <video onclick="this.paused ? this.play() : this.pause();" fluid v-if="video.src!=''" id="mainPlayer" class="videoDiv" v-loading="loading" controls preload="auto" autoplay >
        <source :src="video.src" type="video/mp4"></source>
      </video>
    </div>
  </div>

  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      video: null,
      nonExistent: true,
      loading: true,
      ratings:null,
      userRatings:null
    }
  },
  asyncData(context) {
    var nonExistent = false;
    var video,ratings,userRatings;

    return axios({
        url: `http://cigari.ga/api/cv/${context.params.vid}`,
        method: 'GET',
        credentials: 'same-origin',
        data: {
          id: context.params.vid
        }
      })
      .then((res) => {
        if (res.data.error == 0) {
          video = res.data.video;
          ratings = res.data.ratings;
          userRatings=res.data.userRatings;
        } else {
          nonExistent = true;
        }
        return {
          nonExistent: nonExistent,
          video: video,
          loading: false,
          userRatings:userRatings,
          ratings:ratings
        };
      })
      .catch((err) => {
        console.log(err);
      });
  },
  methods: {
    action(action){
      if(action ? userRatings.liked : userRatings.disliked){ //like
        //jau palaikinta/dislaikinta, revertinam
        if(action==1){
          this.userRatings.liked=false;
          this.ratings.likes--;
        }else if(action==0){
          this.userRatings.disliked=false;
          this.ratings.dislikes--;
        }
      }else{
        //normal like/dislike
        if(action==1){
          this.userRatings.liked=true;
          this.ratings.likes++;
        }else if(action==0){
          this.userRatings.disliked=true;
          this.ratings.dislikes++;
        }
      }
      axios({
        url: 'https://cigari.ga/api/act',
        method: 'post',
        credentials: 'same-origin',
        data: {
          user: this.$store.state.authUser,
          videoID: this.video.videoID,
          action:action
        }
      })
      .then((res) => {
        if (res.data.error) {
          console.log("error while performing "+(action==0 ? "dislike" : "like"));
        } else {
          console.log("Successfully performed action. Updating local representation...");
        }
      }).catch(function (e) {
        console.log(e);
      });
    },
    copyLink() {
      var outt = this;
      this.$copyText(this.video.link)
        .then(function (e) {
          outt.$message({
            type: "success",
            message: "Copied link!",
            duration: 2000
          });
        }, function (e) {
          outt.$message({
            type: "error",
            message: "Couldn't copy link!",
            duration: 2000
          });
        });
    }
  },
  layout: 'video'
}
</script>

<style>
body {
  overflow: hidden;
}

@font-face {
  font-family: "LatoLight";
  src: url("/fonts/LatoLight/Lato-Light.eot"), url("/fonts/LatoLight/Lato-Light.woff") format("woff"), url("/fonts/LatoLight/Lato-Light.ttf") format("truetype");
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
  font-size: 3vh;
  font-family: LatoLight;
  color: white;
  font-weight: bold;
  position: relative;
  margin-top: 0vh;
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
