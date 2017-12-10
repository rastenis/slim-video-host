<template>
  <div class="mainDiv">
      <div v-if="nonExistent" class="nonExistentText">
        <h1>
          Requested video does not exist. (404)
        </h1>
      </div >

      <div v-else class="vidDiv">
        <video
          fluid 
          v-if="videoSrc!=''" 
          id="mainPlayer"
          class="video-js videoDiv"
          v-loading="loading" 
          controls
          preload="auto"
          autoplay>
          <source :src="videoSrc" type="video/mp4"></source>
        </video>
      </div>

  </div>
</template>

<script>

import axios from 'axios'

export default {
  data () {
    return {
      videoSrc:'',
      nonExistent:true,
      loading:true
    }
  },
  asyncData (context) {
    var nonExistent = false;
    var src='';
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
        src=res.data.src;
      }else{
        nonExistent = true;
      }
      return { nonExistent: nonExistent, videoSrc:src,loading:false };
    })
    .catch((err)=>{
      console.log(err);
    });
  },
  layout:'video',
  head: {
    script: [
      { src: '//vjs.zencdn.net/5.19/video.min.js' }
    ],
    link: [
      { rel: 'stylesheet', href: '//vjs.zencdn.net/5.19/video-js.min.css' }
    ]
  }
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

  .videoDiv{
    margin: auto; 
    position: relative;
    top: 50%;
    transform: translateY(-50%);
    
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
    height: 80%;
    width: 80%;
  }

</style>
