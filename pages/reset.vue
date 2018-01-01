<template>
  <div>
    <div class='ResetForm' v-if="!$store.state.authUser">
      <el-form :model="resetForm" label-width="100px" ref="tokenReqForm" :rules="formRules">
        <el-form-item label="Email" prop="email">
          <el-input v-model="resetForm.email"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="askForToken">Request reset</el-button>
        </el-form-item>
      </el-form> 
    </div>
    <div v-else>
      <h1>You already have an account!</h1>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      resetForm: {
        email: '',
        pass: '',
        passconf: ''
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
  methods: {
    async askForToken() {
      this.$refs["tokenReqForm"].validate((valid) => {
        if (valid) {
          axios({
            url: 'https://cigari.ga/api/requestReset',
            method: 'post',
            credentials: 'same-origin',
            data: {
              email:email
            }
          }
          ).then(res=>{
            this.$message({
              type:res.data.msgType,
              msg:res.data.msg
            });
          }).catch(e=>{
            console.log(e);
          });
        } else {
          console.log('validation error');
          return false;
        }
      });
    },
    resetForm(formName) {
      this.$refs[formName].resetFields();
    }
  },
  mounted() {
    if (!this.$store.state.authUser) {
      this.$store.state.activeTab = '2';
    } else { //if user has an account, push him to dashboard
      this.$store.app.router.push("/dash")
    }
  },
  layout: 'main',
  transition:'mainTransition'
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
</style>
