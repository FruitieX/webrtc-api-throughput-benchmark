// from http://www.w3.org/TR/webrtc/#peer-to-peer-data-example with minor tweaks
var signalingChannel = new io('http://192.168.1.248:1337');
var configuration = {
	"iceServers": [
		{ url: 'stun:stun.l.google.com:19302' }
	]
};

var pc;

// call start(true) to initiate
function start(isInitiator) {
	console.log('sending chunks of size: ' + chunkSize);
	pc = new RTCPeerConnection(configuration);

	// send any ice candidates to the other peer
	pc.onicecandidate = function (evt) {
		if (evt.candidate)
			signalingChannel.send(JSON.stringify({ "candidate": evt.candidate }));
	};

	// let the "negotiationneeded" event trigger offer generation
	pc.onnegotiationneeded = function () {
		pc.createOffer(localDescCreated, logError);
	}

	if (isInitiator) {
		var dcOpts = {
			ordered: false,
			maxRetransmits: 0
		};
		// create data channel and setup chat
		var channel = pc.createDataChannel("chat", dcOpts);
		setupChannel(channel, isInitiator);
	} else {
		// setup chat on incoming data channel
		pc.ondatachannel = function (evt) {
			var channel = evt.channel;
			setupChannel(channel, isInitiator);
		};
	}
}

function localDescCreated(desc) {
	pc.setLocalDescription(desc, function () {
		signalingChannel.send(JSON.stringify({ "sdp": pc.localDescription }));
	}, logError);
}

signalingChannel.on('message', function (evt) {
	if (!pc)
		start(false);

	var message = JSON.parse(evt);
	if (message.sdp)
		pc.setRemoteDescription(new RTCSessionDescription(message.sdp), function () {
			// if we received an offer, we need to answer
			if (pc.remoteDescription.type == "offer")
				pc.createAnswer(localDescCreated, logError);
		}, logError);
	else
		pc.addIceCandidate(new RTCIceCandidate(message.candidate));
});

var dcOpenTime;
var MByte = 1024 * 1024;

// NOTE: at least chromium seems to not send more than 66528 bytes of data!
var chunkSize = 1024 * 60;
var chunk = new Uint8Array(chunkSize);
// fill with random data
for (var i = 0; i < chunk.length; i++) {
	chunk[i] = Math.round(Math.random() * 256);
}

var recvdChunks = 0;
var recvdBytes = 0;
var printStats = _.throttle(function() {
	if(new Date().getTime() - dcOpenTime != 0) {
		$("#results").text("bytes recvd: " + recvdBytes + ", throughput (MB/s): " +
				Math.round(100 * (recvdChunks * chunkSize / MByte /
				((new Date().getTime() - dcOpenTime) / 1000))) / 100);
	}
}, 1000);

function setupChannel(channel, isInitiator) {
	channel.onopen = function () {
		console.log('dc onopen');
		// e.g. enable send button
		if(isInitiator) {
			dcOpenTime = new Date().getTime();
			throughputBenchmark(channel);
		} else {
			dcOpenTime = new Date().getTime();
			// comment this line for simplex test
			throughputBenchmark(channel);
		}
	};

	channel.onmessage = function (evt) {
		recvdChunks++;
		recvdBytes = evt.data.byteLength;

		printStats();
	};
}

var printBuffer = _.throttle(function() {
	console.log("waiting for buffer to go under: " + maxBuffer);
}, 1000);

var maxBuffer = 1000000;
var sentChunks = 0;
var sendTimer;
function throughputBenchmark(channel) {
	clearInterval(sendTimer);
	sendTimer = setInterval(function() {
		if(channel.bufferedAmount >= maxBuffer) {
			printBuffer();
		} else {
			channel.send(chunk);
		}
	});
}

function logError(error) {
	console.log(error.name + ": " + error.message);
}

$(window).on('beforeunload', function() {
	signalingChannel.disconnect();
});
$(document).ready(function() {
	$("#startButton").click(function() {
		start(true);
	});
});
