navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia
var bus = require('./sharedEmitter')
bus.once('iframeLoaded', e => {
  console.log(e)
  bus.emit('pong', {goat: 1})
  bus.on('clock', e => console.log(e))
})
//var iframe = require('../iframarfi')
//var peering = iframe(require('./peering.js'))
//ui.peering.appendChild(peering)
var fs = require('fs')
var Peer = require('simple-peer')
var signalhub = require('signalhub')
const short = require('short-uuid');
const toa = require('to-arraybuffer')
const btob = require('blob-to-buffer')
//var master = new AudioContext
//var mic = require('../jsynth-mic/stream')
var media 
var ui = require('getids')()
var runp =require('run-waterfall')
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
var mime = 'audio/ogg;codecs=opus'
var phonebook = {}

if(session.id) ui.callId.value = ui.callId.innerText = session.id

console.log(session)
ui.init.onclick = e => {
runp([captureSource, captureSink, captureNetwork].reverse(), (err, state)=>{
  console.log(err, state)
})
}
function captureNetwork(cb) {
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
  console.log('netCap')
  cb(null, {network: {hub: hub}})
}

function captureSource (state, cb) {
  // TODO source is either the mediastream or a peer connection
  var OpusMediaRecorder = require('opus-media-recorder') 
  window.MediaRecorder = OpusMediaRecorder;
  // Web worker and .wasm configuration. Note: This is NOT a part of W3C standard.
  const workerOptions = {
    encoderWorkerFactory: function () {
      // UMD should be used if you don't use a web worker bundler for this.
      return new Worker(tob(fs.readFileSync('./public/encoderWorker.umd.js')))
    },
    OggOpusEncoderWasmPath: tob(fs.readFileSync('./public/OggOpusEncoder.wasm')),
    WebMOpusEncoderWasmPath: tob(fs.readFileSync('./public/WebMOpusEncoder.wasm'))
  };
  addMedia()
  function addMedia(audio=true, video=false){

    navigator.getUserMedia({video, audio}, function(stream){
      //console.log(stream.getAudioTracks())

      recr = new MediaRecorder(stream, {audioBitsPerSecond:64000, mimeType:mime}, workerOptions)
      var bufr = []
      // do same for host monitoring:
      //for(var smith in phonebook) mediaStream.pipe(phonebook[smith]) 
      //ui.monitor.srcObject = stream// = URL.createObjectURL(stream)      
      // Delete the encoder when finished with it (Emscripten does not automatically call C++ object destructors)
      //encoder.delete();
      recr.addEventListener('dataavailable', e => {
        btob(e.data, (err, buf) => {
          bufr.push(new Uint8Array(buf))
          decoder.decode(buf)//.channelData[0])
          for(var smith in phonebook) phonebook[smith].write(buf)
        })
      })

      var sourceState = {
        source: recr,
        buffers: [] // switch to jbuffers
      }
      state.source = sourceState
  console.log('sourceCap')
  
      cb(null, state)
      
      //recr.start(20)
        
      }, function(err){
          cb(err, state)
    })
  }

}

function captureSink(state, cb){
  var {OggOpusDecoder} = require('ogg-opus-decoder')

  async function wsm(log){
  
    const decoder = new OggOpusDecoder({onDecode, onDecodeAll})
    const  master = new AudioContext({sampleRate:48000})

    function onDecode () {
    }

    function onDecodeAll ({channelData, samplesDecoded, sampleRate}) {
      let sam = sampler(master, channelData)
      sam.connect(master.destination)
      sam.start(0)
    }

    await decoder.ready

    var sinkState = {
      sink: decoder,
      context: master
    }

    log()
    state.sink = sinkState
  console.log('sinkCap')
    cb(null, state)
    
  }


  wsm(function(){console.log('WASM')})

}



function tob(buf){
  return URL.createObjectURL(new Blob([new Buffer(buf).buffer], {type: 'application/wasm'}))
}
 
var peers = {}

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
var sampler = require('../jsynth-file-sample')


var connecting = {}
function initBroadcast(){
  // source cap then broadcast
  session.broadcastId = short().generate()
  sessios.distance = 0
  session.maxConnections = 20
  session.offersOut = 0
  // be seekable when..
  seekable(session)
  return session
}

//const Time = require('since-when')
function initListen(id){
  let offerings = hub.subscribe('offer:'+me.id)
  let best = Infinity
  var chosen
  var start = new Time
  offersings.on('data', offer => {
    if(offer.distance < best) {
      best = offer.distance
      chosen = offer
    }
  })
  let t0 = setTimeout(e => {
    if(chosen) {
      hub.unsubscribe('offer:'+me.id)
      // do chosen
    } else {
      
    }
  }, 1111)
  
}

function unseekable(sessions){
  hub.unsubscribe('seek:'+session.broadcastId)
  if(!session.sourceCaptured) {
  }

}

function isSeekWorthy(session){
  let r = session.offersOut > Math.pow(session.distance, 2) * session.maxConnections
  return r && session.maxConnections > session.connections.length && session.sourceCaptured
}

function seekable(session){  
  let ses = hub.subscribe('seek:'+session.broadcastId)
  ses.on('data', msg =>{
    if (!isSeekWorthy(session)) return unseekable()
    else if(Math.random() < 1 / Math.pow(session.distance, 2)) return
    else{
      session.offersOut += 1
      setTimeout(e=>{
        session.offersOut--
        if(!isSeekWorthy(session)) unseekable()
      }, 1111)

      hub.broadcast('offer:'+session.broadcastId, JSON.stringify({
        peerId: me.id,
        to: msg.peerId,
        distance: session.distance
      }))
    }

  })
}

function initConnect(id, init, signal){
  var caller = new Peer({initiator: init, trickle: false, objectMode: false})
  if(signal) caller.signal(signal)
  connecting[id] = caller
  caller._debug = console.log
  caller.on('signal', sig => hub.broadcast(id, JSON.stringify({peerId: me.id, to: id, signal: sig})))
  caller.once('connect', e => {
    phonebook[id] = caller
    connecting[id] = null
    ael.play()
    //ps(tops(caller), tops(sink))
    caller.pipe(sink)
    console.log('connected to ' + id)
  })
  caller.on('close', e => {
    delete phonebook[id]
  })
  caller.on('error', e => console.log(e))
}

function replySignal(msg){
  let peer = connecting[msg.peerId]
  if(!peer) initConnect(msg.peerId, false, msg.signal) 
  else peer.signal(msg.signal)
}


