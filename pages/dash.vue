<template>
  <div v-if="$store.state.authUser">
    <h1 class="title">{{($store.state.authUser.userStatus==1 ? "Admin panel" : "Dashboard")}}</h1>
    <div v-if="$store.state.authUser.userStatus==1" class="pads">
      <div>
        <el-row :gutter="20">
          <el-col class="" :span="12">
            <el-card class="box-card ">
              <div slot="header" class="clearfix">
                <span class="headerOfStatCard">Uploaded videos</span>
              </div>
              <div class="text item">
                Total views: {{stats.totalViews}}
              </div>
              <div class="text item">
                Active videos: {{videos.length}}
              </div>
            </el-card>
          </el-col>
          <el-col class="" :span="12">
            <el-card class="box-card">
              <div slot="header" class="clearfix">
                <span class="headerOfStatCard">Statistics</span>
              </div>
              <div class="text item">
                Total users registered: {{stats.userCount}}
              </div>
              <div class="text item">
                Total videos uploaded: {{stats.videoCount}}
              </div>
              <div class="text item">
                Max storage space: {{stats.totalSpaceA*0.000001}} MB
              </div>
              <div class="text item">
                Space used: {{stats.usedSpaceA.toFixed(1)}} / {{stats.totalSpaceA*0.000001}} MB
              </div>
            </el-card>
          </el-col>
        </el-row>
        <el-table :data="videos" style="width: 100%; margin-top:4vh;">
          <el-table-column prop="name" label="Video">
            <template slot-scope="scope">
              <div class="nameColumn">
                {{videos[scope.$index].name}}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="Link">
            <template slot-scope="scope">
              <div class="linkColumn">
                <a :href="videos[scope.$index].link">{{videos[scope.$index].link}}</a>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="views" label="Views">
          </el-table-column>
          <el-table-column label="Actions">
            <template slot-scope="scope">
              <el-button disabled type="danger" size="small" @click.native.prevent="deleteVideo(scope.$index)">Remove</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <div v-else>
      <div v-if="videos.length==0" class="centeredUploadVideoSuggestion">
        <el-card>
          <p>You don't have any videos yet!</p>
          <el-button @click="$store.app.router.push('/upload'); this.$store.state.activeTab = '3';">
            Upload a video
          </el-button>
        </el-card>
      </div>
      <div class="videoList" v-else>
        <div class="cards">
          <el-card class="box-card statCard">
            <div slot="header" class="clearfix">
              <span class="headerOfStatCard">Video stats</span>
            </div>
            <div class="text item">
              Total views: {{stats.totalViews}}
            </div>
            <div class="text item">
              Active videos: {{videos.length}}
            </div>
          </el-card>
          <el-card class="box-card statCard">
            <div slot="header" class="clearfix">
              <span class="headerOfStatCard">Storage</span>
            </div>
            <div class="text item">
              Total storage space: {{stats.totalSpace}} MB
            </div>
            <div class="text item">
              Space used: {{stats.usedSpace}} / {{stats.totalSpace}} MB
            </div>
            <div class="text item">
              <el-button type="text" @click="storageUpgradeInit">Apply for an upgrade</el-button>
            </div>
          </el-card>
          <el-card class="box-card statCard">
            <div slot="header" class="clearfix">
              <span class="headerOfStatCard">Your stats</span>
            </div>
            <div class="text item">
              Total views: {{stats.totalViews}}
            </div>
            <div class="text item">
              Space used: {{stats.usedSpace}} / {{stats.totalSpace}} MB
            </div>
          </el-card>
        </div>
        <h2 class="subtitle1">Your videos:</h2>
        <el-table :data="videos" style="width: 100%" @selection-change="handleSelectionChange" ref="videoTable">
          <el-table-column type="selection" width="40">
          </el-table-column>
          <el-table-column prop="name" label="Video">
            <template slot-scope="scope">
              <div class="nameColumn">
                {{videos[scope.$index].name}}
                <i class="fa fa-pencil fa-lg renameIcon" aria-hidden="false" @click="requestNewName(scope.$index)"></i>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="Link" @click.native="$event.target.select()" width="250">
            <template slot-scope="scope">
              <div class="linkColumn">
                <a :href="videos[scope.$index].link">{{videos[scope.$index].link}}</a>
                <el-tooltip :content="currentCopyTooltip" :enterable="false" transition="el-zoom-in-top">
                  <i class="fa fa-clipboard fa-lg copyIcon" aria-hidden="false" @click="copyLink(videos[scope.$index].link)"></i>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="views" label="Views" width="100">
          </el-table-column>
          <el-table-column label="Ratings">
            <template slot-scope="scope" class="ratingColumn">
              <i class="fa fa-thumbs-up" style="color:green;" aria-hidden="true"></i>
              {{videos[scope.$index].likes}} | {{videos[scope.$index].dislikes}}
              <i class="fa fa-thumbs-up fa-rotate-180" style="color:red;" aria-hidden="true"></i>
            </template>
          </el-table-column>
          <el-table-column label="Actions">
            <template slot-scope="scope">
              <el-button :disabled="multipleSelection.length!=0" type="warning" size="small" @click.native.prevent="requestNewID([videos[scope.$index]])">New link</el-button>
              <el-button :disabled="multipleSelection.length!=0" type="danger" size="small" @click.native.prevent="deleteVideo([videos[scope.$index]])">Remove</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-card v-if="multipleSelection.length!=0" class="multiSelectActions">
          <el-button type="warning" size="medium" @click.native.prevent="requestNewID(multipleSelection)">New links for selected</el-button>
          <el-button type="danger" size="medium" @click.native.prevent="deleteVideo(multipleSelection)">Remove selected</el-button>
        </el-card>
      </div>
    </div>
  </div>
</template>


<script>
import axios from 'axios'
export default {
  data() {
    return {
      loadingMore: true,
      videos: [],
      stats: {},
      currentCopyTooltip: "Click to copy!",
      multipleSelection: []
    }
  },
  asyncData(context) {
    try {
      if (context.app.store.state.authUser.userStatus == 1) {
        //fetchinam additional stats
        return axios({
            url: 'https://cigari.ga/api/getAdminStats',
            method: 'post',
            credentials: 'same-origin',
            data: {
              user: context.app.store.state.authUser
            }
          })
          .then((res) => {
            if (res.data.error == 0) {
              return {
                stats: res.data.stats,
                loadingMore: false,
                videos: res.data.videos
              }
            } else if (res.data.error == 1) {}
          }).catch(function (e) {
            console.log(e);
          });
      } else {
        return axios({
            url: 'https://cigari.ga/api/getVideos',
            method: 'post',
            credentials: 'same-origin',
            data: {
              user: context.app.store.state.authUser
            }
          })
          .then((res) => {
            console.log("res data is" + res.data);
            if (res.data.error == 0) {
              return {
                videos: res.data.videos,
                loadingMore: false
              }
            } else if (res.data.error == 1) {
              console.log("error while fetching videos");
            }
          }).catch(function (e) {
            console.log(e);
          });
      }
    } catch (e) {}
  },
  mounted() {
    if (!this.$store.state.authUser.userStatus == 1) {
      console.log("messing w/ some stats");
      this.setUpStats();
    } else {
      this.setUpAdminStats();
    }
  },
  created() {
    if (!this.$store.state.authUser) {
      this.$store.app.router.push("/")
    } else {
      this.$store.state.activeTab = '2';
    }
  },
  methods: {
    async deleteVideo(selects) {
      this.$confirm('This will permanently delete the selected videos. Continue?', 'Warning', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }).then(() => {
        console.log(selects);
        axios({
            url: 'https://cigari.ga/api/removeVideo',
            method: 'post',
            credentials: 'same-origin',
            data: {
              user: this.$store.state.authUser,
              selection: selects
            }
          })
          .then((res) => {
            res.data.selection.forEach(selection => {
              this.videos.splice(selection.index, 1);
            });
            this.$message({
              type: res.data.msgType,
              message: res.data.msg
            });
            if (res.data.error == 0) {
              this.stats.usedSpace -= this.videos[index].size;
            } else if (res.data.error == 1) {
              console.log("error while bulk deleting videos");
            }
          }).catch(function (e) {
            console.log(e);
          });

      }).catch(() => {});
    },
    async requestNewID(selection) {
      this.$confirm('This will generate new links for all selected videos. Continue?', 'Warning', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }).then(() => {
        axios({
            url: 'https://cigari.ga/api/newLink',
            method: 'post',
            credentials: 'same-origin',
            data: {
              user: this.$store.state.authUser,
              selection: selection
            }
          })
          .then((res) => {
            this.$message({
              type: res.data.msgType,
              message: res.data.msg
            });
            if (res.data.error == 0) {
              this.multipleSelection = [];
              //TODO: update local representation 
              this.videos.forEach((video, index) => {
                res.data.newData.forEach(newVideo => {
                  if (newVideo.videoID == video.videoID) { //update local
                    this.videos[index].videoID = newVideo.newVideoID;
                    this.videos[index].link = newVideo.newLink;
                  }
                });
              });
            } else if (res.data.error == 1) {
              console.log("error while bulk requesting new ids");
            }
          }).catch(function (e) {
            console.log(e);
          });

      }).catch(() => {});
    },
    handleSelectionChange(val) {
      this.multipleSelection = val;
      console.log(this.multipleSelection);

    },
    redirect(link) {
      this.redirect(link);
    },
    copyLink(link) {
      var outt = this;
      this.$copyText(link)
        .then(function (e) {
          outt.currentCopyTooltip = "Copied!";
        }, function (e) {
          outt.currentCopyTooltip = "Couldn't copy :(";
        });
      setTimeout(() => {
        this.currentCopyTooltip = "Click to copy!";
      }, 1000);
    },
    async requestNewName(index) {
      this.$prompt('Input the new name:', 'Rename', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel'
      }).then((value) => {
        var videoID = this.videos[index].videoID;
        console.log("requesting new name for video: " + videoID + ", index is " + index + ", name is " + value.value);
        axios({
            url: 'https://cigari.ga/api/rename',
            method: 'post',
            credentials: 'same-origin',
            data: {
              user: this.$store.state.authUser,
              videoID: videoID,
              newName: value.value
            }
          })
          .then((res) => {
            this.$message({
              type: res.data.msgType,
              message: res.data.msg
            });
            if (res.data.error) {
              console.log("error while asking for new video name");
            } else {
              console.log("Successfully updated. Updating local representation...");
              this.videos[index].name = res.data.newName;
            }
          }).catch(function (e) {
            console.log(e);
          });
      }).catch(() => {});
    },
    setUpStats() {
      var totalViews = 0;
      this.videos.forEach(element => {
        totalViews += element.views;
      });
      this.stats.totalViews = totalViews;
      this.stats.totalSpace = this.$store.state.authUser.totalSpace;
      this.stats.usedSpace = (this.stats.totalSpace - this.$store.state.authUser.remainingSpace).toFixed(1);
    },
    setUpAdminStats() {
      this.stats.uploadDates = [];
      this.videos.forEach(video => {
        this.stats.uploadDates.push(video.uploadDate);
      });
    },
    async storageUpgradeInit() {
      this.$prompt('Please input a promotion code', 'Upgrade', {
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        inputErrorMessage: 'Invalid code'
      }).then(value => {
        //activating the code
        axios({
            url: 'https://cigari.ga/api/upgradeStorage',
            method: 'post',
            credentials: 'same-origin',
            data: {
              user: this.$store.state.authUser,
              code: value.value
            }
          })
          .then((res) => {
            this.$message({
              type: res.data.msgType,
              message: res.data.msg
            });
          }).catch(function (e) {
            console.log(e);
          });
      });
    }
  },
  layout: 'main',
  transition: 'mainTransition'
}
</script>

<style>
  .multiSelectActions{
    margin-top:vh;
    height:10vh;
    margin-bottom:5vh;
  }
  .videoList{
    padding-top:5vh;
    position: relative;
    margin: auto;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: 80%;
    width: 90%;
  }

  .ratingColumn{
    display: inline-block;
  }
  
  .videoCard{
    width:80%;
  }
  .subtitle1{
    font-weight: 300;
  }

  .headerOfStatCard{
    font-size:3vh;
  }

  .statCard{
    width:19vw;
    margin-right:3vw;
  }

  .adminStatCard{
    width:35vw;
    margin-right:3vw;
  }


  .cards{
    display: flex;
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

  .subtitle1{
    font-family: LatoRegular;
    padding-top:2vh;
  }
  .renameIcon{
    cursor: pointer;
    display: none;
  }

  .nameColumn:hover .renameIcon {
    display: inline;
  }
  
  .copyIcon{
    cursor: pointer;
    display: none;
    margin-left:1vh;
  }

  .linkColumn:hover .copyIcon {
    display: inline;
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
