<template>
  <div class="hiddenOverflow">
    <div :style="background" ref="introBCG">
    </div>
    <transition name="fadeUp" :duration="{ enter: 1000, leave: 20 }" appear>
      <a class="hvr-fade introMainButton" @click="activateLogin(true)" v-show="!showLogin">
        <p v-if="!$store.state.authUser" class="nudge">Login</p>
        <p v-else class="nudge minif">Welcome back</p>
      </a>
    </transition>
    <div v-show="showLogin" class="introLoginForm">
      <div class="centerHor" v-if="!$store.state.authUser">
        <el-form v-on:submit.prevent="login" class="formField" size="small">
          <p class="error" v-if="formError">{{ formError }}</p>
          <el-form-item prop="username">
            <input class="substituteInput topField " @keyup.alt.82="redirectToRegister" placeholder="Username" type="text" v-model="form.username" name="username"/>
          </el-form-item>
          <el-form-item prop="password">
            <input class="substituteInput bottomField" @keydown.enter="login" placeholder="Password" type="password" v-model="form.password" name="password" />
          </el-form-item>
          <el-form-item>
            <el-button class="loginButton" type="submit" @click="login">Login</el-button>
            <a type="text" @click="$store.app.router.push('/reset')" class="forgotPasswordLink">Forgot your password?</a>                      
          </el-form-item>
        </el-form>
      </div>
      <div v-else class="postLogin">
        Welcome back, {{ $store.state.authUser.username }}!
        <p>
          <i>Redirecting you to your dashboard.</i>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data() {
    return {
      intro: {
        backgroundImage: '',
      },
      form: {
        username: '',
        password: ''
      },
      formError: null,
      showLogin: false,
      gifTags:['illusion','psychedelic','trippy','abstract']
    }
  },
  computed:{
    background(){
      return {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundImage: this.intro.backgroundImage,
        backgroundSize: 'cover',
        '-webkit-background-size': 'cover',
        '-moz-background-size': 'cover',
        '-o-background-size': 'cover',
        'background-size': 'cover',
        'z-index': -1,
        filter: this.showLogin?'blur(10px)':'',
        transform: 'scale(1.05)'
      }
    }
  },
  methods: {
    hotkey(event){
      alert("ASDASD");
    },
    activateLogin(bool) {
      if (!this.$store.state.authUser) {
        this.showLogin = bool;
      } else { //user pressed welcome back. Redirect to dashboard
        this.$store.app.router.push("/dash")
        this.$store.state.activeTab = '2';
      }
    },
    async redirectToRegister() {
      this.$store.app.router.push("/regMeUpYo")
      this.$store.state.activeTab = '2';
    },
    async login() {
      try {
        await this.$store.dispatch('login', {
          username: this.form.username,
          password: this.form.password
        })
        this.form.username = ''
        this.form.password = ''
        this.formError = null
        this.$store.app.router.push("/dash")
        this.$store.state.activeTab = '2';
      } catch (e) {
        this.$message.error(e.message);
      }
    },
    async logout() {
      try {
        await this.$store.dispatch('logout')
      } catch (e) {
        this.$message.error(e.message);
      }
    }
  },
  created() {
    var randomTag = this.gifTags[Math.floor(Math.random()*this.gifTags.length)];
    axios.get('//api.giphy.com/v1/gifs/random?api_key=jx9U8gsKgM80au8DRAUhYlaWYqibA4AO&tag='+randomTag)
      .then((res) => {
        this.intro.backgroundImage = 'url(' + res.data.data.image_original_url + ')';
      })
      .catch(e=>{});
  }
}
</script>

<style scoped>
.el-button {
  font-weight: bold !important;
  border:none !important;
  background: rgba(0, 0, 0, 0.801)  !important;
  color: #ffffff !important;
  -webkit-transition: .1s;
  transition: 0.2s !important;
  transition-property: color, background-color;
  width: 21vw;
  height: 8vh;
  margin-bottom:2vh;  
}


.el-form-item--mini.el-form-item,
.el-form-item--small.el-form-item {
    margin-bottom: 3px
}

::selection {
  background: #dddddd; /* WebKit/Blink Browsers */
}

.el-button:hover,
.el-button:focus,
.el-button:active {
  background: rgba(255, 255, 255, 0.801)  !important;
  color: black !important;
}

@keyframes fadeUp {
  0% {
      transform: translateY(+20px);
  }
  100% {
      transform: translateY(0);
  }
}

.fadeUp-enter-active {
  animation: fadeUp 1s;
}

.fadeUp-leave-active {
  
}

</style>


<style>
.postLogin{
  margin-top:10vh;
  text-align:center;
}

body{
  overflow-y: hidden;
}
.bottomField{
  margin-bottom:3.5vh !important;
}
.forgotPasswordLink{
  position: absolute;
  margin-top:-2vh !important; 
  cursor: pointer;
  margin: auto;
  font-family: LatoRegular;

}

.forgotPasswordLink:hover{
  color:black;
  font-weight:bold;
  font-size:150%;
  border-bottom:solid 2 px white;
}
 
.substituteInput {
  font-family: LatoRegular !important;
  background: rgba(0,0,0,0.5)  !important;
  color: white !important;
  font-weight: bold;
  padding: 0 4px !important;
  font-size: 4vh !important;
  height: 7vh !important;
  width: 20vw !important;
  border: solid 5px white !important; 
  clip-path: polygon( 
    calc(0%) calc(0% + 5px), /* top left */
    calc(100% - 5px) calc(0% + 5px), /* top right */
    calc(100% - 5px) calc(100% - 5px), /* bottom right */
    calc(0%) calc(100% - 5px) /* bottom left */
  );
  transition: clip-path 0.2s ease;
}

.substituteInput:focus{
    outline: none;
    clip-path: polygon(calc(0%+5px) calc(0%+5px), calc(100%-5px) calc(0%+5px), calc(100%-5px) calc(100%), calc(0%+5px) 100%);
}

@font-face {
  font-family: "LatoRegular";
  src: url("/fonts/LatoRegular/Lato-Regular.eot"), url("/fonts/LatoRegular/Lato-Regular.woff") format("woff"), url("/fonts/LatoRegular/Lato-Regular.ttf") format("truetype");
  font-style: normal;
  font-weight: normal;
}

a {
  text-decoration: none;
  transition: 0.6s;  
}


a:hover{
  color:black;
}

.nudge {
  margin-top: 10vh;
}

.topField {
  margin-top: 3vh;
}

.welcomeText {
  color: white;
  text-align: center;
  vertical-align: middle;
  position: relative;
  width: 100%;
  height: 100%;
}

.centerHor {
  justify-content: center;
}

.introMainButton {
  background: black;
  text-align: center;
  position: absolute;
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  opacity: 0.7;
  height: 35vh;
  width: 40vw;
  content: center;
  font-size: 14vh;
  color: white;
  border: solid 0.5vw white;
  font-family: LatoRegular;
  cursor: pointer;
  font-weight: bold;
}

.introLoginForm {
  position: absolute;
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  height: 35vh;
  width: 40vw;
  color: white;
}
/* Fade */

.minif{
  margin-top:12vh;
  font-size: 10vh;
}

.hvr-fade {
  display: inline-block;
  vertical-align: middle;
  -webkit-transform: perspective(1px) translateZ(0);
  transform: perspective(1px) translateZ(0);
  box-shadow: 0 0 1px transparent;
  overflow: hidden;
  -webkit-transition-duration: 0.3s;
  transition-duration: 0.3s;
  -webkit-transition-property: color, background-color;
  transition-property: color, background-color;
}

.hvr-fade:hover,
.hvr-fade:focus,
.hvr-fade:active {
  background-color: white;
  color: black;
  opacity: 0.95;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

.inputField {
  max-width: 100%;
}

.formField {
  max-width: 50%;
  margin: 0 auto;
}

.loginButton {
  margin: 0 auto;
  font-size:3vh !important;
}

</style>





