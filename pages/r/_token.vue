<template>
  <div>
    <div class='ResetForm' v-if="token.valid">
      <el-form :model="resetForm" label-width="100px" ref="resetForm" :rules="formRulesReset">
        <p class="formText">New Password</p>
        <el-form-item prop="pass">
          <el-input v-model="resetForm.pass"></el-input>
        </el-form-item>
        <p class="formText">Confirm New Password</p>        
        <el-form-item prop="passconf">
          <el-input v-model="resetForm.passconf"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="reset">Reset password</el-button>
        </el-form-item>
      </el-form> 
    </div>
    <div v-else>
      <h1>No such token/The token has expired.</h1>
    </div>
  </div>
</template>

<script>

import axios from 'axios'

export default {
  data() {
    return {
      resetForm: {
        pass: '',
        passconf: ''
      },
      token: {
        valid: false,
        token: null
      },
        formRulesReset: {
          pass: [{
              required: true,
              message: 'Please enter a password.',
              trigger: 'blur'
            },
            {
              min: 8,
              max: 100,
              message: 'Length should be 8 to 100',
              trigger: 'blur'
            }
          ],
          passconf: [{
            required: true,
            message: 'Please confirm your password.',
            trigger: 'blur'
          }]
      }
    }
  },
  asyncData(context) {
    if (context.params.token != "") {
      var token = {
        valid: false,
        token: null
      };
      console.log("checking token "+context.params.token);
      return axios({
          url: `https://cigari.ga/api/checkToken/${context.params.token}`,
          method: 'get',
          credentials: 'same-origin',
          data: {
            token: context.params.token
          }
        })
        .then((res) => {
          if (res.data.valid) {
            token.valid = true;
            token.token = context.params.token;
            console.log("set valid and token "+token.token);
          }
          return {
            token: token
          };
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      context.router.push("/");
    }
  },
  methods: {
    async reset() {
      this.$refs["resetForm"].validate((valid) => {
        if (valid) {
          axios({
            url: 'https://cigari.ga/api/resetPassword',
            method: 'post',
            credentials: 'same-origin',
            data: {
              newPass: this.resetForm.pass,
              token: this.token.token
            }
          }).then(res => {
            resetform("resetForm");
            this.$message({
              type: res.data.msgType,
              msg: res.data.msg
            });
          }).catch(e => {
            console.log(e);
          });
        } else {
          console.log('validation error');
          return false;
        }
      });
    },
    resetform(formName) {
      this.$refs[formName].resetFields();
    }
  },
  mounted() {
    if (!this.$store.state.authUser) {
      this.$store.state.activeTab = '9';
    } else { //if user has an account, push him to dashboard
      this.$store.app.router.push("/dash")
    }
  },
  layout: 'main',
  transition: 'mainTransition'
}
</script>


<style>
  .ResetForm{
    position: absolute;
    margin: auto;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: 50%;
    width: 40%;
  }

  .formText{
    color:#707070;
  }
</style>
