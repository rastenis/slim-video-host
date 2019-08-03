const webpack = require("webpack");
const themes = require("./static/style/themes");
const config = require("./config.json");

module.exports = {
  build: {
    analyze: false,
    vendor: ["element-ui", "axios", "vue-clipboard2", "lodash"]
  },
  plugins: ["~plugins/element-ui", "~plugins/vue-clipboard2"],
  css: [
    "element-ui/lib/theme-chalk/index.css",
    "~static/style/pageTransitions.css"
  ],
  modules: ["@nuxtjs/font-awesome"],
  links: [
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css?family=Lato"
    },
    {
      rel: "icon",
      type: "image/x-icon",
      href: "favicon.ico"
    }
  ],
  axios: {
    // proxyHeaders: false
  },
  env: {
    baseUrl: config.host
  },
  loading: {
    color: themes[themes.current]
      ? themes[themes.current].loading.color
      : "black"
  }
};
