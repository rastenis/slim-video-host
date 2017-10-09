<template>
  <div class="mainDiv" @click="changeSrc">
      <video
        v-if="videoSrc!=''" 
        id="mainPlayer"
        class="video-js videoDiv"
        v-loading="loading" 
        controls
        preload="auto"
        autoplay 
        data-setup='{}'>
        <source :src="videoSrc" type="video/mp4"></source>
      </video>
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
    console.log("requested video ID - "+context.params.vid);
    return axios.get(`https://cigari.ga/api/checkVideo/${context.params.vid}`)
    .then((res) => {
      if(res.data.error==0){
        src=res.data.src;
        console.log("found video");
      }else{
        nonExistent = true;
        console.log("doesnt exist");
      }
      return { nonExistent: nonExistent, videoSrc:src,loading:false }
    })
  },
  methods:{
    changeSrc(){
      console.log(this.videoSrc);
    }
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

</style>
