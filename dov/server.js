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
    'GS_host': '127.0.0.1',         // Game server host
    'GS_port': '8124',               // Game server port
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
            var jsonResponse = {
                'status': 'error',
                'message': 'Invalid Username or Password'
            }
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
                'status': 'TODO: Log Out has not been implemented fully!'
            }
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
           var jsonResponse = {
               'status': 'TODO: CreateAccount has not been implemented fully!'
           } 
           return jsonResponse;
        });
    }
}

var DoVGameServer = {
    commands: {
        'LOGIN': 'login.xml',
        'LOGOUT': 'logout.xml',
        'CREATE_ACCOUNT': 'createAccount.xml'
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
           var xmlResponse = '';
           output.addListener('data', function (chunk) {
               xmlRequest += chunk; 
           });
           output.addListener('end', function () { 
               var socket = net.createConnection(SETTINGS.GS_port, SETTINGS.GS_host);
               socket.setEncoding('utf8');
               socket.addListener('connect', function() {
                   if(SETTINGS.debug) {
                       console.log("Request: ");
                       console.log(xmlRequest);
                   }
                   socket.write(xmlRequest);
                   socket.addListener('data', function(data) {
                       xmlResponse += data;
                       if(xmlResponse.toLowerCase().indexOf("</response>")) {
                           socket.end();
                           
                           if(SETTINGS.debug) {
                               console.log("Response: ");
                               console.log(xmlResponse);
                           }
                           // Process the XML, convert to a JSON object and send back
                           var jsonResponse = processGS_XML(xmlResponse);
                           var strResponse = JSON.stringify(jsonResponse);

                           response.writeHead(200, {
                               'Content-Type': 'application/json'
                           }, encoding='utf8');
                           response.end(strResponse, encoding='utf8');
                       }
                   });
               });
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
http.createServer(function (request, response) {
    
    // Get the handler function from the URLCONF or default to the static_serve method if it isn't found
    var handler = URLCONF[url.parse(request.url).pathname] || static_serve;
    handler(request, response);
    
}).listen(SETTINGS.port);

console.log('Server running at http://127.0.0.1:' + SETTINGS.port);