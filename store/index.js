import Vue from 'vue'
import Vuex from 'vuex'
import axios from 'axios'

Vue.use(Vuex);

// Polyfill for window.fetch()
require('whatwg-fetch');

const store = () => new Vuex.Store({

    state: {
        authUser: null,
        gifURL: null,
        activeTab: '1'
    },

    mutations: {
        SET_USER: function(state, user) {
            state.authUser = user
        }
    },

    actions: {
        nuxtServerInit({ commit }, { req }) {
            if (req.session && req.session.authUser) {
                commit('SET_USER', req.session.authUser)
            }
        },
        login({ commit }, { username, password }) {
            return fetch('/api/login', {
                    credentials: 'same-origin',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        password
                    })
                })
                .then((res) => {
                    if (res.status === 556) {
                        throw new Error('Bad credentials.')
                    } else if (res.status === 555) {
                        throw new Error('No user with those credentials found.')
                    } else if (res.status === 557) {
                        throw new Error('Server error.')
                    } else {
                        return res.json()
                    }
                })
                .then((authUser) => {
                    commit('SET_USER', authUser);

                })
        },
        upload({ commit }, { file }) {
            return fetch('/api/upload', {
                    credentials: 'same-origin',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file
                    })
                })
                .then((res) => {
                    if (res.status === 555) {
                        throw new Error('Not a valid file to upload.')
                    } else {
                        return res.json()
                    }
                })
        },
        getVideos({ commit }, { username }) { //DEPRECATED
            return fetch('/api/getVideos', {
                    credentials: 'same-origin',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }, //turetu vis dar paeit username, jei ne tai virsuj i var isidet reiks
                    body: JSON.stringify({
                        username
                    })
                })
                .then((res) => {
                    if (res.status === 555) {
                        throw new Error('No such user.')
                    } else {
                        return res.json()
                    }
                })
                .then((videos) => {
                    commit('SET_VIDEOS', videos);
                })
        },
        register({ commit }, { username, password, passconf, email, code }) {
            return fetch('/api/register', {
                    // Send the client cookies to the server
                    credentials: 'same-origin',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        password,
                        passconf,
                        email,
                        code
                    })
                })
                .then((res) => {
                    if (res.status === 401) {
                        throw new Error('An account with that username already exists.')
                    } else {
                        return res.json()
                    }
                })
                .then((authUser) => {
                    commit('SET_USER', authUser)
                })
        },
        logout({ commit }) {
            return fetch('/api/logout', {
                    // Send the client cookies to the server
                    credentials: 'same-origin',
                    method: 'POST'
                })
                .then(() => {
                    commit('SET_USER', null)
                })
        }

    }

})


export default store;