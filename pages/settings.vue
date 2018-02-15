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
    }
  },
  mounted() {
    if (this.$store.state.authUser) {
      this.$store.state.activeTab = '5';
    } else { // non-logged in users have no right to be here
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
