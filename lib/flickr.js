var   https = require("https")
    , util = require('util')
    , OAuth = require("oauth").OAuth;
   
exports.Flickr = function(consumer_key, consumer_secret, options) {
  
  options = options || {};

  this.consumer_key = consumer_key;
  this.consumer_secret = consumer_secret;
  this.oauth_token = options["oauth_token"] || null;
  this.oauth_token_secret = options["oauth_token_secret"] || null;
  
  // process options
  
  this.baseUrl = options["baseUrl"] || "/services/rest";
  
  this.oauth_client = new OAuth("https://www.flickr.com/services/oauth/request_token",
                                "https://www.flickr.com/services/oauth/access_token",
                                consumer_key,
                                consumer_secret,
                                "1.0A",
                                null,
                                "HMAC-SHA1");
  
};

exports.Flickr.prototype.setOAuthTokens = function(oauth_token, oauth_token_secret) {
  this.oauth_token = oauth_token;
  this.oauth_token_secret = oauth_token_secret;
};

exports.Flickr.prototype.executeAPIRequest = function (method, params, signed_in, optionsOrCallback) {
  
  var callback = optionsOrCallback;
  var options = null;

  if (arguments.length == 4 && typeof optionsOrCallback == "object") {
    callback = arguments[3];
    options = optionsOrCallback;
  }
  
  if (options == null) { options = {}; }
  
  if( params === undefined || params === null)  params = {};
  
  // apply default arguments 
  params.format= "json";
  params.nojsoncallback= "1";
  params.method = method;
  
  if (signed_in === true) {
    // use OAuth client 
    this._executeOAuthAPIRequest(params, options, callback);
  } else {
    // use simple API token method
    this._executeNoAuthAPIRequest(params, options, callback);
  }
  
};

exports.Flickr.prototype._executeOAuthAPIRequest = function(params, options, callback) {

  var oauth_token = options["oauth_token"] || this.oauth_token;
  var oauth_token_secret = options["oauth_token_secret"] || this.oauth_token_secret;
  
  var flickr_instance = this;
  
  // console.log("ot: " + oauth_token + " ots: " + oauth_token_secret + " -- " + this.oauth_token);
  
  var queryString = this.paramsToQueryString(params);

  var request = this.oauth_client.get("https://api.flickr.com" + this.baseUrl + queryString, 
                          oauth_token, oauth_token_secret, function(error, data){
    if (error) {
      callback(new Error("Flickr Error ("+error.statusCode+"): message: "+error.data));
    } else {
      flickr_instance.processResponse(data, options, callback);
    }
  });
  
};

exports.Flickr.prototype._executeNoAuthAPIRequest = function(params, options, callback) {

  var flickr_instance = this;
  
  // add security
  params.api_key = this.consumer_key;
  
  var queryString = this.paramsToQueryString(params);

  var resOptions = {
    hostname: 'api.flickr.com',
    // port: 80,
    path: this.baseUrl+queryString,
    method: 'GET'
  };

  // console.log("query: ", this.baseUrl+queryString);

  var req = https.request(resOptions, function(res) {
    // console.log("statusCode: ", res.statusCode);
    // console.log("headers: ", res.headers);
    var result= "";
    res.setEncoding("utf8");

    res.on('data', function(chunk) {
      result+= chunk;
    });

    res.on('end', function() {
      flickr_instance.processResponse(result, options, callback);
    });

  });
  req.end();

  req.on('error', function(e) {
    console.error(e);
  });
};

exports.Flickr.prototype.processResponse = function(response_body, options, callback) {
  
  options = options || {};
  var result_mapper = options["result_mapper"];
  var ourCallback = callback;
  
  // comment from Flickrnode:
  // Bizarrely Flickr seems to send back invalid JSON (it escapes single quotes in certain circumstances?!?!!?)
  // We fix that here.
  if( response_body ) {  
      response_body = response_body.replace(/\\'/g,"'");
  }
  
  // console.log("response_body was " + util.inspect(response_body));

  var res = JSON.parse(response_body);
  if( res.stat && res.stat == "ok" ) {

      if( result_mapper ) {
          res = result_mapper(res);
      }

      // console.log("res is " + util.inspect(res));
      ourCallback(null, res);
  } else {
      
      ourCallback(new Error("Flickr Error ("+res.code+"): " + res.message));;
  }
  

};

exports.Flickr.prototype.paramsToQueryString = function (params) {
  var queryString = "";
  var operator= "?";
  for(var key in params) {
      queryString += (operator + key + "=" + encodeURIComponent(params[key]));
      if( operator == "?" ) operator= "&";
  }
  return queryString;
}
