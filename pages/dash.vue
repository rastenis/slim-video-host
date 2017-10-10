<template>
  <div v-if="$store.state.authUser">
    <h1 class="title" >Dashboard</h1>
    <div v-if="videos.length==0" class="centeredUploadVideoSuggestion">
      <p>You don't have any videos yet!</p>
      <el-button @click="$store.app.router.push('/upload'); this.$store.state.activeTab = '3';">
        Upload a video
      </el-button>
    </div>
    <div class="videoList" v-else>
      <el-table
        :data="videos"
        style="width: 100%">
        <el-table-column
          prop="name"
          label="Video">
        </el-table-column>
        <el-table-column
          prop="link"
          label="Link"
          @click.native="$event.target.select()">
        </el-table-column>
        <el-table-column
          prop="views"
          label="Views">
        </el-table-column>
        <el-table-column
          label="Actions">
          <template scope="scope">
            <el-button type="danger" size="small" @click.native.prevent="deleteVideo(scope.$index)">Remove</el-button>
          </template>
      </el-table-column>
      </el-table>

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
    console.log("authuser is "+context.app.store.state.authUser);
    return axios({ 
      url: 'http://cigari.ga/api/getVideos',
      method:'post',
      credentials: 'same-origin',
      data: {
          user: context.app.store.state.authUser
      }
    })
    .then((res) => {
      console.log("res data is"+res.data);
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
    async deleteVideo(index){
      var videoID = this.videos[index].videoID;
      console.log("removing video: "+videoID);
      console.log("authuser is "+this.$store.state.authUser);

      axios({ 
        url: 'http://cigari.ga/api/removeVideo',
        method:'post',
        credentials: 'same-origin',
        data: {
            user: this.$store.state.authUser,
            videoID:videoID
        }
      })
      .then((res) => {
        if(res.data.error==0){
          console.log("removed video");
          this.$message.success("Successfully removed video!");
          this.videos = this.videos.filter(function(el){ return el.videoID != videoID; });
        }else if (res.data.error==1){
          console.log("error while deleting video");
        }
      }).catch(function (e) {
        console.log(e);
      });
    
  }},  
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
    width: 90%;
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
