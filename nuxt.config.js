module.exports = {
    build: {
        analyze: false,
        vendor: ['element-ui', 'axios', 'vue-clipboard2', 'vue-charts']
    },
    plugins: [
        '~plugins/element-ui',
        '~plugins/vue-clipboard2',
        '~plugins/vue-charts'
    ],
    css: [
        'element-ui/lib/theme-chalk/index.css',
        '~assets/style/pageTransitions.css'
    ],
    modules: [
        '@nuxtjs/font-awesome'
    ],
    links: [
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Lato' },
    ],

    axios: {
        // proxyHeaders: false
    }
}