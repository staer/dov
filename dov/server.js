var http = require('http');
var url = require('url');
var net = require('net');
var querystring = require('querystring');
var fs = require('fs');
var Mu = require('./lib/mu');

Mu.templateRoot = './templates';
var host = '127.0.0.1';
var port = '8124';

http.createServer(function (request, response) {
    switch(url.parse(request.url).pathname) {
        case '/login':
            console.log("Login request received");
            
            var myData = querystring.parse(url.parse(request.url).query);
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
                   var socket = net.createConnection(port, host);
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
                               'Content-Type': 'text/plain',
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
            console.log("Attempting to fetch: " + file);
            
            fs.readFile('./web/' + file, function (err, data) {
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
}).listen(8124);

console.log('Server running at http://127.0.0.1:8124/');