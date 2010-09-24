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
    'GS_port': '8124'               // Game server port
}

http.createServer(function (request, response) {
    switch(url.parse(request.url).pathname) {
        case '/login':
            console.log("Login request received");
            
            var myData = qs.parse(url.parse(request.url).query);
            var ctx = {
                "username": myData.username,
                "password": myData.password
            };
            
            Mu.render("login.xml", ctx, {}, function(err, output) {
               if(err) {
                   throw err;
               }
               var requestBuffer = '';
               output.addListener('data', function (chunk) {
                   requestBuffer += chunk; }
               );
               output.addListener('end', function () { 
                   var socket = net.createConnection(SETTINGS.GS_port, SETTINGS.GS_host);
                   socket.setEncoding('utf8');
                   socket.addListener('connect', function() {
                       socket.write(requestBuffer);
                       socket.addListener('data', function(data) {
                           // Read the XML from the server here
                       });
                       socket.addListener('end', function() {
                           socket.end();
                           // Process the XML, convert to a JSON object and send back
                           var jsonResponse = {
                               "status": "success",
                               "sessionID": "Session_ID_Goes_Here"
                           };

                           var strResponse = JSON.stringify(jsonResponse);
                           response.writeHead(200, {
                               'Content-Type': 'application/json',
                               'Content-Length': strResponse.length
                           }, encoding='utf8');
                           response.end(strResponse, encoding='utf8');
                       });
                   });
               });
            });
            break;
            
        // The default case will attempt to serve the request as a static file instead of an API call    
        default: 
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
            break;
    }
}).listen(SETTINGS.port);

console.log('Server running at http://127.0.0.1:' + SETTINGS.port);