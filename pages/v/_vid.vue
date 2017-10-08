<template>
  <div>
    <video :src="videoSrc">
      
    </video>
  </div>
</template>

<script>

//TODO:  single drag-drop (+ selection based also?) for uploading single video. Post it to backend and get link when uploaded. Generate link w/ shortID
import axios from 'axios'

export default {
  
  data () {
    return {
      videoSrc:'',
      nonExistent:true
    }
  },
  asyncData (context) {
    var nonExistent = false;
    var src='';
    console.log("requested video ID - "+context.params.vid);
    axios.get(`/api/checkVideo/${context.params.vid}`)
    .then((res) => {
      if(res.error==0){
        src=res.src;
        console.log("found video");
      }else{
        nonExistent = true;
        console.log("doesnt exist");
      }
      return { nonExistent: nonExistent, videoSrc:src }
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

</style>
