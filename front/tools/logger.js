module.exports = {
  logMessage: function(msg,errorLevel) {
    if(errorLevel===0) console.log('[LOG ]'+msg);
    else if(errorLevel===1) console.log('[WARN]'+msg);
    else console.log('[ERR ]'+msg);
  },
  logException: function(err,errorLevel) {
    if(errorLevel===0) console.log('[LOG ]'+err.message);
    else if(errorLevel===1) console.log('[WARN]'+err.message);
    else console.log('[ERR ]'+err.message);
    console.error(JSON.stringify(err));
  }
}
