var me_vid = document.getElementById('me')
var call = document.getElementById('call')
var media 
var Peer = require('simple-peer')
var ui = require('getids')()
var h = require('hyperscript')
var signalhub = require('signalhub')
const short = require('short-uuid');
const msrc = require('mediasource')
const toa = require('to-arraybuffer')
const btob = require('blob-to-buffer')
//var master = new AudioContext
//var mic = require('../jsynth-mic/stream')
var peers = {}
var qs = require('querystring')
var minimist = require('minimist')
var argv = minimist(process.argv, {
  default: {
    host: '0.0.0.0',
    port: 8009,
    protocol: 'http'
  }
})
var store = require('store')
    var me = store.get('myself')
    if(!me) me = {id: short().generate()}
    store.set('myself', me)
    ui.myid.innerText = me.id

//console.log(argv)

var ael = ui.player
var mime = 'audio/webm;codecs=opus'
var phonebook = {}
ui.callId.value = ui.callId.innerText = window.location.hash.slice(1)

ui.demo.addEventListener('click', e => {
  e.preventDefault()
  addMedia()
})
//addMedia()
var hub = signalhub(argv.protocol + '://' + argv.host + ':' + argv.port, 'meow')
var pipe = hub.subscribe(me.id)
pipe.on('error', function(e){console.log(e)})
pipe.on('data', function(data){
  // this needs to go into call waiting...
  data = JSON.parse(data.toString())
  // callerID
  var from = data.callerId
  _connect(data, recr)
  //ui.callers.appendChild(h('div.caller', h('button.connect', `Connect to ${data.name || from}`, {onclick: _connect})))  
})

var session = qs.parse(window.location.search.slice(1))
console.log(session)
if(session.call) hub.broadcast(session.id, JSON.stringify({callerId: me.id}))

var sink = new msrc(ael).createWriteStream(mime)
var recr 

ui.callem.onclick = e =>{
  addMedia()
} 

function mute(torf){
  micStream.getAudioTracks()[0].enabled = torf
}

function addMedia(id, audio=true, video=false){
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia

  navigator.getUserMedia({video, audio}, function(stream){
    //console.log(stream.getAudioTracks())
    //var micnode = mic(master, stream)
    recr = new MediaRecorder(stream, {mimeType: mime, audioBitsPerSecond:40000})
    // do same for host monitoring:
    recr.addEventListener('dataavailable', e => {
      //console.log(e)
      for(var smith in phonebook) btob(e.data, (err, buf) => phonebook[smith].write(buf))
      //setTimeout(function(){ recr.stop() }, 3000)
    })

    recr.start(20)
    ael.play()
    
    
  }, function(err){
      console.log(err)
  })
}

function _connect(data, recr){
  console.log(data)
  if(phonebook[data.callerId]) phonebook[data.callerId].signal(data.signal)
  else{
    var caller = new Peer({initiator: data.signal ? false : true, trickle: false, objectMode: false})
    phonebook[data.callerId] = caller
    //caller.on('stream', stream => {})
    if(data.signal) caller.signal(data.signal)
    caller.on('signal', signal => {
      console.log(signal)
      hub.broadcast(data.callerId, JSON.stringify({signal: signal, callerId: me.id}))
    }) 
    caller.on('close', _ => {})
    caller.on('connect', e => {
      caller.pipe(sink)
      ael.play()
      caller.on('close', e => {
        delete phonebook[data.callerId]
      })
      //var src = new MediaSource()
      //ael.src = URL.createObjectURL( src )
      /*src.onsourceopen = e => {
        var srcBuf = src.addSourceBuffer(mime)
        caller.on('data', e => {
         // console.log(e)
          srcBuf.appendBuffer(toa(e))
        })
      } */
      console.log(`Connected to ${data.callerId}`)
    }) 
  }
}
