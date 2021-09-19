module.exports = function(self){
  self.addEventListener('load', etc => {
    const WebAudioContext = window.AudioContext || window.webkitAudioContext
    var master 
    var Emitter = require('events')//.EventEmitter //require('./sharedEmitter')
    var bus = new Emitter()
    bus.once('iframeLoaded', e => {
      console.log(e)
      bus.emit('pong', {goat: 1})
      bus.on('clock', e => console.log(e))
    })
    //var iframe = require('../iframarfi')
    //var peering = iframe(require('./peering.js'))
    //ui.peering.appendChild(peering)
    var fs = require('fs')
    const short = require('short-uuid');
    const toa = require('to-arraybuffer')
    const btob = require('blob-to-buffer')
    const thru = require('through2')
    var store = require('store')
    var shajs = require('sha.js')
    const Time = require('../since-when')
    var jmic = require('../jsynth-mic/stream')
    var sampler = require('../jsynth-file-sample')
    var media 
    var interval = 1000
    var mime = 'audio/ogg;codecs=opus'
    var runp =require('run-waterfall')
    var {OggOpusDecoder} = require('ogg-opus-decoder')
    var OpusMediaRecorder = require('opus-media-recorder') 
    window.MediaRecorder = OpusMediaRecorder;

    broadcasting = !self.parent.location.hash.length
    var bps = 64000
    try{
    runp([getApp], (err, audio) =>{
      console.log(err, audio)
      self.parent.postMessage({type: 'debug', data: err})
      self.addEventListener('message', msg =>{
      //console.log(msg)
        switch (msg.data.type){
          case 'start':
            
          break;
          case 'resume':
            audio.master.resume()
          break;
          case 'startBroadcast':
            audio.master.resume()
            audio.captureMic((err, mic)=>{
      self.parent.postMessage({type: 'debug', data: err})
      self.parent.postMessage({type: 'debug', data: !!mic})
              let {encoder, node}  = audio.createEncoder('record')
              encoder.start(interval)
            })
            //setTimeout(e => {audio.broadcastencoder.stop()}, 3000)
          break;
          case 'addPeer':
            let {encoder, node} = audio.createEncoder(msg.data.id)
            encoder.start(msg.data.interval || interval)
          break;
          case 'stopBroadcast':
            audio.encoders['record'].stop()
          break;
          case 'callBuffer':
            //console.log(new shajs('sha256').update(msg.data.data).digest('hex'),msg.data.data.length)
          //app._log(new shajs('sha256').update(ab).digest('hex'))
          audio.calldecoder.decode(msg.data.data) 

          //cb(null, audio) 
          break;
          case 'sourceBuffer':
            //console.log(new shajs('sha256').update(msg.data.data).digest('hex'),msg.data.data.length)
          //app._log(new shajs('sha256').update(ab).digest('hex'))
          audio.sourcedecoder.decode(msg.data.data) 

          //cb(null, audio) 
          break;
          
        }
      })
    })} catch(err){
      self.parent.postMessage({type: 'debug', data: err.toString()})
    
    }

      function getApp(cb,broadcasting){

    class App extends require('events').EventEmitter {
    
      constructor(master, broadcasting=true){
        super()
        this.broadcasting = broadcasting
        this.decoders = {}
        this.encoders = {}
        this.master = master
        this.mixer = master.createChannelMerger(12)
        this.callmixer = master.createChannelMerger(2)
        this.monitormix = master.createChannelMerger(12)
        this.monitor = master.createGain()
        this.splitter = master.createChannelSplitter(12)
        this.mic = master.createGain()
        this.call = master.createGain()
        this.track = master.createGain()
        this.source = master.createGain()

        this.mixer.connect(this.splitter)

        this.monitormix.connect(this.monitor)
        this.monitor.connect(master.destination)

        this.mic.connect(this.callmixer)
        this.track.connect(this.callmixer)
        
        this.createDecoder(this.call, ({decoder}) => {
          this.calldecoder = decoder
         })
        this.createDecoder(this.call, ({decoder}) => {
          this.sourcedecoder = decoder
         })
        
        if(broadcasting){
          this.mic.connect(this.mixer)
          this.call.connect(this.mixer)
          this.track.connect(this.mixer)
          this.mic.connect(this.monitormix)
          this.call.connect(this.monitormix)
          this.track.connect(this.monitormix)
        }

        else{
          this.source.connect(this.monitormix)
        }

      }

      captureMic (cb, connect) {
      // TODO source is either the mediastream or a peer connection
        const self = this
        addMedia((err, stream) =>{

          if(err) console.log(err)

          const mic = self.master.createMediaStreamSource(stream) 
          mic.connect(self.mic)

          self.mediastream = stream
          self.micnode = mic
      
          cb(err, stream)
          
        
        })
      }


      createDecoder(connect, cb){
      
        async function wsm(self, connect, cb){

          const decoder = new OggOpusDecoder({onDecode, onDecodeAll})

          function onDecode () {
          }

          function onDecodeAll ({channelData, samplesDecoded, sampleRate}) {
            //console.log(channelData)
            //console.log({samplesDecoded, sampleRate})
            let sam = sampler(self.master, channelData)
            sam.connect(connect)
            sam.start(0)
          }

          await decoder.ready

          let pid = short().generate()

          self.decoders[pid] = {
            decoder: decoder
          }

          if(cb) cb({decoder, pid})
          
        }

        wsm(this, connect, cb)

      }

      createEncoder(id, cb){
        const workerOptions = {
          encoderWorkerFactory: function () {
            return new Worker(tob(fs.readFileSync('./public/static/encoderWorker.umd.js')))
          },
          OggOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/OggOpusEncoder.wasm')),
          WebMOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/WebMOpusEncoder.wasm'))
        };


        let node = this.master.createMediaStreamDestination()
        let encoder = new MediaRecorder(node.stream, {audioBitsPerSecond:bps, mimeType:mime}, workerOptions)
        this.encoders[id] = encoder
        var first = false
        encoder.addEventListener('dataavailable', e => {
          btob(e.data, (err, buf) => {
            //console.log(new shajs('sha256').update(buf).digest('hex'))
            if(buf.length) {
              window.parent.postMessage({
                type: 'broadcastSourceBuffer', 
                data: buf,
                id
              })
            }
          })
        })

        this.splitter.connect(node)

        return {encoder, node}
      }
    }

  var audio = new App(new AudioContext({sampleRate: 48000}), broadcasting)

  cb(null, audio)
  }

  


    function tob(buf, type="application/wasm"){
      return URL.createObjectURL(new Blob([new Buffer(buf).buffer], {type}))
    }
     

    function addMedia(cb, audio=true, video=false){
      var gam = require('getusermedia')
      // Web worker and .wasm configuration. Note: This is NOT a part of W3C standard.
      gam({video, audio}, function(err, stream){
        //console.log(stream.getAudioTracks())


        cb(err, stream)
      })
     }    
     })
}
