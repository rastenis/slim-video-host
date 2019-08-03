<template>
  <!-- unauthed users forbidden -->
  <div v-if="$store.state.authUser">
    <h1 class="title breaker">Upload</h1>
    <!-- upload ban notice -->
    <el-card
      class="uploadCard uploadForm clickableCard"
      v-if="$store.state.authUser.accountStanding==2"
    >
      <i class="fa fa-times">
        <p
          style="font-family:LatoLight;display:inline; margin-left:1vh;"
        >You are prohibited from uploading videos. Ask an admin to provide you with a reset code for your account status.</p>
      </i>
    </el-card>
    <!-- initial upload drag-box -->
    <el-card
      class="uploadCard uploadForm clickableCard"
      v-if="!uploading && !upload.declined && $store.state.authUser.accountStanding!=2"
    >
      <el-upload
        ref="uploader"
        :multiple="true"
        :on-success="onUploadSuccess"
        element-loading-text="Uploading..."
        class="vid-uploader"
        drag
        action="/api/upload"
        :before-upload="beforeVideoUpload"
        :on-progress="uploadProgress"
        :with-credentials="true"
      >
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">
          Drop file here or
          <em>click to upload</em>
        </div>
        <div class="el-upload__tip" slot="tip">.mp4, .ogg, .webm files with a size less than 5GB</div>
      </el-upload>
    </el-card>
    <!-- modal-style panel for monitoring upload progress & naming -->
    <el-card
      class="uploadForm fileList"
      v-if="uploading && !upload.declined"
      v-loading="irreversibleUploadCommenced"
    >
      <div slot="header" class="clearfix">
        <span>Uploading videos</span>
      </div>
      <!-- naming fields -->
      <el-form @submit.native.prevent>
        <div
          v-for="(video, index) in uploadedFileList"
          :item="video"
          :index="index"
          :key="video.videoID"
        >
          <el-progress
            v-if="uploading"
            :text-inside="true"
            :stroke-width="30"
            :percentage="parseFloat(video.percentage.toFixed(2))"
            :status="video.status"
          ></el-progress>
          <el-form-item :label="video.name">
            <el-input
              v-model="newNames[video.name]"
              :disabled="dialog.input.disabled"
              placeholder="Video name"
              @keyup.13.native="finishUpload(0)"
            ></el-input>
          </el-form-item>
        </div>
        <!-- action buttons at the bottom of the iterated list -->
        <el-button
          type="success"
          :loading="dialog.buttonConfirm.loading"
          :disabled="dialog.buttonConfirm.disabled"
          @click="finishUpload(0)"
        >Finish upload</el-button>
        <el-button
          type="warning"
          :loading="dialog.buttonCancel.loading"
          :disabled="dialog.buttonCancel.disabled"
          @click="finishUpload(1)"
        >Cancel</el-button>
      </el-form>
    </el-card>
    <!-- upload-blocking notice, if the server didn't accept an upload. Forces a refresh, at the very least. -->
    <el-card class="uploadForm" v-if="upload.declined">
      <h2 style="color:red;">Upload declined!</h2>
      <h3>Try again later.</h3>
    </el-card>
  </div>
</template>
<script>
import axios from "axios";

export default {
  layout: "main",
  data() {
    return {
      irreversibleUploadCommenced: false,
      uploading: false,
      completeCount: 0,
      progressBar: {
        status: "",
        percentage: 0
      },
      currentVidName: "",
      dialog: {
        buttonConfirm: {
          loading: false,
          disabled: false
        },
        buttonCancel: {
          loading: false,
          disabled: false
        },
        input: {
          disabled: false
        }
      },
      waitInteval: null,
      upload: {
        ready: false,
        name: null,
        action: 0,
        declined: false
      },
      newVideos: [],
      uploadedFileList: [],
      newNames: {}
    };
  },
  methods: {
    onUploadSuccess(res, file, fileList) {
      if (res.error) {
        // force the user to do a refresh. The backend may be down.
        this.upload.declined = true;
        this.$message({
          message: res.msg,
          type: res.msgType
        });
      } else {
        // displaying naming fields
        this.uploadedFileList = fileList;
        this.newVideos = res.newVideos;
        this.completeCount++;
        if (
          this.upload.ready &&
          this.completeCount >= this.uploadedFileList.length
        ) {
          // minor delay
          setTimeout(() => {
            this.finishUpload(this.upload.name, this.upload.action, true);
          }, 200);
        }
      }
    },
    beforeVideoUpload(file) {
      this.uploading = true;
      if (!this.$store.state.authUser) {
        this.$message.error("You are not signed in!");
        this.$nuxt._router.push("/");
        return false;
      }

      let mbFilesize = file.size / 1024 / 1024;

      // checking if user has sufficient space available
      if (this.$store.state.authUser.remainingSpace < mbFilesize) {
        this.$message.error(
          "You do not have enough space remaining to upload this video! Delete some existing videos or request a storage upgrade."
        );
        this.$nuxt._router.push("/");
        return false;
      } else if (mbFilesize > 10240) {
        this.$message.error("Video size can not exceed 10GB!");
        this.uploading = false;
        return false;
      }
      // checking if the filetype is allowed, TODO: switch not needed
      switch (file.type) {
        case "video/webm":
          break;
        case "video/ogg":
          break;
        case "video/mp4":
          break;
        default:
          this.$message.error("Invalid video format!");
          this.uploading = false;
          return false;
          break;
      }
    },
    uploadProgress(event, file, fileList) {
      // updates all file progresses at once
      this.uploadedFileList = fileList;
    },
    uploadedNotification(msg, type) {
      this.$notify({
        title: "Information",
        message: msg,
        type: type,
        duration: 2000
      });
    },
    finishUpload(status) {
      if (!this.$store.state.authUser) {
        this.$message.error("You are not signed in!");
        this.$nuxt._router.push("/");
        return false;
      }
      // check if all videos have finished uploading
      if (this.completeCount >= this.uploadedFileList.length) {
        // if (!name && status == 0) {
        //   //validate form of all new video names
        //   this.$message.error("Please enter a valid name!");
        // }
        this.irreversibleUploadCommenced = true;
        axios({
          url: "/api/finalizeUpload",
          method: "put",
          credentials: "same-origin",
          data: {
            user: this.$store.state.authUser,
            newNames: this.newNames,
            cancelled: status
          }
        })
          .then(res => {
            this.uploading = false;
            this.irreversibleUploadCommenced = false;
            this.$store.commit("INC_UPLOAD_NOTIFS", this.completeCount);
            this.completeCount = 0;

            if (status == 0) {
              this.dialog.buttonConfirm.loading = false;
              this.dialog.buttonCancel.disabled = false;
              this.dialog.buttonConfirm.disabled = false;
            } else {
              this.dialog.buttonCancel.loading = false;
              this.dialog.buttonConfirm.disabled = false;
              this.dialog.buttonCancel.disabled = false;
            }

            this.dialog.input.disabled = false;

            if (res.data.meta.error == 0) {
              this.uploadedNotification(
                res.data.meta.msg,
                res.data.meta.msgType
              );
              this.progressBar.status = "";
              this.progressBar.percentage = 0;
            } else if (res.data.meta.error == 2) {
              this.progressBar.status = "";
              this.progressBar.percentage = 0;
              this.$message({
                type: res.data.meta.msgType,
                message: res.data.meta.msg
              });
              //removing naming storage
              this.newNames = [];
            } else {
              this.$message({
                type: res.data.meta.msgType,
                message: res.data.meta.msg
              });
            }
          })
          .catch(function(e) {
            console.log(e);
          });
      } else {
        if (status == 0) {
          this.dialog.buttonConfirm.loading = true;
          this.dialog.buttonConfirm.disabled = true;
          this.upload.action = 0;
          this.upload.name = name;
          this.upload.ready = true;
        } else {
          this.dialog.buttonCancel.loading = true;
          this.dialog.buttonCancel.disabled = true;
          this.dialog.buttonConfirm.disabled = true;

          this.uploading = false;
          location.reload();
        }
        this.dialog.input.disabled = true;
      }
    }
  },
  created() {
    if (!this.$store.state.authUser) {
      this.$nuxt._router.push("/");
    } else {
      this.$store.state.activeTab = "3";
    }
    this.uploader = this.$refs.uploader;
  },
  transition: "mainTransition",
  head: {
    title: "Upload"
  }
};
</script>

<style>
.uploadForm {
  position: relative;
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 60vw;
}
.uploadDenied {
  color: red;
}
.fileList {
  margin-top: 4vh;
}
.vid-uploader .el-upload {
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.vid-uploader {
  width: 40%;
  margin: 0 auto;
}

.breaker {
  margin-bottom: 10vh;
}

.title {
  font-family: LatoLight;
  font-size: 50px;
  padding-top: 10vh;
  padding-left: 3vw;
}
.progress {
  position: relative;
  width: 100%;
  padding-top: 1vh;
}
.vid-uploader .el-upload:hover {
  border-color: #ffd04b;
}
.vid {
  width: 18vw;
  height: 18vh;
  display: block;
}
template {
  overflow: scroll;
}
</style>
