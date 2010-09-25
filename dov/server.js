var http = require('http');
var url = require('url');
var net = require('net');
var qs = require('querystring');
var fs = require('fs');
var Mu = require('./lib/mu');

Mu.templateRoot = './templates';

var SETTINGS = {
    'port': '8124',                 // Port to run the HTTP Server on
    'webroot': './web/',            // Location of the static files to serve over HTTP
    'GS_host': 'DOV',       // Game server host
    'GS_port': '31415',               // Game server port
    'debug': true
}

// All DoV API commands are functions which take a request and response object

// TODO - The parsing of args and creation of context should be in a function which can handle
// errors, validate the input?
var DOV_API = {
    login: function(request, response) {
        console.log("Processing 'login' request...");
        var urlData = qs.parse(url.parse(request.url).query);
        var ctx = {
            "username": urlData.username,
            "password": urlData.password
        }
        
        DoVGameServer.query(DoVGameServer.commands.LOGIN, ctx, response, function(data){
            var jsonResponse = {};
            jsonResponse.status = "success";
            jsonResponse.sessionID = data.sessionID;
            return jsonResponse;
        });
    },
    logout: function(request, response) {
        console.log("Processing 'logout' request...");
        var urlData = qs.parse(url.parse(request.url).query);
        var ctx = {
            "sessionID": urlData.sessionID
        }
        DoVGameServer.query(DoVGameServer.commands.LOGOUT, ctx, response, function(data) {
            var jsonResponse = {
                'status': 'success',
                'message': 'Logged out successfully!'
            };
            return jsonResponse;
        });
    },
    create_account: function(request, response) {
        console.log("Processing 'create account' request...");
        var urlData = qs.parse(url.parse(request.url).query);
        var ctx = {
            "name": urlData.name,
            "username": urlData.username,
            "password": urlData.password,
            "email": urlData.email
        }
        DoVGameServer.query(DoVGameServer.commands.CREATE_ACCOUNT, ctx, response, function(data){
           var jsonResponse = {};
           jsonResponse.status = "success";
           jsonResponse.sessionID = data.sessionID;
           return jsonResponse;
        });
    },
}

var DoVGameServer = {
    commands: {
        'LOGIN': 'login.xml',
        'LOGOUT': 'logout.xml',
        'CREATE_ACCOUNT': 'createAccount.xml'
    },
    sendJSONResponse: function(response, jsonResponse) {
        var strResponse = JSON.stringify(jsonResponse);
           
        if(SETTINGS.debug) {
            console.log("JSON Response: ");
            console.log(strResponse);
        }
        response.writeHead(200, {
            'Content-Type': 'application/json'
            }, encoding='utf8');
        response.end(strResponse, encoding='utf8');
    },
    
    processErrors: function(data) {
        var jsonResponse = {};
        
        if(data.status===200) {
            jsonResponse.status = "error";
            jsonResponse.message = "ERROR: " + data.errorMessage;
            
            return jsonResponse;
        } else if(data.status===300) {
            jsonResponse.status = "error";
            jsonResponse.message = "ERROR: Invalid request format";
            
            return jsonResponse;
        } else if(data.status===400) {
            jsonResponse.status = "error";
            jsonResponse.message = "ERROR: An unknown error occurred";
            
            return jsonResponse;
        } else {
            return false;
        }
        
    },
    //
    // Queries the game server database by rendering the proper XML command as specified by "command"
    //   * commands can be found in "DoVGameServer.commands"
    //   * context is a context object passed into mustache to fill the XML
    //   * response is the HttpServerResponse object
    //   * processGS_XML is a callback function used to process the data returned from the game server into some type of 
    //     JSON response to be given back to the user. This function should return a JSON object.
    //
    query: function(command, context, response, processGS_XML) {
        // Render the command XML template using the context
        Mu.render(command, context, {}, function(err, output) {
           if(err) {
               throw err;
           }
           var xmlRequest = '';
           var serverResponse = '';
           output.addListener('data', function (chunk) {
               xmlRequest += chunk; 
           });
           output.addListener('end', function () { 
               socket = net.createConnection(SETTINGS.GS_port, SETTINGS.GS_host); 
               socket.setEncoding('utf8');   
               
               socket.addListener('error', function(ex) {
                   var jsonResponse = {
                       'status': 'error',
                       'message': 'Unable to contact game server'
                   }
                   DoVGameServer.sendJSONResponse(response, jsonResponse);   
               });
               
               socket.addListener('connect', function() {
                   if(SETTINGS.debug) {
                       console.log("Request: ");
                       console.log(xmlRequest);
                   }
                   socket.write(xmlRequest);
                   socket.addListener('data', function(data) {
                       serverResponse += data;
                       
                       if(serverResponse.toLowerCase().indexOf("\n")) {
                           serverResponse = serverResponse.replace("\n", "");
                           socket.end();
                           
                           if(SETTINGS.debug) {
                               console.log("Response: ");
                               console.log("*" + serverResponse + "*");
                           }
                           // Process the XML, convert to a JSON object and send back
                           var serverObj = JSON.parse(serverResponse);
                           
                           var jsonResponse = DoVGameServer.processErrors(serverObj);
                           if(jsonResponse===false) {
                               jsonResponse = processGS_XML(serverObj);
                           }
                           DoVGameServer.sendJSONResponse(response, jsonResponse);
                       }
                   });
               });  // end socket connect
           });
        });
    }    
}   

// URLCONF maps urls to handler functions - this is very simple right now. No regular expressions or anything fancy like that
var URLCONF = {
    '/login': DOV_API.login,
    '/logout': DOV_API.logout,
    '/create_account': DOV_API.create_account
}


// This function will server static files from the "webroot" directory specified in SETTINGS
// It returns a 404 on error regardless of the error, this should be enhanced.
var static_serve = function(request, response) {
    var file = request.url.replace(/\.\.\//g,'').substring(1) || 'index.html';
    var contentType = (/\.(.*?)$/.exec(file)||[])[1] == 'html' ? 'text/html' : null;
    console.log("Attempting to fetch file: " + file);
    fs.readFile(SETTINGS.webroot + file, function (err, data) {
        if (err) {
            response.writeHead(404, {
                'Content-Type': 'text/plain'
            });
            response.end("Not Found");
        } else {
            response.writeHead(200, {
                  'Content-Type': contentType,
                  'Content-Length': data.length
            });
            response.end(data);
        }
    });
}

// Create our simple HTTP server
var server = http.createServer(function (request, response) {
    
    // Get the handler function from the URLCONF or default to the static_serve method if it isn't found
    var handler = URLCONF[url.parse(request.url).pathname] || static_serve;
    handler(request, response);
    
}).listen(SETTINGS.port);


console.log('Server running at http://127.0.0.1:' + SETTINGS.port);