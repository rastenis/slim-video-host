<template>
  <div v-if="$store.state.authUser">
    <h1 class="title">Dashboard</h1>
    <div v-if="$store.state.authUser.videos.length==0" class="centeredUploadVideoSuggestion">
      <p>You don't have any videos yet!</p>
      <el-button @click="$store.app.router.push('/upload'); this.$store.state.activeTab = '3';">
        Upload a video
      </el-button>
    </div>
    <div class="videoList" v-else>
      <el-card v-loading="loadingMore" element-loading-text="Loading..." v-for="video in $store.state.authUser.videos" class="videoCard" :key="video.ID">
        <p>{{video.name}}</p>
        <el-input v-model="video.link" readonly @click.native="$event.target.select()"></el-input>
      </el-card>
    </div>
  </div>
</template>

<script>

//TODO:  v-for get all video links w/ titles and views into CARDS (if w/ thumbnails) or just LIST ITEMS (w/o thumbnails)

export default {
  data () {
    return {loadingMore:false}
  },
  methods:{
    async fetchVideos(){
      try{
        await this.$store.dispatch('getVideos', {
          username: this.form.username
        })
      }catch(e){

      }

    }
  },  
  created:function(){
  //authUser checkeris
    if(!this.$store.state.authUser){
      this.$store.app.router.push("/")
    }else{
      this.$store.state.activeTab = '2';
    }

    this.fetchVideos();
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
