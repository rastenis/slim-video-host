<template>
  <div class="mainDiv" v-loading="loading">
    <video :src="videoSrc">
      
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
  },
  layout:'video'
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

</style>
