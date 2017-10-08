<template>
  <div>
    <div v-if="$store.state.authUser" class="uploadForm">
      <el-upload
        :on-success="handleVideoUp"
        multiple=false
        v-loading="uploading" 
        element-loading-text="Uploading..." 
        class="vid-uploader" 
        drag 
        action="/api/upload" 
        :show-file-list="false" 
        :before-upload="beforeVideoUpload" 
        :on-progress="uploadProgress">
        
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
        <div class="el-upload__tip" slot="tip">mp4 files with a size less than 10GB</div>

      </el-upload>
      <el-progress class="progress" v-if="uploading" :text-inside="true" :stroke-width="18" :percentage="progressBar.percentage"></el-progress>

    </div>
  </div>
</template>

<script>

//TODO:  single drag-drop (+ selection based also?) for uploading single video. Post it to backend and get link when uploaded. Generate link w/ shortID

export default {
  data () {
    return {
      uploading:false,
      progressBar:{
        status:'',
        percentage:0
      }
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

      if (file.type !== 'video/mp4') {
        this.$message.error('Invalid video format!');
        this.uploading=false;  
        return false;
      }else if (mbFilesize > 10240) {
        this.$message.error('Video size can not exceed 10GB!');
        this.uploading=false;  
        return false;
      }
    },
    uploadProgress(event, file, fileList){
      console.log(event)
      if(event.percent>=100){
        this.uploading=false; 
        this.uploadedNotification();
        //todo effect for finished upload
      }
      this.progressBar.percentage=event.percent.toFixed(1);
    },
    uploadedNotification() {
      this.$notify({
          title: 'Success',
          message: 'Your video has been successfully uploaded!',
          type: 'success',
          duration: 5
        });
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
    width:80%;
    padding-top:10vh;
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
