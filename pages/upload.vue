<template>
  <div v-if="$store.state.authUser">
    <h1 class="title breaker">Upload</h1>
    <el-card  class="uploadForm" v-if="uploading">
      <div slot="header" class="clearfix">
        <span>Uploading video</span>
      </div>
      <el-progress class="progress" v-if="uploading" :text-inside="true" :stroke-width="30" :percentage="progressBar.percentage" :status="progressBar.status"></el-progress>
        <el-form>
          <el-form-item label="Video name">
            <el-input v-model="currentVidName" :disabled="dialog.input.disabled" placeholder="Video name" @keyup.enter.native="finishUpload(currentVidName,0,false)"></el-input>
          </el-form-item>
          <el-button type="success" :loading="dialog.buttonConfirm.loading" :disabled="dialog.buttonConfirm.disabled" @click="finishUpload(currentVidName,0,false)">Finish upload</el-button>
          <el-button type="warning" :loading="dialog.buttonCancel.loading" :disabled="dialog.buttonCancel.disabled" @click="finishUpload(currentVidName,1,false)">Cancel</el-button>
      </el-form>
    </el-card>
    <el-card class="uploadCard uploadForm clickableCard" v-else>
        <el-upload ref="uploader" :multiple="false" element-loading-text="Uploading..." class="vid-uploader" drag action="/api/upload" :show-file-list="false" :before-upload="beforeVideoUpload" :on-progress="uploadProgress" :with-credentials="true"	>
          <i class="el-icon-upload"></i>
          <div class="el-upload__text">Drop file here or
            <em>click to upload</em>
          </div>
          <div class="el-upload__tip" slot="tip">.mp4 files with a size less than 10GB</div>
        </el-upload>
      </el-card>
    </div>
</template>
<script>

import axios from 'axios'

// :on-close="finishUpload(currentVidName,1)"

export default {
  layout: 'main',
  data() {
    return {
      uploading: false,
      progressBar: {
        status: '',
        percentage: 0
      },
      currentVidName: '',
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
        action: 0
      }
    }
  },
  methods: {
    beforeVideoUpload(file) {
      this.uploading = true;
      if (!this.$store.state.authUser) {
        this.$message.error('You are not signed in!');
        this.$store.app.router.push("/")
        return false;
      }

      var mbFilesize = file.size / 1024 / 1024;

      if (this.$store.state.authUser.remainingSpace < mbFilesize) {
        this.$message.error('You do not have enough space remaining to upload this video! Delete some existing videos or request a storage upgrade.');
        this.$store.app.router.push("/")
        return false;
      } else if (mbFilesize > 10240) {
        this.$message.error('Video size can not exceed 10GB!');
        this.uploading = false;
        return false;
      }

      if (file.type !== 'video/mp4') {
        this.$message.error('Invalid video format!');
        this.uploading = false;
        return false;
      }
    },
    uploadProgress(event, file, fileList) {
      console.log(event)
      if (event.percent >= 100) {
        // this.uploading=false; 
        this.progressBar.status = "success";
        // todo effect for finished upload

        if (this.upload.ready) { //send it
          setTimeout(() => {
            this.finishUpload(this.upload.name, this.upload.action, true);
          }, 1000);
        }

      }
      this.progressBar.percentage = parseFloat(event.percent.toFixed(2));
    },
    uploadedNotification(msg, type) {
      this.$notify({
        title: 'Information',
        message: msg,
        type: type,
        duration: 4000
      });
    },
    finishUpload(name, status, specialPass) {
      if (!this.$store.state.authUser) {
        this.$message.error('You are not signed in!');
        this.$store.app.router.push("/")
        return false;
      }
      if (this.progressBar.percentage == 100 || specialPass == true) {

        if (!name && status == 0) {
          this.$message.error('Please enter a valid name!');
        } else {
          axios({
              url: 'https://cigari.ga/api/finalizeUpload',
              method: 'post',
              credentials: 'same-origin',
              data: {
                user: this.$store.state.authUser,
                video: {
                  name: name,
                  finalizationStatus: status
                }
              }
            })
            .then((res) => {
              this.uploading = false;

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


              if (res.data.error == 0) {
                this.uploadedNotification(res.data.msg, res.data.msgType);
                this.progressBar.status = "";
                this.progressBar.percentage = 0;
              } else if (res.data.error == 2) {
                this.progressBar.status = "";
                this.progressBar.percentage = 0;
                this.$message({
                  type: res.data.msgType,
                  message: res.data.msg
                });
              } else {
                this.$message({
                  type: res.data.msgType,
                  message: res.data.msg
                });
              }

            }).catch(function (e) {
              console.log(e);
            });
        }
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
      this.$store.app.router.push("/")
    } else {
      this.$store.state.activeTab = '3';
    }
  },
  transition:'mainTransition'
}
</script>


<style>

  .uploadForm{
    position: relative;
    margin: auto;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: 40vh;
    width: 60vw;
  }

  .vid-uploader .el-upload {
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }
  .vid-uploader{
    width: 40%;
    margin: 0 auto;
  }

  .breaker{
    margin-bottom:10vh;
  }

  .title{
    font-family: LatoLight;
    font-size: 50px;
    padding-top:10vh;
    padding-left:3vw;
  }
  .progress{
    position: relative;
    width:100%;
    padding-top:1vh;
  }
  .vid-uploader .el-upload:hover {
    border-color: #ffd04b;
  }
  .vid {
    width: 18vw;
    height: 18vh;
    display: block;
  }
  template{
    overflow: scroll;
  }

</style>
