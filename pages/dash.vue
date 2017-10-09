<template>
  <div v-if="$store.state.authUser">
    <h1 class="title" @click="test">Dashboard</h1>
    <div v-if="videos.length==0" class="centeredUploadVideoSuggestion">
      <p>You don't have any videos yet!</p>
      <el-button @click="$store.app.router.push('/upload'); this.$store.state.activeTab = '3';">
        Upload a video
      </el-button>
    </div>
    <div class="videoList" v-else>
      <el-card v-loading="loadingMore" element-loading-text="Loading..." v-for="video in videos" class="videoCard" :key="video.ID">
        <p>{{video.name}}</p>
        <el-input v-model="video.link" readonly @click.native="$event.target.select()"></el-input>
      </el-card>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
//TODO:  v-for get all video links w/ titles and views into CARDS (if w/ thumbnails) or just LIST ITEMS (w/o thumbnails)

export default {
  data () {
    return {
      loadingMore:true,
      videos:[]
      }
  },
  asyncData (context) {
    console.log(context.app.store.state.authUser);
    return axios({ 
      url: '/api/getVideos',
      method:'post',
      headers : {
          'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      data: {
          user: context.app.store.state.authUser
      }
    })
    .then((res) => {
      console.log(res);
      if(res.data.error==0){
        console.log("fetched videos");
        return { videos: res.data.videos, loadingMore:false}
      }else if (res.data.error==1){
        console.log("error while fetching videos");
      }
      
    }).catch(function (e) {
      console.log(e);
    });

  },
  methods:{
    test(){
      console.log(this.videos);
    }
  },  
  created:function(){
  //authUser checkeris
    if(!this.$store.state.authUser){
      this.$store.app.router.push("/")
    }else{
      this.$store.state.activeTab = '2';
    }

  },
  layout:'main'
}
</script>


<style>
  .videoList{
    padding-top:10vh;
    position: relative;
    margin: auto;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: 80%;
    width: 70%;
  }
  .videoCard{
    width:80%;
  }

  .centeredUploadVideoSuggestion{
    text-align: center;
    position: absolute;
    margin: auto;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: 30%;
    width: 30%;
    content: center;
    font-size: 2vh; 
  }

  .title{
    font-weight: lighter;
    font-size: 50px;
    padding-top:10vh;
    padding-left:3vw;
  }
</style>
