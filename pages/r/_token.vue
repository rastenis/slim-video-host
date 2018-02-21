<template>
  <div>
    <h1 class="title">Password reset</h1>
    <el-card class='ResetForm' v-if="token.valid">
      <el-form :model="resetForm" label-position="top" label-width="100px" ref="resetForm" :rules="formRulesReset">
        <el-form-item prop="pass" label="New password:">
          <el-input type="password" v-model="resetForm.pass" ></el-input>
        </el-form-item>
        <el-form-item prop="passconf" label="Confirm new password:">
          <el-input type="password" v-model="resetForm.passconf"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="reset">Reset password</el-button>
        </el-form-item>
      </el-form> 
    </el-card>
    <el-card v-else>
      <h3>No such token or the token has expired.</h3>
    </el-card>
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
          validator: this.validatePassConfirmation,
          trigger: 'blur'
        }, {
          required: true,
          message: 'Please confirm the new password.',
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
            url: 'https://cigari.ga/api/changePassword',
            method: 'post',
            credentials: 'same-origin',
            data: {
              resetType:1,
              newPass: this.resetForm.pass,
              token: this.token.token
            }
          }).then(res => {
            this.$message({
              type: res.data.meta.msgType,
              message: res.data.meta.msg
            });
            this.$refs["resetForm"].resetFields();
          }).catch(e => {
            console.log(e);
          });
        } else {
          console.log('validation error');
          return false;
        }
      });
    },
    validatePassConfirmation(rule, value, callback) {
      if (value === '') {
        callback(new Error('Please confirm the password.'));
      } else if (value !== this.resetForm.pass) {
        callback(new Error("Password confirmation doesn't match!"));
      } else {
        callback();
      }
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
  transition: 'mainTransition',
  head:{
    title:"Password Reset"
  }
}
</script>


<style>
.ResetForm {
  position: absolute;
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  height: 40%;
  width: 40%;
}

.formText {
  color: #707070;
}

.title {
  font-family: LatoLight;
  font-size: 6vh;
  padding-top: 10vh;
  padding-left: 3vw;
}
</style>
