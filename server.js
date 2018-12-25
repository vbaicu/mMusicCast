const ssdp = require("peer-ssdp"),
	peer = ssdp.createPeer(),
	uuid = require('node-uuid'),
	myUuid = uuid.v4(),
	fs = require('fs'),
	express = require('express'),
	http = require('http'),
	app = express(),
	querystring = require('querystring'),
	request = require('superagent')
	logger = require('morgan')
	bodyParser = require('body-parser')
  methodOverride = require('method-override'),
  {exec} = require('child_process')
const name = "mMusicCast"
const isPi = require('detect-rpi')
const WebSocketServer = require('websocket').server;
const WebSocketRouter = require('websocket').router;
const Apps = require('./apps/apps.js');

app.set('port', 8008);

app.use((req, res, next) => {
	var data = '';
	req.setEncoding('utf8');
	req.on('data', function(chunk) {
		data += chunk;
	});
	req.on('end', function() {
		req.rawBody = data;
		next();
	});
});
app.disable('x-powered-by');
app.use(express.static(__dirname + '/public'));
app.use(logger());
app.use(bodyParser());
app.use(methodOverride());
app.use( (req, res, next) => {
	res.removeHeader("Connection");
	next();
});

app.disable('x-powered-by');

var server = http.createServer(app);

const spotifyConnect = () => {
  let cmd = ''
  if(process.platform === 'darwin') {
    cmd = './spotify/librespot-darwin'
  } else if(process.platform === 'linux') {
    if(isPi()){
      cmd = './spotify/librespot-pi'
    } else {
      cmd = './spotify/librespot-linux'
    }
  }
  exec(`${cmd} --name ${name}`)
  //windows not supported
}

spotifyConnect()

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});



var wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

var wssRouter = new WebSocketRouter();
wssRouter.attachServer(wsServer);

wsServer.on('request', (request) => {
});

wssRouter.mount('/stage','', (request) => {
	global.stageConnection = request.accept(request.origin);

	global.stageConnection.send(JSON.stringify({
		cmd: "idle"
	}));
});

wssRouter.mount('/system/control','', (request) => {
	var connection = request.accept(request.origin);
	console.log("system/control");
});

wssRouter.mount('/connection','', (request) => {
	var connection = request.accept(request.origin);
	var name;
	connection.on('message', (message) => {
		let cmd = JSON.parse(message.utf8Data);
		if(cmd.type == "REGISTER") {
			name = cmd.name;
			connection.send(JSON.stringify({
				type: "CHANNELREQUEST",
				"senderId": 1,
				"requestId": 1
			}));

			wssRouter.mount("/receiver/"+cmd.name, '', function(request) {
				var receiverConnection = request.accept(request.origin);
				var appName = request.resourceURL.pathname.replace('/receiver/','').replace('Dev','');
				Apps.registered[appName].registerReceiver(receiverConnection);
			});

		} else if(cmd.type == "CHANNELRESPONSE") {
			connection.send(JSON.stringify({
				type: "NEWCHANNEL",
				"senderId": 1,
				"requestId": 1,
				"URL": "ws://localhost:8008/receiver/"+name
			}));
		}
	});
});

var regex = new RegExp('^/session/.*$');
wssRouter.mount(regex, '', (request) => {
	var sessionConn = request.accept(request.origin);
	console.log("Session up");

	var appName = request.resourceURL.pathname.replace('/session/','');
	var sessionId = request.resourceURL.search.replace('?','');

	var targetApp = Apps.registered[appName];

	if(targetApp) {
		targetApp.registerSession(sessionConn);
	}
});

const getIPAddress = () => {
	var n = require('os').networkInterfaces();
	var ip = []
	for (var k in n) {
		var inter = n[k];
		for (var j in inter) {
			if (inter[j].family === 'IPv4' && !inter[j].internal) {
				return inter[j].address
			}
		}
	}
}




 
const setupApps = (addr) => {
	Apps.init(fs, app);
	Apps.registerApp(app, addr, "ChromeCast", "https://www.gstatic.com/cv/receiver.html?$query", "");
	Apps.registerApp(app, addr, "YouTube", "https://www.youtube.com/tv?$query", "");
	}

const setupRoutes = (addr) => {
	app.get("/ssdp/device-desc.xml", (req, res) => {
		fs.readFile('./device-desc.xml', 'utf8', function (err,data) {
			data = data.replace("#uuid#", myUuid).replace("#base#","http://"+req.headers.host).replace("#name#", name);
			res.type('xml');
			res.setHeader("Access-Control-Allow-Method", "GET, POST, DELETE, OPTIONS");
			res.setHeader("Access-Control-Expose-Headers", "Location");
			res.setHeader("Application-Url", "http://"+req.headers.host+"/apps");
			res.send(data);
		});
	});

	app.post('/connection/:app', (req, res) => {
		console.log("Connecting App "+ req.params.app);

		res.setHeader("Access-Control-Allow-Method", "POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");

		res.type("json");
		res.send(JSON.stringify({
			URL: "ws://"+addr+":8008/session/"+req.params.app+"?1",
			pingInterval: 3
		}))
	});

	app.get('/apps', (req, res) => {
		for (var key in Apps.registered) {
			if(Apps.registered[key].config.state == "running") {
				console.log("Redirecting to"+ key);
				res.redirect('/apps/'+key);
				return;
			}
		}

		res.setHeader("Access-Control-Allow-Method", "GET, POST, DELETE, OPTIONS");
		res.setHeader("Access-Control-Expose-Headers", "Location");
		res.setHeader("Content-Length", "0");
		res.setHeader("Content-Type", "text/html; charset=UTF-8");
		res.send(204, "");

	});
}

const setupSSDP = (addr) => {
	peer.on("ready",function(){
	});

	peer.on("notify",(headers, address) =>{
	});

	peer.on("search",(headers, address) =>{
		if(headers.ST.indexOf("dial-multiscreen-org:service:dial:1") != -1) {
			peer.reply({
				LOCATION: "http://"+addr+":8008/ssdp/device-desc.xml",
				ST: "urn:dial-multiscreen-org:service:dial:1",
				"CONFIGID.UPNP.ORG": 7337,
				"BOOTID.UPNP.ORG": 7337,
				USN: "uuid:"+myUuid
			}, address);
		}
	});

	peer.start();
}
//

var addr = getIPAddress();
console.log(addr);
setupApps(addr);
setupRoutes(addr);
setupSSDP(addr);
