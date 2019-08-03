<template>
  <div :style="intro" class="blurMeOut">
    <div>
      <nuxt />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      activeIndex: "1",
      intro: {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background:
          "url(https://media.giphy.com/media/l2R013mIf1ZXdvoyI/giphy.gif) no-repeat center center fixed",
        "-webkit-background-size": "cover",
        "-moz-background-size": "cover",
        "-o-background-size": "cover",
        "background-size": "cover",
        "z-index": "-1",
        transform: "scale(1.1)"
      }
    };
  },
  methods: {
    handleSelect(key, keyPath) {
      console.log(key, keyPath);
    }
  },
  created: function() {
    console.log(this.gifURL + " YEAH OK");
  }
};
</script>



<style scoped>
.container {
  max-height: 40%;
  width: 40%;
  background: #e5e9f2;
  margin: auto;
  opacity: 0.1;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  filter: unset;
}

.blurMeOut {
  -webkit-filter: blur(4px);
  filter: blur(4px);
}
</style>
