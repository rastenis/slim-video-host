<template>
  <div class="main">
    <el-menu v-if="!$store.state.authUser" theme="dark" class="nav" mode="horizontal" :default-active="$store.state.activeTab" @select="handleSelect">
      <el-menu-item index="1">Intro</el-menu-item>
      <el-menu-item index="2" class="pRight">Register</el-menu-item>
    </el-menu>

    <el-menu v-else theme="dark" class="nav" mode="horizontal" :default-active="$store.state.activeTab" @select="handleSelect">
      <el-menu-item index="1">
         <nuxt-link to="/" >Intro</nuxt-link>
      </el-menu-item>
      <el-menu-item index="2">Dashboard</el-menu-item>
      <el-menu-item index="3">Upload</el-menu-item>
      <el-menu-item index="4" class="pRight">Logout</el-menu-item>
    </el-menu>
    <div class="container">
      <nuxt/>
    </div>
  
  </div>
</template>

<script>
  export default {
    data() {
      return {
      };
    },
    methods: {
      handleSelect(key, keyPath) {
        switch (key) {
          case "1":
            this.$store.app.router.push("/")
            break;
          case "2":
            if(this.$store.state.authUser){
              this.$store.app.router.push("/dash")
              this.$store.state.activeTab = '2';
            }else{
              this.$store.app.router.push("/regMeUpYo")
              this.$store.state.activeTab = '2';
            }
            break;
          case "3":
              this.$store.app.router.push("/upload")
              this.$store.state.activeTab = '3';
            break;
          case "4":
              this.logout();
          break;
          default:
            console.log("invalid nav choice");
            break;
        }
      },
    async logout () {
      try {
        await this.$store.dispatch('logout');
        this.$store.app.router.push("/")
      } catch (e) {
        this.formError = e.message
      }
    }
    },
    created:function(){
      //TODO MAKE ACTIVE TAB SETTER
      //console.log(this.$app.$router); ? mb route as object?
    }
  }
</script>



<style scoped>

.main {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 100%;
  background: #EFF2F7;
}

.container{
  max-height: 100%;
  min-height:100vh;
  max-width: 75%;
  display: block;
  background: #E5E9F2;
  margin-left: auto;
  margin-right: auto;
}
.pRight{
  float: right;
}

.nav{
  position: absolute;
  top: 0;
  left: 0;
  min-width: 100%;
}

nuxt-link{
  text-decoration: none;
}
</style>


<style>
  body{
    font-family: Lato, sans-serif;
  }
</style>

