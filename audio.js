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
    var mime = 'audio/ogg;codecs=opus'
    var runp =require('run-waterfall')
    var OpusMediaRecorder = require('opus-media-recorder') 
    window.MediaRecorder = OpusMediaRecorder;


    var bps = 64000
    runp([initAudio, captureSink, captureSource], (err, audio) =>{
      console.log(err, audio)
      //self.parent.postMessage({type: 'debug', data: 'help'})
      self.addEventListener('message', msg =>{
      //console.log(msg)
        switch (msg.data.type){
          case 'startBroadcast':
            audio.master.resume()
            audio.broadcastencoder.start(1000)
            //setTimeout(e => {audio.broadcastencoder.stop()}, 3000)
          break;
          case 'stopBroadcast':
            audio.broadcastencoder.stop()
          break;
          case 'sinkBuffer':
            console.log(new shajs('sha256').update(msg.data.data).digest('hex'),msg.data.data.length)
            
            audio.decoder.decode(msg.data.data)
          break;
        }
      })
    })

    function initAudio(cb){
      var audio = {}
      master = new WebAudioContext({sampleRate: 48000})
      audio.master = master
      audio.broadcastmixer = master.createChannelMerger(2)
      audio.callmixer = master.createChannelMerger(2)
      audio.broadcaststream = master.createMediaStreamDestination()
      audio.callstream = master.createMediaStreamDestination()
      audio.monitor = master.createGain()
      audio.mic = master.createGain()
      audio.call = master.createGain()
      audio.trackmixer = master.createChannelMerger(2)
      audio.track = master.createGain()
      audio.trackmixer.connect(audio.track)

      audio.broadcastmixer.connect(audio.broadcaststream)
      //audio.broadcastmixer.connect(audio.monitor)

      audio.callmixer.connect(audio.callstream)
      //audio.callmixer.connect(audio.monitor)


      //audio.mic.connect(audio.monitor)
      audio.call.connect(audio.monitor)
      //audio.track.connect(audio.monitor)
      audio.monitor.connect(master.destination)

      audio.mic.connect(audio.broadcastmixer)
      //audio.track.connect(audio.broadcastmixer)
      //audio.call.connect(audio.broadcastmixer)

      //audio.mic.connect(audio.callmixer)
      //audio.track.connect(audio.callmixer)

      audio.broadcastmixer.connect(audio.broadcaststream)
      audio.callmixer.connect(audio.callstream)
      
      const workerOptions = {
        encoderWorkerFactory: function () {
          // UMD should be used if you don't use a web worker bundler for this.
          return new Worker(tob(fs.readFileSync('./public/static/encoderWorker.umd.js')))
        },
        OggOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/OggOpusEncoder.wasm')),
        WebMOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/WebMOpusEncoder.wasm'))
      };

      audio.broadcastencoder = new MediaRecorder(audio.broadcaststream.stream, {audioBitsPerSecond:bps, mimeType:mime}, workerOptions)
      audio.callencoder = new MediaRecorder(audio.callstream.stream, {audioBitsPerSecond:bps, mimeType:mime}, workerOptions)
      audio.broadcastencoder.addEventListener('dataavailable', e => {
        btob(e.data, (err, buf) => {
            console.log(new shajs('sha256').update(buf).digest('hex'))
            window.parent.postMessage({
              type: 'broadcastSourceBuffer', 
              data: buf
            })
            audio.decoder.decode(buf)
            //let chub = Buffer.from(buf).toString('base64')
   //         console.log(chub)

        })

      })

      audio.callencoder.addEventListener('dataavailable', e => {
        btob(e.data, (err, buf) => {
        })
      })

      
      //audio.broadcastencoder.start(1000)

      audio = audio
      master.resume()
      cb(null, audio)
    }


    function captureSource (audio, cb) {
      // TODO source is either the mediastream or a peer connection
      
        addMedia((err, stream) =>{

          console.log(err)
          console.log(stream)

          const mic = audio.master.createMediaStreamSource(stream) 
          mic.connect(audio.mic)

          audio.mediastream = stream
          audio.micnode = mic
      
          cb(err, audio)
          
        
        })
      }

    function captureSink(audio, cb){
      var {OggOpusDecoder} = require('ogg-opus-decoder')

      async function wsm(log){
      
        const decoder = new OggOpusDecoder({onDecode, onDecodeAll})

        function onDecode () {
        }

        function onDecodeAll ({channelData, samplesDecoded, sampleRate}) {
          //console.log(channelData)
          console.log({samplesDecoded, sampleRate})
          let sam = sampler(audio.master, channelData)
          sam.connect(audio.call)
          sam.start(0)
        }

        await decoder.ready

        log(decoder)
            console.log('WASM')
        
      }

      wsm(decoder => {
          //let ab = new Uint8Array(Buffer.from(buf).buffer)
          //app._log(new shajs('sha256').update(ab).digest('hex'))
          audio.decoder = decoder 
          cb(null, audio) 
       
        })
         

      

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
