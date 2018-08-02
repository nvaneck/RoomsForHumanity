// Connects to socket.io server
var socket;
var roomName = window.location.hash;

var isIE = /*@cc_on!@*/false || !!document.documentMode;
var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));
var isEdge = !isIE && !!window.StyleMedia;
if (isIE || isSafari || isEdge) {
    alert("For best experience, please switch to a supported web browser. Supported browsers include Google Chrome, Mozilla Firefox, and Opera")
}

// Setup HTML Objects
var button;

/* user = {
  name:
  userImg:
  userID:
}*/
var user = {};
var services = {
  "stream": streamEng
};

// For video framings
var isPublished = false;
var numPublishers = 0;
var videoIndices = [];
var activeVideos = [];
var hiddenVideos = [];

$(document).ready(function() {
    // Setup Socket;
    setupSocket();
    user.name = 'user';
    socket.emit('create user', user, roomName);
    $('#publishButton').click(function() {
        $('#infoText').attr('hidden', 'true');
        streamEng.publish();
        $('#publishButton').css('opacity', '0.25');
    });
    $('#screenshareButton').click(function() {
        streamEng.shouldScreenshare = true;
        $('#screenshareButton').attr("disabled", "true");
    });
    $('#poorButton').click(function() {
        outStats(1);
    });
    $('#avgButton').click(function() {
        outStats(2);
    });
    $('#goodButton').click(function() {
        outStats(3);
    });
    $('#message-button').click(sendMessage);
    $('#message-input').keyup(function(event) {
        if (event.keyCode === 13) {
            sendMessage();
        }
    });
    $('#open-chat-button').click(function() {
        chatBox = $('#chat-box');
        if (chatBox.hasClass('showBox')) {
            $('#chat-box').removeClass("showBox");
            $('#remote-video-div').removeClass("video-on-chat-open");
        } else {
            $('#chat-box').addClass("showBox");
            $('#remote-video-div').addClass("video-on-chat-open");
        }
    });
    $('#lockRoomButton').click(function() {
        pin = prompt("Please enter a pin to protect your room", "e.g. 94827");
        console.log(pin);
        setPin(pin);
    });
    //$('#invitePeopleButton').click(function() {
    //    $('#inviteModal').modal('toggle');
    //    $('#link-ref').html(function() { return window.location.href });
    //});

    window.setInterval(outStats, 1000);
    
    listenForNewMessages();
});



/******* SOCKET ********/

function setupSocket() {
    user.userID = uuid();
    streamEng.serviceAdress = "stream.roomsforhumanity.org";
    streamEng.setupService;
}

  streamEng.onPublish = function(stream) {

      if (!isPublished) {
          numPublishers++;
          activeVideos.push('#local-video');
      }
      isPublished = true;

      var isScreenshare = "";
      if (streamEng.shouldScreenshare === true) {
          isScreenshare = "screenshare";
      }


      $('#local-video-div').html(function() {
          return "<video muted id=\"local-video\" class=\'" + isScreenshare + "\' autoplay></video>";
      });
      $('#local-video').attr('src', window.URL.createObjectURL(stream));

      // $('#local-video').click(function(event) {
      //     if (activeVideos.length === 1) {
      //         unFullscreenVideo("#"+event.target.id);
      //     } else {
      //         fullscreenVideo("#" + event.target.id);
      //     }
      // });

      applyColumnClassesToVideo();
  };

  streamEng.onAddNewPublisher = function(videoIndex) {
    if (!videoIndices.includes(videoIndex)) {
        // Add video to videoIndices list (master list) and active video list
        var videoId = "#remoteVideo"+videoIndex.toString();
        videoIndices.push(videoIndex);
        activeVideos.push(videoId);

        // Add video to HTML
        var newVideoLayer = "<div class=\"videoStream\"><video id=\"remoteVideo" + videoIndex + "\" autoplay></video>";
        $('#remote-video-div').html(function() {
            return $('#remote-video-div').html() + newVideoLayer
        });
    }

    applyColumnClassesToVideo();
    console.log("Displayed video:", videoIndex);
  };

  streamEng.onDeletePublisher = function(videoIndex) {
    removeVideo(videoIndex);
}

//Hides Video when one is clicked
function fullscreenVideo(videoId) {

    var actives = activeVideos.slice();
    for (id in actives) {
        if (actives[id] !== videoId) {
            $(actives[id]).parent().hide();
            hiddenVideos.push(actives[id]);
            removeItemFromArray(activeVideos, actives[id]);
        }
    }

    // setTimeout(applyColumnClassesToVideo, 200);
    applyColumnClassesToVideo();
}
function unFullscreenVideo() {

    for (id in hiddenVideos) {
        activeVideos.push(hiddenVideos[id]);
    }
    hiddenVideos = [];

    $('video').parent().show();
    // setTimeout(applyColumnClassesToVideo, 200);
    applyColumnClassesToVideo();
}
function removeVideo(videoIndex) {
    console.log("Deleting:", videoIndex);
    $('#remoteVideo'+ videoIndex.toString()).parent().closest('div').remove();
    removeItemFromArray(videoIndices, videoIndex);
    removeItemFromArray(activeVideos, "#remoteVideo"+videoIndex.toString());
    applyColumnClassesToVideo();
}
function applyColumnClassesToVideo() {
    var videos = document.querySelectorAll('video');
    for (i in videos) {
        videos[i].onclick = function(event) {
            if (activeVideos.length === 1) {
                unFullscreenVideo();
            } else {
                fullscreenVideo("#" + event.target.id);
            }
        };
    };

    var columnSize;
    var smallColumnSize;
    if (activeVideos.length === 1) {
        columnSize = 12;
        smallColumnSize = 12;
    } else if (activeVideos.length === 2) {
        columnSize = 6;
        smallColumnSize=12;
    } else if (activeVideos.length >= 3) {
        columnSize = 4;
        smallColumnSize = 6;
    }

    if (isPublished) {
        $('#local-video-div').attr('class',"");
        $('#local-video-div').addClass("col col-lg-" + columnSize.toString() + " col-md-" + columnSize.toString() + " col-sm-" + smallColumnSize.toString() + " col-" + smallColumnSize.toString());
        $('body').attr('class', 'bg-dark');
    }

    for (var i = 0; i < videoIndices.length; i++) {
    $('.videoStream').attr('class',"videoStream");
    $('.videoStream').addClass("col col-lg-" + columnSize.toString() + " col-md-" + columnSize.toString() + " col-sm-" + smallColumnSize.toString() + " col-" + smallColumnSize.toString());
    $('.videoStream').addClass('centering');
  }

    if (activeVideos.length === 0) {
        $('body').attr('class', 'bg-light');
        $('#infoText').attr('hidden', 'false');
    } else {
        $('#infoText').attr('hidden', 'true');
        $('body').attr('class', '');
        $('body').css('background-color', 'black');
    }
}

function removeItemFromArray(array, item) {
  var index = array.indexOf(item);
  if (index > -1) {
    array.splice(index, 1);
  }
}

/****** MESSAGES **********/

function sendMessage() {
    var message = $('#message-input').val();
    $('#message-input').val("");

    var msg = {
        fromUser: user,
        message: message
    };

    updateMessagesToFirebase(msg);
}
function addMessageToChatBox(message) {
    var darker = "";
    if (message.fromUser.userID === user.userID) {
        darker = "darker";
    }

    var html = "<div class=\"message-item " + darker + "\">" +
        "<img class=\"message-img\" src=\"img/blink.png\"/>" +
        "<p class=\"message-text\">" + message.message + "</p> </div>";

    $("#messages").append(html);
    $('#messages').scrollTop($('#messages').prop("scrollHeight"));
}

/***** FIREBASE *******/

function updateMessagesToFirebase(message) {
    var roomName_name = roomName.substring(1);

    var newMessageKey = database.ref().child(roomName_name).push().key;
    var updates = {};
    updates[roomName_name + '/messages/' + newMessageKey] = message;
    database.ref().update(updates);
}
function listenForNewMessages() {
    var roomName_name = roomName.substring(1);
    var messageRef = database.ref(roomName_name + '/messages');
    messageRef.on('child_added', function(snapshot) {
        addMessageToChatBox(snapshot.val());
    });
}

function setPin(pin) {
    var socket = io.connect("https://stream.roomsforhumanity.org");
    console.log(roomName);
    socket.emit('set pin', pin, roomName);
}

function uuid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}