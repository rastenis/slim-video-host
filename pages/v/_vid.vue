<template>

  <div class="mainDiv">
      <div v-if="nonExistent" class="nonExistentText">
        <h1>
          Requested video does not exist. (404)
        </h1>
      </div >
      <div v-else>
        <h1 class="title">{{video.name}}</h1>
        <div class="sideControls" v-if="$store.state.authUser">
          <div class="icc">
            <i class="fa fa-thumbs-o-up fa-inverse" aria-hidden="true"></i>
            <p class="sidebarCount">{{video.likes}}</p> 
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
            autoplay>
            <source :src="video.src" type="video/mp4"></source>
          </video>
        </div>
      </div>

  </div>
</template>

<script>

import axios from 'axios';

export default {
  data () {
    return {
      video:null,
      nonExistent:true,
      loading:true
    }
  },
  asyncData (context) {
    var nonExistent = false;
    var video;
    console.log("requested video ID - "+context.params.vid);

    return axios({ 
      url: `http://cigari.ga/api/cv/${context.params.vid}`,
      method:'GET',
      credentials: 'same-origin',      
      data:{
        id: context.params.vid
      }
    })
    .then((res) => {
      if(res.data.error==0){
        video=res.data.video;
        console.log("found video");
      }else{
        nonExistent = true;
        console.log("video doesnt exist");
      }
      return { nonExistent: nonExistent, video:video,loading:false };
    })
    .catch((err)=>{
      console.log(err);
    });
  },
  layout:'video'
}
</script>


<style>

  body{
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

  template{
    overflow: hidden;
  }

  .mainDiv{
    height: 100vh;
    width: 100vw;
  }


  .sideControls{
    position: absolute;
    left: 0;
    top:30vh;
    width:10vw;
    height: 20vh;
    background:transparent;
    text-align: center;
    font-size:10vh;
    -webkit-transition-duration: 0.15s;
    transition-duration: 0.15s;
    -webkit-transition-property: color, background-color;
    transition-property: color, background-color;
    cursor: pointer;
  }

  .sideControls:hover {
    background-color: white;
    color: black;
    opacity:0.95;
  }
  .icc{
    position: relative;
    top: 50%;
    transform: translateY(-50%);
    margin: 0 auto;
    -webkit-transition-duration: 0.2s;
    transition-duration: 0.2s;
    -webkit-transition-property: color;
    transition-property: color;
  }

  .sideControls:hover .fa {
    color: black;
  }
  .sideControls:hover .sidebarCount {
    color: black;
  }
  .sidebarCount{
    font-size: 3vh;
    font-family: LatoLight;
    color:white;
    font-weight: bold;
    position: relative;
    margin-top:-1vh;
  }
  .title{
    color: white;
    text-align: center;
    font-family: LatoLight;
    font-weight: 400;
  }

  .nonExistentText{
    color: white;
    text-align: center;
    font-family: LatoLight;
    background: gray;
    margin: auto; 
    position: relative;
    top: 50%;
    transform: translateY(-50%);
  }

  .vidDiv{
    position: relative;
    text-align: center;
    margin:0 auto;
    cursor:pointer;
    width: 70vw;
  }

  .videoDiv{
    height:80vh;
  }

  

</style>
