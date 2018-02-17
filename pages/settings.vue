<template>
  <div>
    <h1 class="title">Settings</h1>
    <el-card class="box-card" style="width:64vw;margin-left:3vw; height:70vh">
      <div slot="header" class="clearfix">
        <span style="font-size: 3vh;">Change global theme</span>
      </div>
      <el-row>
        <el-col :span="8" v-for="(o, index) in 2" :key="o" :offset="index > 0 ? 2 : 0">
          <el-card :body-style="{ padding: '0px' }">
            <img :src="'/img/themes/'+index+'.png'" class="image">
            <div style="padding: 14px;">
              <span>{{index==0? "Dark":"Light"}}</span>
              <div class="bottom">
                <el-button type="primary" @click="changeTheme(index)" class="button">Use this theme</el-button>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>
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
          settings:this.$store.state.settings
        }
      })
      .then(res => {
        this.$message({
          type: res.data.msgType,
          message: res.data.msg
        });
        if (res.data.error == 0) {
          // updating local settings
          console.log(this.$store.state.settings);
          this.$store.commit("SET_SETTINGS",res.data.newSettings);
          this.logout();
        } else if (res.data.error == 1) {
          console.log("failed to change theme");
        }// LEFTOFF: crashes when theme changed?
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
      this.$nuxt._router.push("/");
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

.bottom {
  margin-top: 13px;
  line-height: 12px;
}
</style>
