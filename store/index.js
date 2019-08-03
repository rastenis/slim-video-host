import Vue from "vue";
import Vuex from "vuex";
import axios from "axios";

Vue.use(Vuex);

const store = () =>
  new Vuex.Store({
    state: {
      authUser: null,
      gifURL: null,
      activeTab: "1",
      newUploadNotif: 0,
      settings: {
        loaded: false,
        theme: {
          id: null,
          data: {}
        }
      }
    },

    mutations: {
      SET_USER: function(state, user) {
        state.authUser = user;
      },
      INC_UPLOAD_NOTIFS: function(state, count) {
        state.newUploadNotif += count;
      },
      RESET_UPLOAD_NOTIFS: function(state) {
        state.newUploadNotif = 0;
      },
      SET_SETTINGS: function(state, settingsData) {
        state.settings.theme.data = settingsData.theme;
        state.settings.theme.id = settingsData.themeID;
        state.settings.loaded = true;
      }
    },

    actions: {
      nuxtServerInit({ commit }, { req }) {
        if (req.session && req.session.authUser) {
          commit("SET_USER", req.session.authUser);
        }
      },
      login({ commit }, { username, password }) {
        return axios("/api/login", {
          credentials: "same-origin",
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username,
            password
          })
        })
          .then(res => {
            if (res.status === 556) {
              throw new Error("Bad credentials.");
            } else if (res.status === 555) {
              throw new Error("No user with those credentials found.");
            } else if (res.status === 557) {
              throw new Error("Server error.");
            } else {
              return res.json();
            }
          })
          .then(authUser => {
            commit("SET_USER", authUser);
          });
      },
      upload({ commit }, { file }) {
        return axios("/api/upload", {
          credentials: "same-origin",
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            file
          })
        }).then(res => {
          if (res.status === 555) {
            throw new Error("Not a valid file to upload.");
          } else {
            return res.json();
          }
        });
      },
      register({ commit }, { username, password, passconf, email, code }) {
        return axios("/api/register", {
          // Send the client cookies to the server
          credentials: "same-origin",
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username,
            password,
            passconf,
            email,
            code
          })
        })
          .then(res => {
            switch (res.status) {
              case 599:
                throw {
                  msg: "An account with that username already exists."
                };
                break;
              case 598:
                throw {
                  msg:
                    "The server cannot accept new registrations at this moment."
                };
                break;
              case 597:
                throw {
                  msg: "An account with that email already exists."
                };
                break;
              default:
                return res.json();
                break;
            }
          })
          .then(authUser => {
            commit("SET_USER", authUser);
          });
      },
      logout({ commit }) {
        return axios("/api/logout", {
          // Send the client cookies to the server
          credentials: "same-origin",
          method: "POST"
        }).then(() => {
          commit("SET_USER", null);
        });
      }
    }
  });

export default store;
