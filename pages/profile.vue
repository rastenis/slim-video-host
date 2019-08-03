<template>
  <div>
    <el-dialog title="Account deletion" :visible.sync="accountDeletion.dialogOpen" width="30%">
      <span>Please input your password in order to delete your account. The proccess is IRREVERSIBLE.</span>
      <el-input
        type="password"
        placeholder="Password"
        style="margin-top:1vh;"
        v-model="accountDeletion.passwordConfirmation"
      ></el-input>
      <span slot="footer" class="dialog-footer">
        <el-button @click="accountDeletion.dialogOpen = false ; ">Cancel</el-button>
        <el-button type="primary" @click="deleteAccount">Confirm</el-button>
      </span>
    </el-dialog>
    <h1 class="title">Profile</h1>
    <el-card class="ProfileForm" v-if="$store.state.authUser">
      <div slot="header" class="clearfix">
        <span>Password Change</span>
      </div>
      <el-form
        v-loading="passReset.loading"
        size="medium"
        label-position="top"
        :model="passReset"
        label-width="100px"
        ref="passwordResetForm"
        :rules="passResetFormRules"
      >
        <el-form-item prop="currentPassword" label="Current password:">
          <el-input
            @keypress.enter.native="changePassword"
            type="password"
            v-model="passReset.currentPassword"
          ></el-input>
        </el-form-item>
        <el-form-item prop="newPassword" label="New password:">
          <el-input
            @keypress.enter.native="changePassword"
            type="password"
            v-model="passReset.newPassword"
          ></el-input>
        </el-form-item>
        <el-form-item prop="newPasswordConf" label="Confirm new password:">
          <el-input
            @keypress.enter.native="changePassword"
            type="password"
            v-model="passReset.newPasswordConf"
          ></el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="changePassword">Reset Password</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card class="ProfileForm spaced" v-if="$store.state.authUser">
      <div slot="header" class="clearfix">
        <span>Account deletion</span>
      </div>
      <el-form label-position="top" label-width="100px">
        <el-form-item>
          <el-button type="danger" @click="accountDeletion.dialogOpen=true">Delete account</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import axios from "axios";
import _ from "lodash";

export default {
  data() {
    return {
      accountDeletion: {
        dialogOpen: false,
        passwordConfirmation: ""
      },
      passReset: {
        currentPassword: "",
        newPassword: "",
        newPasswordConf: "",
        loading: false
      },
      passResetFormRules: {
        currentPassword: [
          {
            required: true,
            message: "Please enter your current password.",
            trigger: "blur"
          }
        ],
        newPassword: [
          {
            required: true,
            message: "Please enter a new password.",
            trigger: "blur"
          },
          {
            min: 8,
            max: 100,
            message: "Length should be 8 to 100",
            trigger: "blur"
          }
        ],
        newPasswordConf: [
          {
            validator: this.validatePassConfirmation,
            trigger: "blur"
          },
          {
            required: true,
            message: "Please confirm the new password.",
            trigger: "blur"
          }
        ]
      }
    };
  },
  methods: {
    confirmation(msg, type, settings) {
      return this.$confirm(msg, type, settings);
    },
    changePassword() {
      this.$refs["passwordResetForm"].validate(valid => {
        if (valid) {
          this.passReset.loading = true;
          axios({
            url: "/api/changePassword",
            method: "patch",
            credentials: "same-origin",
            data: {
              resetType: 0,
              currentPassword: this.passReset.currentPassword,
              newPassword: this.passReset.newPassword,
              newPasswordConf: this.passReset.newPasswordConf
            }
          })
            .then(res => {
              this.$message({
                type: res.data.meta.msgType,
                message: res.data.meta.msg
              });
              //clearing forms
              this.passReset.newPassword = "";
              this.passReset.newPasswordConf = "";
              this.passReset.currentPassword = "";
              this.passReset.loading = false;
            })
            .catch(e => {
              console.log(e);
            });
        } else {
          console.log("validation error");
          return false;
        }
      });
    },
    async deleteAccount() {
      this.accountDeletion.dialogOpen = false;
      axios({
        url: "/api/deleteAccount",
        method: "delete",
        credentials: "same-origin",
        data: {
          passwordConfirmation: this.accountDeletion.passwordConfirmation
        }
      })
        .then(res => {
          this.$message({
            type: res.data.meta.msgType,
            message: res.data.meta.msg
          });
          //log out tik jei pass correct ir no error
          if (!res.data.meta.error) {
            this.logout();
          }
        })
        .catch(err => {
          console.log(err);
        });
    },
    validatePassConfirmation(rule, value, callback) {
      if (value === "") {
        callback(new Error("Please confirm the password."));
      } else if (value !== this.passReset.newPassword) {
        callback(new Error("Password confirmation doesn't match!"));
      } else {
        callback();
      }
    },
    async logout() {
      try {
        //because apparently i can't access the lyaout's logout
        await this.$store.dispatch("logout");
        this.$nuxt._router.push("/");
      } catch (e) {
        this.formError = e.message;
      }
    }
  },
  mounted() {
    if (this.$store.state.authUser) {
      this.$store.state.activeTab = "5";
    } else {
      // non-logged in users have no right to be here
      this.$nuxt._router.push("/");
    }
  },
  layout: "main",
  transition: "mainTransition",
  head: {
    title: "Profile"
  }
};
</script>


<style>
.ProfileForm {
  margin: auto;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 80%;
}

.spaced {
  margin-top: 5vh;
}
.title {
  font-family: LatoLight;
  font-size: 6vh;
  padding-top: 10vh;
  padding-left: 3vw;
}
</style>
