<template>
  <div class="main">
    <el-menu v-if="!$store.state.authUser" class="nav" mode="horizontal" background-color="#545c64" text-color="#fff" active-text-color="#ffd04b" :default-active="$store.state.activeTab" @select="handleSelect">
      <el-menu-item index="1">Intro</el-menu-item>
      <el-menu-item index="2" class="pRight">Register</el-menu-item>
    </el-menu>

    <el-menu v-else class="nav" mode="horizontal" background-color="#545c64" text-color="#fff" active-text-color="#ffd04b" :default-active="$store.state.activeTab" @select="handleSelect">
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
      return {};
    },
    methods: {
      handleSelect(key, keyPath) {
        switch (key) {
          case "1":
            this.$store.app.router.push("/")
            break;
          case "2":
            if (this.$store.state.authUser) {
              this.$store.app.router.push("/dash")
              this.$store.state.activeTab = '2';
            } else {
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
      async logout() {
        try {
          await this.$store.dispatch('logout');
          this.$store.app.router.push("/")
        } catch (e) {
          this.formError = e.message
        }
      }
    },
    created: function () {
    }
  }
</script>



<style scoped>

  @font-face {
    font-family: "LatoRegular";
    src: url("/fonts/LatoRegular/Lato-Regular.eot"),
    url("/fonts/LatoRegular/Lato-Regular.woff") format("woff"),
    url("/fonts/LatoRegular/Lato-Regular.ttf") format("truetype");
    font-style: normal;
    font-weight: normal;
  }

  @font-face {
    font-family: "Knucklehead";
    src: url("/fonts/KH/Knucklehead.otf");
    font-style: normal;
    font-weight: normal;
  }

  .main {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;
    background: #EFF2F7;
  }

  .container{
    min-height:100vh;
    max-width: 70vw;
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
    font-size: larger;
  }

  nuxt-link{
    text-decoration: none;
  }
</style>


<style>
  body{
    font-family: Lato, sans-serif;
  }

  a:link{
    color:#968e00
  }
  a:visited{
    color:#7a7300
  }
</style>

