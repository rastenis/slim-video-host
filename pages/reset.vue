<template>
  <div>
    <h1 class="title">Password reset</h1>
    <el-card class='ResetForm' v-if="!$store.state.authUser">
      <el-form label-position="top" :model="resetForm" label-width="100px" ref="tokenReqForm" :rules="formRules">
        <el-form-item label="Email" prop="email">
          <el-input v-model="resetForm.email"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" plain @click="askForToken">Request reset</el-button>
        </el-form-item>
      </el-form> 
    </el-card>
    <div v-else>
      <h1>You already have an account!</h1>
    </div>
  </div>
</template>

<script>

import axios from 'axios';

export default {
  data() {
    return {
      resetForm: {
        email: ''
      },
      formRules: {
        email: [{
            required: true,
            message: 'Please enter an email address',
            trigger: 'change'
          },
          {
            type: 'email',
            message: 'Please enter a valid email address',
            trigger: 'blur'
          }
        ]
      }
    }
  },
  methods: {
    async askForToken() {
      this.$refs["tokenReqForm"].validate((valid) => {
        if (valid) {
          console.log(this.resetForm.email);
          axios({
            url: 'https://cigari.ga/api/requestReset',
            method: 'post',
            credentials: 'same-origin',
            data: {
              email:this.resetForm.email
            }
          }
          ).then(res=>{
            this.$message({
              type:res.data.msgType,
              message:res.data.msg
            });
          }).catch(e=>{
            console.log(e);
          });
        } else {
          console.log('validation error');
          return false;
        }
      });
    }
  },
  mounted() {
    if (!this.$store.state.authUser) {
      this.$store.state.activeTab = '9';
    } else { //if user has an account, push him to dashboard
      this.$nuxt._router.push("/dash")
    }
  },
  layout: 'main',
  transition:'mainTransition'
}
</script>


<style>
.ResetForm {
  position: relative;
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  margin-top: 4vh;
  width: 60%;
}

.title {
  font-family: LatoLight;
  font-size: 6vh;
  padding-top: 10vh;
  padding-left: 3vw;
}

.formText {
  color: #707070;
}
</style>
