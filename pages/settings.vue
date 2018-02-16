<template>
  <div>
    <h1 class="title">Settings</h1>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
    }
  },
  methods: {
    async logout() {
      try { //because apparently i can't access the layout's logout
        await this.$store.dispatch('logout');
        this.$nuxt._router.push("/")
      } catch (e) {
        this.formError = e.message
      }
    },
    changeTheme(selection){
      return axios({
        url: "https://cigari.ga/api/changeTheme",
        method: "post",
        credentials: "same-origin",
        data: {
          user: this.$store.state.authUser,
          newTheme:selection,
          settings:this.$store.settings
        }
      })
      .then(res => {
        this.$message({
          type: res.data.msgType,
          message: res.data.msg
        });
        if (res.data.error == 0) {
          // updating local settings
          this.$store.commit("SET_SETTINGS",res.data.newSettings);
        } else if (res.data.error == 1) {
          console.log("failed to change theme");
        }
      })
      .catch(function (e) {
        console.log(e);
      });
    }
  },
  mounted() {
    if (this.$store.state.authUser) {
      this.$store.state.activeTab = '5';
    } else { 
      this.$nuxt._router.push("/")
    }
  },
  layout: 'main',
  transition: 'mainTransition',
  head:{
    title:"Settings"
  }
}
</script>


<style>
.title {
  font-family: LatoLight;
  font-size: 6vh;
  padding-top: 10vh;
  padding-left: 3vw;
}
</style>
