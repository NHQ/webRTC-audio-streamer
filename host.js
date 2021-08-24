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

var phonebook = {}
ui.callId.value = ui.callId.innerText = window.location.hash.slice(1)

ui.demo.addEventListener('click', e => {
  e.preventDefault()
  addMedia()
})
addMedia()

function mute(torf){
  micStream.getAudioTracks()[0].enabled = torf
}

function addMedia(id, audio=true, video=false){
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia

  navigator.getUserMedia({video, audio}, function(stream){
    var hub = signalhub(argv.protocol + '://' + argv.host + ':' + argv.port, 'meow')
    var pipe = hub.subscribe(me.id)
    //console.log(stream.getAudioTracks())
    //var micnode = mic(master, stream)
    var initr = false
    ui.callem.onclick = e =>{
      initr = true
      hub.broadcast(ui.callId.value, JSON.stringify({callerId: me.id}))
    } 
    var recr = new MediaRecorder(stream, {mimeType: 'audio/webm', audioBitsPerSecond:40000})
  
    var ael = document.getElementById('xxx')
    var mime = 'audio/webm;codecs=opus'

    pipe.on('error', function(e){console.log(e)})
    pipe.on('data', function(data){
    
      // this needs to go into call waiting...

      //console.log(data.toString())
      //data = data.toString()
      
      data = JSON.parse(data.toString())
      
      // callerID
      var from = data.callerId
      //callers[from] = data // data.message, data.name
      _connect(data)
      //ui.callers.appendChild(h('div.caller', h('button.connect', `Connect to ${data.name || from}`, {onclick: _connect})))  
      
      

      function _connect(data){
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
            var sink = new msrc(ael).createWriteStream(mime)
            caller.pipe(sink)
            ael.play()
            //var src = new MediaSource()
            //ael.src = URL.createObjectURL( src )
            /*src.onsourceopen = e => {
              var srcBuf = src.addSourceBuffer(mime)
              caller.on('data', e => {
               // console.log(e)
                srcBuf.appendBuffer(toa(e))
              })
            } */
            recr.start(20)
            console.log(`Connected to ${data.callerId}`)

            recr.addEventListener('dataavailable', e => {
              //console.log(e)
              btob(e.data, (err, buf) => caller.write(buf))
              //setTimeout(function(){ recr.stop() }, 3000)
            }) 
          }) 
        }
      }
      //console.log(from, data)

    })
    

  }, function(err){
      console.log(err)
  })
}
