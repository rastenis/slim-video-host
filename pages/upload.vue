<template>
  <div>
  
  </div>
</template>

<script>

//TODO:  single drag-drop (+ selection based also?) for uploading single video. Post it to backend and get link when uploaded. Generate link w/ shortID

export default {
  data () {
    return {
      activeIndex: "2",
      activeIndexUnreg: "2"
    }
  },  
  created:function(){
  //authUser checkeris
    if(!this.$store.state.authUser){
      this.$store.app.router.push("/")
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
