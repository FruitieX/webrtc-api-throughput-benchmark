var IO_PORT = 1337;
var HTTP_PORT = 1338;

var io = require('socket.io')(IO_PORT);

io.sockets.on('connection', function(socket) {
	socket.on('message', function(message) {
		console.log('broadcasting ' + message);
		socket.broadcast.send(message);
	});
});

// static HTTP server
var static = require('node-static');
var file = new static.Server('./static');

require('http').createServer(function(req, res) {
	req.addListener('end', function () {
		file.serve(req, res);
	}).resume();
}).listen(HTTP_PORT);
