import Vue from "vue";
import Vuex from "vuex";
import axios from "axios";

Vue.use(Vuex);

export const state = () => ({
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
});

export const mutations = {
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
  },
  SET_ACTIVE_TAB: function(state, activeTab) {
    state.activeTab = activeTab;
  }
};

export const actions = {
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
      data: JSON.stringify({
        username,
        password
      })
    })
      .then(res => {
        switch (res.status) {
          case 556:
            throw new Error("Bad credentials.");
          case 555:
            throw new Error("No user with those credentials found.");
          case 557:
            throw new Error("Server error.");
          default:
            return res.data;
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
      data: JSON.stringify({
        file
      })
    }).then(res => {
      if (res.status === 555) {
        throw new Error("Not a valid file to upload.");
      } else {
        return res.data;
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
      data: JSON.stringify({
        username,
        password,
        passconf,
        email,
        code
      })
    })
      .then(res => {
        return res.data;
      })
      .then(authUser => {
        commit("SET_USER", authUser);
      })
      .catch(e => {
        throw {
          msg: e.response.data.meta.msg
        };
      });
  },
  setActiveTab({ commit }, tabNumber) {
    commit("SET_ACTIVE_TAB", tabNumber);
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
};
