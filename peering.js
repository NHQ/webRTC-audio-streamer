module.exports = function(self){
document.addEventListener('DOMContentLoaded', function(){
  var bus = require('./sharedEmitter')
  bus.on('pong', e => console.log(e))
  bus.emit('iframeLoaded', {e:true})
  var Peer = require('simple-peer')
  var html = require('choo/html')
  var css = require('sheetify')
  const short = require('short-uuid');
  const msrc = require('mediasource')
  const toa = require('to-arraybuffer')
  const btob = require('blob-to-buffer')
  const cluster = require('webm-cluster-stream')
  const pump = require('pump')
  const mrecr = require('media-recorder-stream')
  var peers = {}

  var ael = html`<audio id=player controls ></audio>`
  var monitor = html`<audio id=monitor controls ></audio>`
  //var monitor = h('audio#monitor')
  //var tertiary = h('audio#teriary')
  var pbj = html`<button id=start>Go Live Now!</button>`
//  document.head.appendChild(appStyle)
  document.body.appendChild(pbj)
  document.body.appendChild(ael)
  document.body.appendChild(monitor)
  pbj.addEventListener('click', e=>{
    console.log(ael)
    //ael.src="http://localhost:11001/audio.wav"
    ael.addEventListener('canplaythrough', e => {
      console.log('okay')
      //ael.play()
        addMedia()
      })
    //ael.play()
  })
  document.body.style.height = "100%"
  document.firstElementChild.style.height = "100%"
  var mime = 'audio/webm;codecs=opus'
  var phonebook = {}
  var sink = new msrc(ael).createWriteStream(mime)
  var monitorSink = new msrc(monitor).createWriteStream(mime)
  var recr 
  var mediaStream


  function mute(torf){
    micStream.getAudioTracks()[0].enabled = torf
  }

  function addMedia(audio=true, video=false){
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia

    navigator.getUserMedia({video, audio}, function(stream){
      //console.log(stream.getAudioTracks())
      micStream = stream
      //recr = new MediaRecorder(stream, {mimeType: mime, audioBitsPerSecond:40000})
      // do same for host monitoring:
      monitor.src = stream
      monitor.play()
      mediaStream = pump(new mrecr(stream,  {mimeType: mime, audioBitsPerSecond:40000, interval:20}), cluster(), e => {
        console.log('stream ended')
      })

      for(var smith in phonebook) mediaStream.pipe(phonebook[smith]) 
      //btob(e.data, (err, buf) => phonebook[smith].write(buf))
     /*
      recr.addEventListener('dataavailable', e => {
        //console.log(e)
        for(var smith in phonebook) btob(e.data, (err, buf) => phonebook[smith].write(buf))
        //setTimeout(function(){ recr.stop() }, 3000)
      })
  */
      recr.start(20)
      //ael.play()
      
      
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
        if(mediaStream) mediaStream.pipe(caller)
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


})
}
