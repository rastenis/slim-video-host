<template>
  <div>
    <div v-if="$store.state.authUser" class="uploadForm">
      <el-upload :multiple="false" element-loading-text="Uploading..." class="vid-uploader" drag action="/api/upload" :show-file-list="false"
        :before-upload="beforeVideoUpload" :on-progress="uploadProgress">
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">Drop file here or
          <em>click to upload</em>
        </div>
        <div class="el-upload__tip" slot="tip">.mp4 files with a size less than 10GB</div>
      </el-upload>
      <el-dialog title="Uploading video" :visible.sync="uploading" :on-close="revertUpload">
        <el-progress class="progress" v-if="uploading" :text-inside="true" :stroke-width="30" :percentage="progressBar.percentage"
          :status="progressBar.status"></el-progress>
        <el-form>
          <el-form-item label="Video name">
            <el-input @keyup.enter.native="finishUpload(currentVidName,0)" v-model="currentVidName"></el-input>
          </el-form-item>
          <el-button type="success" @click="finishUpload(currentVidName,0)">Finish upload</el-button>
          <el-button :plain="true" type="danger" @click="finishUpload(currentVidName,1)">Cancel</el-button>
        </el-form>
        
      </el-dialog>
    </div>
  </div>
</template>

<script>

import axios from 'axios'

export default {
  data () {
    return {
      uploading:false,
      progressBar:{
        status:'',
        percentage:0
      },
      currentVidName:''
    }
  },
  methods:{
    beforeVideoUpload(file) {
      this.uploading=true;  
      if(!this.$store.state.authUser){
        this.$message.error('You are not signed in!');
        this.$store.app.router.push("/")
        return false;
      }

      var mbFilesize= file.size / 1024 / 1024 ;

      if(this.$store.state.authUser.remainingSpace < mbFilesize){
        this.$message.error('You do not have enough space remaining to upload this video! Delete some existing videos or request a storage upgrade.');
        this.$store.app.router.push("/")
        return false;
      }else if (mbFilesize > 10240) {
        this.$message.error('Video size can not exceed 10GB!');
        this.uploading=false;  
        return false;
      }

      if (file.type !== 'video/mp4') {
        this.$message.error('Invalid video format!');
        this.uploading=false;  
        return false;
      }
    },
    uploadProgress(event, file, fileList){
      console.log(event)
      if(event.percent>=100){
        // this.uploading=false; 
        this.progressBar.status="success";
        // todo effect for finished upload

      }
      this.progressBar.percentage= parseFloat( event.percent.toFixed(2));
    },
    uploadedNotification(msg,type) {
      this.$notify({
          title: 'Information',
          message: msg,
          type: type,
          duration: 4000
        });
    },
    revertUpload(){
      axios({ 
      url: 'https://cigari.ga/api/confirmVideo',
      method:'post',
      credentials: 'same-origin',
      data: {
          user: this.$store.state.authUser,
          action:1
      }
      })
      .then((res) => {
        if(res.data.error==0){
          this.$message.error('Upload canceled.');
          this.uploading=false;
        }else if (res.data.error==1){
          console.log("error while confirming video");
        }
      }).catch(function (e) {
        console.log(e);
      });
      

    },
    finishUpload(name,status){
      if(name=="" && status==0){
        this.$message.error('Please enter a valid name!');
        //prevent modal close
      }else{
        axios({ 
        url: 'https://cigari.ga/api/finalizeUpload',
        method:'post',
        credentials: 'same-origin',
        data: {
            user: this.$store.state.authUser,
            video:{
              name:name,
              finalizationStatus:status
            }
        }
        })
        .then((res) => {
          if(res.data.error==0){
            this.uploadedNotification(res.data.msg,res.data.msgType);
            this.uploading=false;
          }else if (res.data.error==1){
            console.log();
          }
        }).catch(function (e) {
          console.log(e);
        });
      }
    }
  
  }, 
  created:function(){
  //authUser checkeris
    if(!this.$store.state.authUser){
      this.$store.app.router.push("/")
    }else{
      this.$store.state.activeTab = '3';
    }

  },
  layout:'main'
}
</script>


<style>
  .uploadForm{
    position: absolute;
    margin: auto;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: 60vh;
    width: 60vw;
  }

  .vid-uploader .el-upload {
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    
  }
  .vid-uploader{
    width: 40%;
    margin: 0 auto;
  }

  .progress{
    position: relative;
    width:100%;
    padding-top:1vh;
  }
  .vid-uploader .el-upload:hover {
    border-color: #20a0ff;
  }
  .vid-uploader-icon {
    font-size: 28px;
    color: #8c939d;
    width: 18vh;
    height: 18vh;
    line-height: 178px;
    text-align: center;
  }
  .vid {
    width: 18vw;
    height: 18vh;
    display: block;
  }
  template{
    overflow: hidden;
  }

</style>
