module.exports = {
    build: {
        analyze: false,
        vendor: ['element-ui', 'axios']
            // filenames: {
            //   css: 'style.[hash:6].css',
            //   vendor: 'vendor.[hash:6].js',
            //   app: 'app.[chunkhash:6].js'
            // }  build: {

    },
    plugins: [
        '~plugins/element-ui'
    ],
    css: [
        'element-ui/lib/theme-chalk/index.css'
        // , '~assets/style/pageTranstions.css'  DOESNT FIND THE FILE FOR SOME REASON
    ],
    modules: [
        '@nuxtjs/font-awesome'
    ],
    links: [
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Lato' }
    ],

    axios: {
        // proxyHeaders: false
    }
}