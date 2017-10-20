<template>
  <div v-if="$store.state.authUser">
    <h1 class="title">Dashboard</h1>
    <div v-if="$store.state.authUser.userStatus==1" class="pads">
      <el-row :gutter="20">
        <el-col class="adminVideoPanel panel" :span="12">
          <p class="adminPanelText">All Videos</p>
          <el-collapse>
            <el-collapse-item title="Expand videos" name="1">
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
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </el-col>
        <el-col class="adminStatsPanel panel" :span="12">
          <p class="adminPanelText">Stats</p>
          <div class="stats">
            <p>Total users registered: {{stats.userCount}}</p>
            <p>Total videos uploaded: {{stats.videoCount}}</p>
          </div>
        </el-col>
      </el-row>
    </div>
    <div v-else>
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
            <template slot-scope="scope">
              <el-button type="danger" size="small" @click.native.prevent="deleteVideo(scope.$index)">Remove</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
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
      videos:[],
      stats:{}
      }
  },
  asyncData (context) {
    try{
      if(context.app.store.state.authUser.userStatus==1){

       //fetchinam additional stats
      return axios({ 
        url: 'https://cigari.ga/api/getAdminStats',
        method:'post',
        credentials: 'same-origin',
        data: {
            user: context.app.store.state.authUser
        }
      })
      .then((res) => {
        if(res.data.error==0){
          return { stats: res.data.stats, loadingMore:false,videos:res.data.videos}
        }else if (res.data.error==1){
          console.log("error while fetching admin stats");
        }
      }).catch(function (e) {
        console.log(e);
      });

    }else{

      console.log("authuser is "+context.app.store.state.authUser);
      return axios({ 
        url: 'https://cigari.ga/api/getVideos',
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
    }

    }catch(e){
      console.log("skipping");
    }

  },
  methods:{
    async deleteVideo(index){
      this.$confirm('This will permanently delete the video. Continue?', 'Warning', {
          confirmButtonText: 'OK',
          cancelButtonText: 'Cancel',
          type: 'warning'
      }).then(()=>{
        var videoID = this.videos[index].videoID;
        console.log("removing video: "+videoID+", index is "+index);
        console.log("authuser is "+this.$store.state.authUser);
        this.videos.splice(index,1);
      
        axios({ 
          url: 'https://cigari.ga/api/removeVideo',
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
            this.$message({
              type: 'success',
              message: 'Delete successful'
            });   

          }else if (res.data.error==1){
            console.log("error while deleting video");
          }
        }).catch(function (e) {
          console.log(e);
        });

      }).catch(()=>{
        this.$message({
          type: 'info',
          message: 'Delete canceled'
        });   

      });
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
  @font-face {
    font-family: "LatoLight";
    src: url("/fonts/LatoLight/Lato-Light.eot"),
    url("/fonts/LatoLight/Lato-Light.woff") format("woff"),
    url("/fonts/LatoLight/Lato-Light.ttf") format("truetype");
    font-style: normal;
    font-weight: normal;
  }

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
    font-family: LatoLight;
    font-size: 50px;
    padding-top:10vh;
    padding-left:3vw;
  }

  .adminVideoPanel{
    background: #d3dce6;
  }

  .videoPanelExpander{
    background: #d8cdd7;
  }

  .adminStatsPanel{
    background: #cbcad0;
    
  }

  .adminPanelText{
    text-align: center;
    font-family: LatoLight;
    font-size:20px;
  }

  .panel{
    border-radius: 15px;
    min-height: 40vh;
  }

  .pads{
    padding:3vh;
  }

  .stats{
    padding: 1vh;
    font-family: LatoLight;
  }

</style>
