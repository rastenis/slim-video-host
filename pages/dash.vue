// dash.vue:
// User/Admin dashboard,
// Contains global and per-user video lists
// (video management + statistics).
// Also includes user space upgrade method.

<template>
  <div v-if="$store.state.authUser">
    <h1 class="title">{{($store.state.authUser.userStatus==1 ? "Admin panel" : "Dashboard")}}</h1>
    <!-- Admin panel -->
    <div v-if="$store.state.authUser.userStatus==1" class="pads">
      <div>
        <!-- Admin stats -->
        <el-row :gutter="20">
          <el-col class="" :span="12">
            <el-card class="box-card" v-loading="dataLoads.loading.panels">
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
            <el-card class="box-card" v-loading="dataLoads.loading.panels">
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
                Space used: {{stats.usedSpaceA}} / {{stats.totalSpaceA*0.000001}} MB
              </div>
            </el-card>
          </el-col>
        </el-row>
        <!-- Global video table -->
        <el-table :data="videos" v-loading="dataLoads.loading.videoList" @selection-change="handleSelectionChange" ref="videoTable" style="width: 100%;margin-top:4vh">
          <el-table-column type="selection" width="40">
          </el-table-column>
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
        </el-table>
        <el-card>
          <el-button :disabled="multipleSelection.length==0" type="danger" size="small" @click.native.prevent="deleteVideo(multipleSelection)">Remove selected</el-button>
          <el-select v-model="warning" placeholder="No warning" style=" margin-left:2vw; ">
            <el-option
              v-for="item in warnOpts"
              :key="item.value"
              :label="item.label"
              :value="item.value" 
              :style="item.style">
            </el-option>
          </el-select>
        </el-card>
      </div>
    </div>
    <!-- Normal user dashboard -->
    <div v-else>
      <div v-if="videos.length==0 && searchTerm=='' && hasVideos==false && !dataLoads.loading.videoList" class="centeredUploadVideoSuggestion">
        <el-card>
          <div v-if="$store.state.authUser.accountStanding==2">
            <p style="display:block;">Suspended.</p>
            <el-button @click="upgradeInit">
              Use code
            </el-button>
          </div>
          <div v-else>
          <p>You don't have any videos yet!</p>
          <el-button @click="$store.app.router.push('/upload'); this.$store.state.activeTab = '3';">
            Upload a video
          </el-button>
          </div>
        </el-card>
      </div>
      <div class="videoList" v-else>
        <!-- Statistics cards -->
        <div class="cards">
          <el-card class="box-card statCard" v-loading="dataLoads.loading.panels">
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
          <el-card class="box-card statCard" v-loading="dataLoads.loading.panels">
            <div slot="header" class="clearfix">
              <span class="headerOfStatCard">Storage</span>
            </div>
            <div class="text item">
              Total storage space: {{stats.totalSpace}} MB
            </div>
            <div class="text item">
              Space used: {{stats.usedSpace}} / {{stats.totalSpace}} MB
            </div>
          </el-card>
          <el-card class="box-card statCard" v-loading="dataLoads.loading.panels">
            <div slot="header" class="clearfix">
              <span class="headerOfStatCard">Account standing</span>
            </div>
            <!-- no warnings -->
            <div v-if="$store.state.authUser.accountStanding===0">
              <div class="text item">
                Status: 
                All fine.
                <i class="fa fa-check fa-lg" style="color:#98FB98; -webkit-text-stroke: 2px white;" aria-hidden="true"></i>
              </div>
            </div>
            <!-- warned about video content -->
            <div v-else-if="$store.state.authUser.accountStanding===1">
              <div class="text item">
                Status: 
                Warned
                <el-tooltip class="item" effect="light" content="Some of your videos have been deleted because they contained forbidden content." placement="top-start">
                  <i class="fa fa-exclamation fa-lg" style="color:#f98300;" aria-hidden="true"></i>
                </el-tooltip>
              </div>
            </div>
            <div v-else-if="$store.state.authUser.accountStanding===2">
              <div class="text item">
                Status: 
                Blocked
                <el-tooltip class="item" effect="light" content="An admin forbade you from uploading new videos." placement="top-start">
                  <i class="fa fa-times fa-lg" style="color:#ff2222;" aria-hidden="true"></i>
                </el-tooltip>
              </div>
            </div>
            <div class="text item">
              <el-button type="text" @click="upgradeInit">Enter upgrade code</el-button>
            </div>
          </el-card>
        </div>
        <!-- Video list/table -->
        <h2 class="subtitle1">Your videos:</h2>
        <el-card>
          <el-button :disabled="multipleSelection.length==0" type="warning" size="medium" @click.native.prevent="requestNewID(multipleSelection)">New links for selected</el-button>
          <el-button :disabled="multipleSelection.length==0" type="danger" size="medium" @click.native.prevent="deleteVideo(multipleSelection)">Remove selected</el-button>
          <el-input @keyup.native="updateFilter" class="searchField" v-model="searchTerm" placeholder="Search videos..."></el-input>
        </el-card>
          <transition  name="el-fade-in">
            <el-table :data="videos" v-loading="dataLoads.loading.videoList" style="width: 100%" @selection-change="handleSelectionChange" ref="videoTable">
              <el-table-column type="selection" width="40">
              </el-table-column>
              <el-table-column prop="thumbnail" label="Thumbnail">
                <template slot-scope="scope">
                  <div class="thumbnailColumn">
                    <img :src="videos[scope.$index].thumbnailSrc" alt="">
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="Name">
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
              <el-table-column prop="views" sortable label="Views" width="100">
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
                  <el-form size="small">
                    <el-form-item>
                      <el-button :disabled="multipleSelection.length!=0" type="warning" size="small" @click.native.prevent="requestNewID([videos[scope.$index]])">New link</el-button>
                    </el-form-item>
                    <el-form-item>
                      <el-button :disabled="multipleSelection.length!=0" type="danger" size="small" @click.native.prevent="deleteVideo([videos[scope.$index]])">Remove</el-button>
                    </el-form-item>
                  </el-form>
                </template>
              </el-table-column>
            </el-table>
          </transition>
      </div>
    </div>
  </div>
</template>


<script>
import axios from "axios";
export default {
  data() {
    return {
      dataLoads: {
        loading: {
          panels: true,
          videoList: true
        }
      },
      loading: true,
      videos: [],
      hasVideos: false,
      hiddenVideos: [],
      stats: {},
      currentCopyTooltip: "Click to copy!",
      multipleSelection: [],
      searchTerm: "",
      warning: null,
      settings:{}
    };
  },
  asyncData(context){
    if (context.app.store.state.settings.loaded) {
      return;
    }else{
      return axios({
        url: "https://cigari.ga/api/settings",
        method: "get",
        credentials: "same-origin",
        data: {
        }
      })
      .then(res => {
        try {
          if (res.data.error == 0) {
            return{
              settings:res.data.settings
            };
          } 
        } catch (err) {
          console.log(err);
        }
      })
      .catch(function (e) {
        console.log(e);
      });
    }
  },
  mounted() {

    // badge handling
    if (this.$store.state.newUploadNotif>0) {
      this.$store.commit("RESET_UPLOAD_NOTIFS");
    }

    // storing settings if unset
    if (!this.$store.state.settings.loaded) {
      this.$store.commit("SET_SETTINGS",this.settings);
    }

    // non logged in bounce
    if (!this.$store.state.authUser) {
      this.$nuxt._router.push("/");
      return;
    } else {
      this.$store.state.activeTab = "2";
    }

    // stats
    if (!this.$store.state.authUser.userStatus == 1) {
      this.setUpStats();
    } else {
      this.setUpAdminStats();
    }
    // videos
    if (this.$store.state.authUser.userStatus == 1) {
      //fetchinam additional stats
      return axios({
          url: "https://cigari.ga/api/getAdminStats",
          method: "post",
          credentials: "same-origin",
          data: {
            user: this.$store.state.authUser
          }
        })
        .then(res => {
          if (res.data.error == 0) {
            this.stats = res.data.stats;
            this.videos = res.data.videos;

            // allow some time for the table to hydrate
            setTimeout(() => {
              this.dataLoads.loading.videoList = false;
            }, 200);

          } else if (res.data.error == 1) {
            //handling?
          }
        })
        .catch(function (e) {
          console.log(e);
        });
    } else {
      return axios({
          url: "https://cigari.ga/api/dash",
          method: "get",
          credentials: "same-origin",
          data: {
            user: this.$store.state.authUser,
            settingsLoaded:this.$store.state.settings.loaded
          }
        })
        .then(res => {
          try {
            if (res.data.error == 0) {
              let hasVideos = false;
              if (res.data.videos.length != 0) {
                hasVideos = true;
                // filtering out unconfirmeds
                res.data.videos = res.data.videos.filter(item => {
                  return item.confirmed;
                });
              }

              // assigning videos
              this.videos = res.data.videos;
              this.hasVideos = hasVideos;

            } else if (res.data.error == 1) {
              console.log("error while fetching dashboard info");
            }
          } catch (err) {
            this.videos = res.data.videos;
            this.hasVideos = hasVideos;
          }
          this.dataLoads.loading.videoList = false;

        })
        .catch(function (e) {
          console.log(e);
        });
    }
  },
  methods: {
    async deleteVideo(selects) {
      this.$confirm(
          "This will permanently delete the selected videos. Continue?",
          "Warning", {
            confirmButtonText: "OK",
            cancelButtonText: "Cancel",
            type: "warning"
          }
        ).then(() => {
          this.loading = true;

          if (this.warning) {
            selects[0].warning = this.warning;
          }

          axios({
              url: "https://cigari.ga/api/removeVideo",
              method: "post",
              credentials: "same-origin",
              data: {
                user: this.$store.state.authUser,
                selection: selects
              }
            }).then(res => {
              //resetting selection
              this.toggleSelection();
              if (res.data.error == 0) {

                res.data.selection.forEach(selection => {
                  this.videos.forEach((video, index) => {
                    if (video._id == selection._id) {
                      this.stats.usedSpace -= selection.size;
                      this.stats.usedSpace = this.stats.usedSpace.toFixed(2);

                      // could happen due to size rounding on upload
                      if (this.stats.usedSpace < 0) {
                        this.stats.usedSpace = 0;
                      }

                      this.videos.splice(index, 1);
                    }
                  });
                });
              } else if (res.data.error == 1) {
                console.log("error while bulk deleting videos");
              }
              this.loading = false;
              this.$message({
                type: res.data.msgType,
                message: res.data.msg
              });
            })
            .catch(function (e) {
              console.log(e);
            });
        })
        .catch(() => {});
    },
    async requestNewID(selection) {
      this.$confirm(
          "This will generate new links for all selected videos. Continue?",
          "Warning", {
            confirmButtonText: "OK",
            cancelButtonText: "Cancel",
            type: "warning"
          }
        )
        .then(() => {
          axios({
              url: "https://cigari.ga/api/newLink",
              method: "patch",
              credentials: "same-origin",
              data: {
                user: this.$store.state.authUser,
                selection: selection
              }
            })
            .then(res => {
              this.$message({
                type: res.data.msgType,
                message: res.data.msg
              });
              if (res.data.error == 0) {
                //resetting selection
                this.toggleSelection();

                this.videos.forEach((video, index) => {
                  res.data.newData.forEach(newVideo => {
                    if (newVideo.videoID == video.videoID) {
                      //update local
                      this.videos[index].videoID = newVideo.newVideoID;
                      this.videos[index].link = newVideo.newLink;
                    }
                  });
                });
              } else if (res.data.error == 1) {
                console.log("error while bulk requesting new ids");
              }
            })
            .catch(function (e) {
              console.log(e);
            });
        })
        .catch(() => {});
    },
    handleSelectionChange(val) {
      this.multipleSelection = val;
    },
    redirect(link) {
      this.redirect(link);
    },
    toggleSelection(rows) {
      if (rows) {
        rows.forEach(row => {
          this.$refs.videoTable.toggleRowSelection(row);
        });
      } else {
        this.$refs.videoTable.clearSelection();
      }
    },
    copyLink(link) {
      var outt = this;
      this.$copyText(link).then(
        function (e) {
          outt.currentCopyTooltip = "Copied!";
        },
        function (e) {
          outt.currentCopyTooltip = "Couldn't copy :(";
        }
      );
      setTimeout(() => {
        this.currentCopyTooltip = "Click to copy!";
      }, 1000);
    },
    async requestNewName(index) {
      this.$prompt("Input the new name:", "Rename", {
          confirmButtonText: "OK",
          cancelButtonText: "Cancel"
        })
        .then(value => {
          var videoID = this.videos[index].videoID;
          axios({
              url: "https://cigari.ga/api/rename",
              method: "post",
              credentials: "same-origin",
              data: {
                user: this.$store.state.authUser,
                videoID: videoID,
                newName: value.value
              }
            })
            .then(res => {
              this.$message({
                type: res.data.msgType,
                message: res.data.msg
              });
              if (res.data.error) {
                console.log("error while asking for new video name");
              } else {
                this.videos[index].name = res.data.newName;
              }
            })
            .catch(function (e) {
              console.log(e);
            });
        })
        .catch(() => {});
    },
    setUpStats() {
      let totalViews = 0;
      this.videos.forEach(element => {
        totalViews += element.views;
      });
      this.stats.totalViews = totalViews;
      this.stats.totalSpace = this.$store.state.authUser.totalSpace;
      this.stats.usedSpace = (
        this.stats.totalSpace - this.$store.state.authUser.remainingSpace
      ).toFixed(1);
      this.dataLoads.loading.panels = false;
    },
    setUpAdminStats() {
      this.stats.uploadDates = [];
      this.videos.forEach(video => {
        this.stats.uploadDates.push(video.uploadDate);
      });
      this.dataLoads.loading.panels = false;
    },
    async upgradeInit() {
      this.$prompt("Please input a promotion code", "Upgrade", {
        confirmButtonText: "Apply",
        cancelButtonText: "Cancel",
        inputErrorMessage: "Invalid code"
      }).then(value => {
        //activating the code
        axios({
            url: "https://cigari.ga/api/upgrade",
            method: "post",
            credentials: "same-origin",
            data: {
              user: this.$store.state.authUser,
              code: value.value
            }
          })
          .then(res => {
            this.$message({
              type: res.data.msgType,
              message: res.data.msg
            });
          })
          .catch(function (e) {
            console.log(e);
          });
      });
    },
    updateFilter(event) {
      // merging arrays for filtering later on
      this.videos = this.videos.concat(this.hiddenVideos);
      this.hiddenVideos = [];

      let filtered;
      if (this.searchTerm == "") {
        //grazinam viska
        try {
          filtered[0] = this.videos;
          filtered[1] = null;
        } catch (e) {}
      } else {
        //filtruojam
        filtered = _.partition(this.videos, video => {
          return video.name.includes(this.searchTerm);
        });
      }
      this.videos = filtered[0];
      this.hiddenVideos = filtered[1];
    }
  },
  computed: {
    warnOpts() {
      if (this.$store.state.authUser.userStatus == 1) {
        return [{
          label: "Warn user",
          value: 1,
          style: "color:orange;"
        }, {
          label: "Block user from uploading",
          value: 2,
          style: "color:red;"
        }]
      } else {
        return null;
      }
    }
  },
  layout: "main",
  transition: "mainTransition",
  head: {
    title: "Dashboard"
  }
};
</script>

<style scoped>
img {
  max-width: 90%;
  max-height: 90%;
}

.el-form-item--mini.el-form-item,
.el-form-item--small.el-form-item {
  margin-bottom: 3px;
}

.smoothTable-enter-active,
.smoothTable-leave-active {
  transition: opacity 0.5s;
}

.smoothTable-leave-to {
  opacity: 0;
}
</style>

<style>
body {
  overflow: scroll;
}

.searchField {
  max-width: 40%;
  float: right !important;
  margin-bottom: 1vh;
}
.multiSelectActions {
  margin-top: vh;
  height: 10vh;
  margin-bottom: 5vh;
}
.videoList {
  padding-top: 5vh;
  position: relative;
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  height: 80%;
  width: 90%;
}

.ratingColumn {
  display: inline-block;
}

.videoCard {
  width: 80%;
}
.subtitle1 {
  font-weight: 300;
}

.headerOfStatCard {
  font-size: 3vmin;
}

.statCard {
  width: 19vw;
  margin-right: 3vw;
}

.adminStatCard {
  width: 35vw;
  margin-right: 3vw;
}

.cards {
  display: flex;
}

.centeredUploadVideoSuggestion {
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

.title {
  font-family: LatoLight;
  -webkit-font-smoothing: antialiased;
  font-size: 50px;
  padding-top: 10vh;
  padding-left: 3vw;
}

.subtitle1 {
  font-family: LatoRegular;
  padding-top: 2vh;
}
.renameIcon {
  cursor: pointer;
  display: none;
}

.nameColumn:hover .renameIcon {
  display: inline;
}

.copyIcon {
  cursor: pointer;
  display: none;
  margin-left: 1vh;
}

.linkColumn:hover .copyIcon {
  display: inline;
}

.adminVideoPanel {
  background: #d3dce6;
}

.videoPanelExpander {
  background: #d8cdd7;
}

.adminStatsPanel {
  background: #cbcad0;
}

.adminPanelText {
  text-align: center;
  font-family: LatoLight;
  font-size: 20px;
}

.panel {
  border-radius: 15px;
  min-height: 40vh;
}

.pads {
  padding: 3vh;
}

.stats {
  padding: 1vh;
  font-family: LatoLight;
}
</style>
