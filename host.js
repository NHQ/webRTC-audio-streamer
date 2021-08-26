var media 
var ui = require('getids')()

var bus = require('./sharedEmitter')
bus.once('iframeLoaded', e => {
  console.log(e)
  bus.emit('pong', {goat: 1})
  bus.on('clock', e => console.log(e))
})
//var iframe = require('../iframarfi')
//var peering = iframe(require('./peering.js'))
//ui.peering.appendChild(peering)
var Peer = require('simple-peer')
var h = require('hyperscript')
var signalhub = require('signalhub')
const short = require('short-uuid');
const msrc = require('mediasource')
const toa = require('to-arraybuffer')
const btob = require('blob-to-buffer')
const cluster = require('webm-cluster-stream')
const pump = require('pump')
const mrecr = require('media-recorder-stream')
//var master = new AudioContext
//var mic = require('../jsynth-mic/stream')

var ps = require('pull-stream')
var tops = require('stream-to-pull-stream')
var peers = {}
var qs = require('querystring')
var minimist = require('minimist')
var argv = minimist(process.argv, {
  default: {
    host: 'folkstack.com',
    port: 80,
    protocol: 'https'
  }
})
var store = require('store')
    var me = store.get('myself')
    if(!me) me = {id: short().generate()}
    store.set('myself', me)
    ui.myid.innerText = me.id

//console.log(argv)
var session = qs.parse(window.location.search.slice(1))

var ael = ui.player
var mime = 'audio/webm;codecs=opus'
var phonebook = {}

if(session.id) ui.callId.value = ui.callId.innerText = session.id
var hub = signalhub(argv.protocol + '://' + argv.host + ':' + argv.port, 'meow')
var pipe = hub.subscribe(me.id)
pipe.on('error', function(e){console.log(e)})
pipe.on('data', function(data){
  // this needs to go into call waiting...
  data = JSON.parse(data.toString())
  console.log(data)
  // callerID
  replySignal(data)
  //ui.callers.appendChild(h('div.caller', h('button.connect', `Connect to ${data.name || from}`, {onclick: _connect})))  
})

console.log(session)
if(session.call) {
///  hub.broadcast(session.id, JSON.stringify({callerId: me.id}))
}
var sink = new msrc(ael).createWriteStream(mime)
//var monitor = new msrc(ui.monitor).createWriteStream(mime)
var recr 
var mediaStream

ui.callem.onclick = e =>{
    if(ui.callId.value){
      initConnect(ui.callId.value, true, null)
      //hub.broadcast(ui.callId.value, JSON.stringify({callerId: me.id}))
    }
} 

ui.addMic.onclick = e => addMedia()

function mute(torf){
  micStream.getAudioTracks()[0].enabled = torf
}

function addMedia(id, audio=true, video=false){
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia

  navigator.getUserMedia({video, audio}, function(stream){
    //console.log(stream.getAudioTracks())
    recr = new MediaRecorder(stream, {mimeType: mime, audioBitsPerSecond:40000})
    // do same for host monitoring:
//    ael.srcObj = stream
 // mediaStream = pump(new mrecr(stream,  {mimeType: mime, audioBitsPerSecond:40000, interval:20}), cluster(), e => {
  //    console.log('stream ended')
   // })

 // mediaStream.pipe(sink)
 // ael.play()
    //for(var smith in phonebook) mediaStream.pipe(phonebook[smith]) 
    //btob(e.data, (err, buf) => phonebook[smith].write(buf))
    //ui.monitor.srcObject = stream// = URL.createObjectURL(stream)      
     
    recr.addEventListener('dataavailable', e => {
      //console.log(e)

      btob(e.data, (err, buf) => {
        //monitor.write(buf)
        for(var smith in phonebook) phonebook[smith].write(buf)
      })
      //setTimeout(function(){ recr.stop() }, 3000)
    })

    recr.start(20)
    //ael.play()
    
    
  }, function(err){
      console.log(err)
  })
}

var connecting = {}

function initConnect(id, init, signal){
  var caller = new Peer({initiator: init, trickle: false, objectMode: false})
  if(signal) caller.signal(signal)
  connecting[id] = caller
  caller._debug = function(str){
    ui.debug.appendChild(h('p', str))
  }
  caller.on('signal', sig => hub.broadcast(id, JSON.stringify({peerId: me.id, to: id, signal: sig})))
  caller.on('connect', e => {
    phonebook[id] = caller
    connecting[id] = null
    console.log('connected to ' + id)
  })
}

function replySignal(msg){
  let peer = connecting[mes.peerId]
  if(!peer) initConnect(msg.peerId, false, msg.signal) 
  else peer.signal(msg.signal)
}


function _connect(data, init){
  console.log(data)
  if(phonebook[data.from]) phonebook[data.from].signal(data.signal)
  else{
    var caller = new Peer({initiator: init, trickle: false, objectMode: false})
    caller._debug = console.log
    //caller.on('stream', stream => {})
    if(data.signal) caller.signal(data.signal)
    caller.on('error',e=> console.log(e))
    caller.on('signal', signal => {
      console.log(signal)
      //if (signal.renegotiate || signal.transceiverRequest) return
      hub.broadcast(data.from, JSON.stringify({signal: signal, from: me.id}))
    }) 
    caller.on('close', _ => {})
    caller.on('connect', e => {
      phonebook[data.callerId] = caller
      //ps(tops(caller), tops(sink))
      //caller.pipe(sink)
      //ael.play()
      caller.on('data', e => { if(Math.random < .1) console.log('data', e)} )
      caller.on('close', e => {
        delete phonebook[data.callerId]
      })
//      if(mediaStream) mediaStream.pipe(caller)
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
