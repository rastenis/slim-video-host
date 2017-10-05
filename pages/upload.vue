<template>
  <div>
    <div v-if="$store.state.authUser">
      <el-upload
        class="vid-uploader uploadForm"
        action="/api/upload"
        :show-file-list="false"
        :on-success="handleAvatarSuccess"
        :before-upload="beforeAvatarUpload">
        <img v-if="imageUrl" :src="imageUrl" class="vid">
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
        <div class="el-upload__tip" slot="tip">mp4/avi/webm files with a size less than 10GB</div>
      </el-upload>
    </div>
  </div>
</template>

<script>

//TODO:  single drag-drop (+ selection based also?) for uploading single video. Post it to backend and get link when uploaded. Generate link w/ shortID

export default {
  data () {
    return {
    }
  },
  methods:{
    async upload () {
      try {
        await this.$store.dispatch('upload', {
          username: this.regForm.username,
          password: this.regForm.pass,
          passconf: this.regForm.passconf,
          email: this.regForm.email,
          code: this.regForm.code
        })
        this.formUsername = ''
        this.formPassword = ''
        this.formError = null
      } catch(e) {
        this.formError = e.message
      }
    },
    beforeVideoUpload(file) {

      if (file.type !== 'video/mp4' || file.type !== 'video/avi' || file.type !== 'video/webm') {
        this.$message.error('Invalid video format!');
        return false;
      }else if (file.size / 1024 / 1024 < 10240) {
        this.$message.error('Video size can not exceed 10GB!');
        return false;
      }
    },
    async handleVideoSuccess(res, file) {
      try {
        await this.$store.dispatch('upload', {
          vid:file
        })
      } catch(e) {
        this.formError = e.message
      }
    }
  }, 
  created:function(){
  //authUser checkeris
    if(!this.$store.state.authUser){
      this.$store.app.router.push("/")
    }else{
      this.$store.state.activeTab = 3;
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
    height: 50vh;
    width: 50vw;
  }

  .vid-uploader .el-upload {
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }
  .vid-uploader .el-upload:hover {
    border-color: #20a0ff;
  }
  .vid-uploader-icon {
    font-size: 28px;
    color: #8c939d;
    width: 178px;
    height: 178px;
    line-height: 178px;
    text-align: center;
  }
  .vid {
    width: 178px;
    height: 178px;
    display: block;
  }
</style>
