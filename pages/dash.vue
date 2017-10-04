<template>
  <div v-if="$store.state.authUser">
    <div v-if="$store.state.authUser.videos.length==0" class="centeredUploadVideoSuggestion">
      <p>You don't have any videos yet!</p>
      <el-button @click="goToUpload()">
        Upload a video
      </el-button>
    </div>
    <div v-else>
      <el-card v-for="video in $store.state.authUser.videos" class="videoCard" :key="video.ID">
        <p>{{video.name}}</p>
        <el-input v-model="video.link" disabled @click="this.select()"></el-input>
      </el-card>
    </div>
  </div>
</template>

<script>

//TODO:  v-for get all video links w/ titles and views into CARDS (if w/ thumbnails) or just LIST ITEMS (w/o thumbnails)

export default {
  data () {
    return {
      activeIndex: "2",
      activeIndexUnreg: "2"
    }
  },
  methods:{

  },  
  created:function(){
  //authUser checkeris
    if(!this.$store.state.authUser){
      this.$store.app.router.push("/")
    }
  },
  layout:'main'
}
</script>


<style>
  .RegForm{
    position: absolute;
    margin: auto;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: 50%;
    width: 40%;
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
</style>
