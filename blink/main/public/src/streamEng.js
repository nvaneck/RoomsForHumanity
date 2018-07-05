//STATUS: WOrking 
var localVideoObject;
var remoteVideoObject;
var broadcastButton;

var roomName = "helloAdele";
var localStreams = {};
var localStream = undefined;

const configOptions = {"iceServers": [{"url": "stun:stun.l.google.com:19302"},
              { url: 'turn:numb.viagenie.ca',
                credential: 'enter1234',
                username: 'bethin.charles@yahoo.com'
              }]};

// var subscibers = [];
// var publishers = [];
var peers = [];
var peerNumberOf = {
  "userID": "peerNumber"
};

var constraints = {
  video: true,
  audio: true
};

//var MongoClient = require('mongodb').MongoClient;
//var url = "mongodb://52.15.79.228:27017/RoomsStats";
var statsIteration = 1;

///////////////////////
//// StreamCast Eng Stuff

var streamEng = {
    socket: null,
    serviceAddress: null,
    onSubscribeDone: undefined,
    shouldScreenshare: false
};

var numPublishers = 0;

streamEng.setupService = function() {
  streamEng.subscribe();
};

streamEng.publish = function() {
  setupMediaStream(false);
  streamEng.socket.emit('publish rooms', roomName);
  streamEng.socket.on('publish response', function(roomExists, passcode) {
    if(!roomExists) {
      pin = prompt("Please enter a pin to protect your room", "e.g. 94827");
      console.log("Logging pin");
      console.log(pin);
    }
    else {
      pin = passcode;
    }
    streamEng.socket.emit('publish', user.userID, roomName, pin);
    user.isPublished = true;
    console.log("Publishing");
  });
};

streamEng.subscribe = function() {
  setupPage();
  streamEng.socket = io.connect(streamEng.serviceAddress);
  console.log("Connected to Stream Server", streamEng.serviceAddress, roomName);

  // $('#publishButton').click(function() {
    //   streamEng.publish();
    // });

  streamEng.socket.emit('subscribe rooms', roomName);
  streamEng.socket.on('subscribe response', function(roomExists, passcode) {
    if(!roomExists) {
      pin = prompt("Please enter a pin to protect your room", "e.g. 94827");
      console.log("Logging pin");
      console.log(pin);
    }
    else {
      pin = passcode;
    }

  streamEng.socket.emit('subscribe', user.userID, roomName, pin);

  // When it receives a subscriber ready message, add user to peers (only publishers get subscriber ready msg's)
  streamEng.socket.on('subscriber ready', function(clientID) {
      console.log("Subscriber ready from", clientID);

    if (!peerNumberOf.hasOwnProperty(clientID)) {

      // If this clientID isn't on record yet, create a new PC and add it to record
        // Then join the room
      if (user.userID !== clientID) {
        var newPeerConnection = createPeerConnection(clientID);
        peers.push({
          "userID": clientID,
          "number": (peers.length),
          "peerConnection": newPeerConnection,
            setAndSentDescription: false
        });
        peerNumberOf[clientID] = peers.length - 1;
      }

      joinRoom(peerNumberOf[clientID]);

    // If client is on record,
    } else {
      console.log("Already connected to this peer. Initiating stream");

      var peerNumber = peerNumberOf[clientID];
      joinRoom(peerNumberOf[clientID]);
    }

  });

  // The broadcaster is ready to stream, create a PC for it
  streamEng.socket.on('publisher ready', function(publisherID, publisherNumber) {
    console.log("Publisher ready from:", publisherNumber);

    /* If peer doesn't exist, create new PC and add it to list of peers
    If it does exist, reset the publisher number and the onaddstream function
    so that the peer number is correct */
    if (!peerNumberOf.hasOwnProperty(publisherID)) {
      if (user.userID !== publisherID) {
        var newPeerConnection = createPeerConnection(publisherID, publisherNumber);
        peers.push({
          "userID": publisherID,
          "number": (peers.length),
          "peerConnection": newPeerConnection,
          "publisherNumber": publisherNumber
        });
    //
        peerNumberOf[publisherID] = peers.length - 1;
      }
    } else {
      peers[peerNumberOf[publisherID]].publisherNumber = publisherNumber;
      peers[peerNumberOf[publisherID]].peerConnection.onaddstream = function(event) {
        console.log('Received remote stream');
        $('#remoteVideo'+ publisherNumber.toString()).attr('src', window.URL.createObjectURL(event.stream));
        console.log("Adding stream to:", peers[peerNumberOf[publisherID]].publisherNumber);
        console.log("for peer: ", publisherID);
      };
    }

    streamEng.onAddNewPublisher(publisherNumber);
  });

  // On signal, go to gotMessageFromServer to handle the message
  streamEng.socket.on('signal', function(message) {
    gotMessageFromServer(message);
  });

  // Handle client disconnect
  streamEng.socket.on('disconnect user', function(userID, roomName) {
     if (peerNumberOf.hasOwnProperty(userID)) {
       var peerNumber = peerNumberOf[userID];
       if (peers[peerNumber].hasOwnProperty("publisherNumber")) {
         // If it's a publisher, delete publishers;
           streamEng.onDeletePublisher(peers[peerNumber].publisherNumber);
       }

       peers.splice(peerNumber, 1);
     }
  });

    if (typeof streamEng.onSubscribeDone !== "undefined") {
        streamEng.onSubscribeDone();
    }
  });
}


//////////////////////////
////// To make this work

function gotMessageFromServer(message) {
    var signal = message;
    var peerNumber = -1;

    // Ignore messages from ourself
    if(signal.userID === user.userID) {
      console.log("Received from self");
      return;
    }

    // if (true) {
      // If I'm the broadcaster, loop through my peers and find the right
      // peer connection to use to send to
      peerNumber = peerNumberOf[signal.userID];

      if (peers[peerNumber].userID === signal.userID) {

        if(signal.type === "sdp") {
            peers[peerNumber].peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
                // Only create answers in response to offers
                if(signal.sdp.type === 'offer') {
                    console.log("Got offer");
                    peers[peerNumber].peerConnection.createAnswer().then(function(description) {
                        setAndSendDescription(description, peerNumber);
                    }).catch(errorHandler);
                } else {
                  console.log("Got answer")
                }
            }).catch(errorHandler);
        } else if(signal.type === "ice") {
            peers[peerNumber].peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
        }
      }
    // }

}


function joinRoom(peerNumber) {
    try {
        setupMediaStream(true, peerNumber);
    } catch(err) {
        console.log("Error:", err)
    }
}

// Get the media from camera/microphone.
function setupMediaStream(startStream, peerNumber) {

    if (streamEng.shouldScreenshare) {
        getScreenConstraints(function(error, screen_constraints) {
            if (error) {
                return alert(error);
            }

            var video_options = {
                video: screen_constraints
            };
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            if (localStream !== undefined) {
                console.log("Reusing stream");
                shareStream(localStream, startStream, peerNumber);
            } else {
                navigator.getUserMedia(video_options, function(stream) {
                    localStream = stream;
                    shareStream(stream, false, peerNumber);
                }, function(error) {
                    console.log("SCREENSHARE ERR:", error);
                });
            }

        });
    } else {
        if(navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
                shareStream(stream, startStream, peerNumber);
            });
        } else {
            alert('Your browser does not support getUserMedia API');
        }
    }
}

function shareStream(stream, startStream, peerNumber) {
    localStreams[peerNumber] = stream;

    if (startStream === false) {
        streamEng.onPublish(stream);
    }
    // If you want to start the stream, addStream to connection
    else {
        console.log("NOT ON PUBLISH");
        if (!peers[peerNumber]) {
            console.log("NOPE:", peerNumber);
        }
        peers[peerNumber].peerConnection.addStream(localStreams[peerNumber]);

        peers[peerNumber].peerConnection.createOffer().then(function(description) {
            setAndSendDescription(description, peerNumber);
        }).catch(errorHandler);
    }
}

// Create peer connection 1
function createPeerConnection(peerUserID, publisherNumber) {

  var newPeerConnection = new RTCPeerConnection(configOptions);
  newPeerConnection.onicecandidate = function(event) {
    if(event.candidate !== null) {
        streamEng.socket.emit('signal', {'type': 'ice', 'ice': event.candidate, 'userID': user.userID}, peerUserID, roomName);
    }
  };

  if (publisherNumber !== null) {
    newPeerConnection.onaddstream = function(event) {
      console.log('Received remote stream:', event.stream);
        $('#remoteVideo'+ publisherNumber.toString()).attr('src', window.URL.createObjectURL(event.stream));
        console.log("Adding stream to:", publisherNumber);
        peers[peerNumberOf[peerUserID]].hasConnected = true;
    };
  }


  return newPeerConnection;
}
function setAndSendDescription(description, peerNumber) {

  // if (sendToPeerValue == -10) {
  //   broadcaster.peerConnection.setLocalDescription(description).then(function() {
  //       streamEng.socket.emit('signal', {'type': 'sdp', 'sdp': broadcaster.peerConnection.localDescription, 'userID': user.userID}, broadcaster.castID, roomName);
  //   }).catch(errorHandler);
  // } else {
        peers[peerNumber].peerConnection.setLocalDescription(description).then(function () {
            streamEng.socket.emit('signal', {
                'type': 'sdp',
                'sdp': peers[peerNumber].peerConnection.localDescription,
                'userID': user.userID
            }, peers[peerNumber].userID, roomName);
        }).catch(errorHandler);
  // }
}

// Setup DOM elements and responses
function setupPage() {
    user.isPublished = false;
    user.isSubscribed = true;

    localVideoObject = document.getElementById('local-video');
    remoteVideoObject = document.getElementById('remote-video');


    // If client is going to disconnect, let server know
    window.addEventListener("beforeunload", function(e) {
        streamEng.socket.emit('disconnect client', user.userID, roomName); // Disconnects from roomm
    }, false);
}

///////////////////
function errorHandler(error) {
    console.log(error.message);
}

//Output stats to console log
function logStats(RTCPeerConnection) {
  var rtcPeerconn = RTCPeerConnection;
  var d = new Date();
  var time = d.getTime();
  //console.log('Creating MongoDB collection');
  //streamEng.socket.emit('create collection', '_' + time.toString());
    try {
      //Chrome
      rtcPeerconn.getStats(function callback(report) {
        var rtcStatsReports = report.result();
        for(var i=0; i<rtcStatsReports.length; i++) {
          var statNames = rtcStatsReports[i].names();
          //filter the ICE stats
          if(statNames.indexOf("transportId") > -1) {
            var logs = "";
            for(var j=0; j<statNames.length; j++) {
              var statName = statNames[j];
              var statValue = rtcStatsReports[i].stat(statName);
              logs = logs + statName + ": " + statValue + ", ";
            }
              console.log("Sending data to Firebase");
              var placeholder = roomName;
              if(placeholder.charAt(0) === '#') {
                placeholder = placeholder.slice(1);
                console.log(placeholder);
              }
              streamEng.socket.emit('stats data', logs, 'test@' + time.toString(), placeholder, user.userID);
              console.log(logs);
              statsIteration = statsIteration + 1;
            }
          }
      });
    } catch (e) {
      //Firefox
    //  if(remoteVideoStream) {
    //    var tracks = remoteVideoStream.getTracks();
    //    for (var h=0; h<tracks.length; h++) {
    //      rtcPeerconn.getStats(tracks[h], function callback(report) {
    //        console.log(report);
    //      }, function(error) {});
    //    }
    //  }
    }
//    db.close();
//  });
}

function outStats() {
  for(var i = 0; i < peers.length; i++) {
    console.log("Stats for connection " + i);
    logStats(peers[i].peerConnection);
  }
}