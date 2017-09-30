<template>
  <div>
  
  </div>
</template>

<script>

//TODO:  v-for get all video links w/ titles and views into CARDS (if w/ thumbnails) or just LIST ITEMS (w/o thumbnails)

export default {
  data () {
    return {
      regForm:{
        username:'',
        email:'',
        pass:'',
        passconf:''
      },
      activeIndex: "2",
      activeIndexUnreg: "2"
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
