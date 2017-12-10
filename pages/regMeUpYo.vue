<template>
  <div>
    <div class='RegForm' v-if="!$store.state.authUser">
      <el-form :model="regForm" label-width="100px" ref="regForm" :rules="formRules">
        <el-form-item label="Username" prop="username">
          <el-input v-model="regForm.username"></el-input>
        </el-form-item>
        <el-form-item label="Email" prop="email">
          <el-input v-model="regForm.email"></el-input>
        </el-form-item>
        <el-form-item label="Password" prop="pass">
          <el-input type="password" auto-complete="off" v-model="regForm.pass"></el-input>
        </el-form-item>
        <el-form-item label="Confirm password" prop="passconf">
          <el-input type="password" auto-complete="off" v-model="regForm.passconf"></el-input>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="hasCode">Check this if you have a code</el-checkbox>
        </el-form-item>
        <transition>
          <el-form-item v-if="hasCode" label="Code">
            <el-input v-model="regForm.code"></el-input>
          </el-form-item>
        </transition>
        <el-form-item>
          <el-button @click="submitForm('regForm')">Register</el-button>
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
  data () {
    return {
      regForm:{
        username:'',
        email:'',
        pass:'',
        passconf:'',
        code:''
      },
      hasCode:false,
      activeIndex: "2",
      activeIndexUnreg: "2",
      formRules: {
        username: [
          { required: true, message: 'Please input a valid username', trigger: 'blur' },
          { min: 5, max: 100, message: 'Length should be 5 to 100', trigger: 'blur' }
        ],
        email: [
          { required: true, message: 'Please enter an email address', trigger: 'change' },
          { type: 'email', message: 'Please enter a valid email address', trigger: 'blur' }
        ],
        pass: [
          { required: true, message: 'Please enter a password.', trigger: 'blur' },
          { min: 8, max: 100, message: 'Length should be 8 to 100', trigger: 'blur' }
        ],
        passconf: [
          { required: true, message: 'Please confirm your password.', trigger: 'blur' }
        ]
      }
    }
  },
  methods:{
    async register () {
      try {
        await this.$store.dispatch('register', {
          username: this.regForm.username,
          password: this.regForm.pass,
          passconf: this.regForm.passconf,
          email: this.regForm.email,
          code: this.regForm.code
        })
        this.formUsername = ''
        this.formPassword = ''
        this.formError = null
        this.$message.success("You have successfully created an account!");
      } catch(e) {
        this.$message({
          type: res.data.msgType,
          message: res.data.msg
        });
      }
    },
    submitForm(formName) {
        this.$refs[formName].validate((valid) => {
          if (valid) {
            this.register();
          } else {
            console.log('validation error');
            return false;
          }   if (!this.$store.state.authUser) {
      this.$store.app.router.push("/")
    } else {
      this.$store.state.activeTab = '2';
    }
        });
    },
    resetForm(formName) {
        this.$refs[formName].resetFields();
    }
  },
  mounted(){
    if(!this.$store.state.authUser){
      this.$store.state.activeTab = '2';
    }else{ //if user has an account, push him to dashboard
      this.$store.app.router.push("/dash")
    }
  },
  layout:'main'
}
</script>


<style>
  .RegForm{
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
