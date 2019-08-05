module.exports = {
  // a base object for most api responses
  genericResponseObject: function genericResponseObject(message) {
    return {
      meta: {
        error: false,
        msgType: "success",
        msg: message ? message : null
      }
    };
  },
  // a base object for most api error responses
  genericErrorObject: function genericErrorObject(message) {
    return {
      meta: {
        error: true,
        msgType: "error",
        msg: message ? message : "An error has occured."
      }
    };
  }
};
