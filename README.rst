------------------------------
DoV Node.js API Server Example
------------------------------

This project is a simple example of how a Node.js based server could be used to host a public API for the closed source DoV game engine.

------
Set Up
------
In the 'server.js' file, you will have to set up some of the global settings in the SETTINGS variable. Settings you will probably want to change:

 * SETTINGS.port - this is the port to run the server on, by default it will run on port 8124

 * SETTINGS.webroot - this is the directory relative to the server.js file that static files (i.e. the web interface) will be served from.

 * SETTINGS.GS_host  - this should be set to the DoV game server domain name or IP. If you don't know it, then you probably shouldn't be trying to run this program!

 * SETTINGS.GS_port - this should be set to the DoV game server port. If you don't know it, then you probably shouldn't be attempting to run this program.

 * SETTINGS.debug - this is a boolean specifying to output additional debugging info or not, but default it is set to true.

------------------
Running the Server
------------------
Once the settings have been configured, all you have to do is run 'node server.js'. This assumes that you have node.js installed on your machine.

Once the server is running, head to http://localhost:8124 to view the example web interface (the port may be different depending on your settings).