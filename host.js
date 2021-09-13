
require('domready')(re => {
  const WebAudioContext = window.AudioContext || window.webkitAudioContext
  var master 
  var h = require('hyperscript')
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
  var fs = require('fs')
  var Peer = require('simple-peer')
  var signalhub = require('signalhub')
  const {makeAutoObservable,  autorun} = require('mobx')
  const short = require('short-uuid');
  const toa = require('to-arraybuffer')
  const btob = require('blob-to-buffer')
  const thru = require('through2')
  var store = require('store')
  const Time = require('../since-when')
  var jmic = require('../jsynth-mic/stream')
  var sampler = require('../jsynth-file-sample')
  var media 
  var runp =require('run-waterfall')
  var qs = require('querystring')
  var nana = require('nanohref')
  var minimist = require('minimist')
  var argv = minimist(process.argv, {
    default: {
      host: 'folkstack.com',
      port: 80,
      protocol: 'https'
    }
  })
  var debub = signalhub('https://folkstack.com:80', 'debug')
  //var ret=debub.subscribe('return')

  var app 
  _log = e =>{
      console.log(e)
      ui.debug.appendChild(h('p', e.toString()))    
      debub.broadcast('debug', JSON.stringify(e))
  }

  window.store = store

  runp([initState, initUI], (err, app)=>{
    app = app

    ui.init.addEventListener('change', e => {
      _log('init')

      try{
        runp([captureSource, captureSink, captureNetwork, initAudio, initCast(app)].reverse(), (err, app)=>{
          console.log(err, app)
     //     app.audio.sourceStream.pipe(app.audio.sinkStream) // heh
          if(app.session.broadcasting) {
            app.network.sourceStream = app.audio.sourceStream
            app.network.distance = 1
            app.network.seekable()
          
          }
          else app.network.sourceSeek()
      })} catch (err){
        _log(err)
      }
    })
    
  })

  var ael = ui.player
  var mime = 'audio/ogg;codecs=opus'


  function initState(cb){

    class App {
    
      constructor(){
        this.mic = 1/2
        this.monitor = 1/2
        this.call = 1/2
        this.track = 1/2
        this.quality = 64000
        this.update = null
        makeAutoObservable(this)
      }

      setGain(dial, value){
        this[dial] = value
        this.update = [dial, value]
      }
    
    }

    const app = new App
    bus.on('appStateChange', e =>{
      app.setGain(e[0], e[1])
    })
    var session = store.get('session')
    if(!session) session = {id: short().generate().split().reverse().join().slice(0,11)}
    session.broadcasting = true
    var q = qs.parse(window.location.search.slice(1))
    if(q.stream) {
      session.stream = q.stream
      session.broadcasting = false 
    }
    else {
      session.stream = session.stream || short().generate().split().reverse().join().slice(0,11)
    }

    app.session = session
    store.set('session', session)
    console.log(app)
    cb(null, app)
  }

  function initAudio(app, cb){
    const audio = {}
    master = new WebAudioContext({sampleRate: 48000})
    audio.master = master
    audio.mixer = master.createChannelMerger(2)
    audio.restream = master.createMediaStreamDestination()
    audio.monitor = master.createGain()
    audio.mic = master.createGain()
    audio.call = master.createGain()
    audio.track = master.createGain()


    audio.mixer.connect(audio.restream)
    audio.mixer.connect(audio.monitor)

    audio.monitor.connect(master.destination)
    audio.mic.connect(audio.mixer)
    audio.call.connect(audio.mixer)
    audio.track.connect(audio.mixer)

    autorun(()=>{
      if(app.update) {
        audio[app.update[0]].gain.value = Math.max(0, app.update[1])//.monitor
      } 
    })

    app.audio = audio
    master.resume()
    cb(null, app)
  }

  function initUI(app, cb){

    ui.livelink.innerText = 'https://gabr.vercel.app?stream='+app.session.stream
    ui.copybutton.onchange = e => {
      navigator.clipboard.writeText(ui.link.innerText)
    }

    ui.file.addEventListener('change', e => {
      console.log(e.target.files[0])
      var a = h('audio.invert', {controls: true, src : URL.createObjectURL(e.target.files[0])})
      ui.tracks.appendChild(a)
      var c= app.audio.master.createMediaElementSource(a)
      console.log(a)
      c.connect(app.audio.track)
      btob(e.target.files[0], (err, buf) => {
        sampler(app.audio.master, buf.buffer, (err, node) =>{
          //node.connect(app.audio.master.destination)
          //node.start(0)
        })      
      })
    })

    ;[].forEach.call(document.querySelectorAll('input[type=range]'), e => {
      e.addEventListener('input', ev => {
        bus.emit('appStateChange', [ev.target.name, Number(ev.target.value)])
      })
    })

    ;[].forEach.call(document.querySelectorAll('[data-mute]'), e => {
      e.addEventListener('change', ev => {
        bus.emit('appStateChange', [ev.target.dataset.mute, - app[ev.target.dataset.mute]])
      })
    })


    ui.monitorRange.addEventListener('change', e => {
      console.log(e.target.value)
      //bus.emit('appStateChange', ['monitor', Number(e.target.value)])
      //app.setGain('monitor', Number(e.target.value))
    })

    cb(null,app)

  }


  function initCast(app){
  
    return function(cb){
      _log('stateInit')
      cb(null, app)
    
    }
  }
  function captureNetwork(app, cb) {
    var network = new Network(app, argv.protocol + '://' + argv.host + ':' + argv.port)
    _log('netCap')
    app.network = network

    cb(null, app)
  }

  function captureSource (app, cb) {
    // TODO source is either the mediastream or a peer connection
    
    if(true || app.session.broadcasting){
      addMedia((err, stream) =>{
        _log(`mediaStream added? ${(!!stream)}`)
        _log(`mediaStream error? ${(err)}`)

        console.log(err)
        const workerOptions = {
          encoderWorkerFactory: function () {
            // UMD should be used if you don't use a web worker bundler for this.
            return new Worker(tob(fs.readFileSync('./public/static/encoderWorker.umd.js')))
          },
          OggOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/OggOpusEncoder.wasm')),
          WebMOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/WebMOpusEncoder.wasm'))
        };
        console.log(stream)

        const mic = app.audio.master.createMediaStreamSource(stream) 
        const mixer = app.audio.mixer 
        const restream = app.audio.restream 
        
        
        mic.connect(app.audio.mic)
        const recr = new MediaRecorder(restream.stream, {audioBitsPerSecond:64000, mimeType:mime}, workerOptions)
        _log(`mediaRecorder added? ${(!!recr)}`)
        app.audio.mediastream = stream
        app.audio.micnode = mic
        var bufr = []
        app.audio.buffer = bufr
        const strSrc = thru()
        app.audio.sourceStream = strSrc
        // do same for host monitoring:
        //for(var smith in phonebook) mediaStream.pipe(phonebook[smith]) 
        //ui.monitor.srcObject = stream// = URL.createObjectURL(stream)      
        // Delete the encoder when finished with it (Emscripten does not automatically call C++ object destructors)
        //encoder.delete();
        recr.addEventListener('dataavailable', e => {
          btob(e.data, (err, buf) => {
            bufr.push(new Uint8Array(buf))
            strSrc.write(buf)
            //for(var smith in state.network.phonebook) state.network.phonebook[smith].write(buf)
          })
        })

        var sourceState = {
          source: strSrc,
          buffers: bufr // switch to jbuffers
        }

       _log('sourceCap')
    
        recr.start(20)
        cb(err, app)
        
      
      })
    }




  }

  function captureSink(app, cb){
    var {OggOpusDecoder} = require('ogg-opus-decoder')

    async function wsm(log){
    
      const decoder = new OggOpusDecoder({onDecode, onDecodeAll})

      function onDecode () {
      }

      function onDecodeAll ({channelData, samplesDecoded, sampleRate}) {
        let sam = sampler(app.audio.master, channelData)
        sam.connect(app.audio.master.destination)
        sam.start(0)
      }

      await decoder.ready

      const sinkStream = thru((buf, enc, cb) => {
        decoder.decode(buf)
        cb()
      }, e =>{})

      var sinkState = {
        sink: sinkStream,
      }

      log()
      app.audio.sinkStream = sinkStream
      _log('sinkCap')
      cb(null, app)
      
    }


    wsm(function(){console.log('WASM')})

  }



  function tob(buf){
    return URL.createObjectURL(new Blob([new Buffer(buf).buffer], {type: 'application/wasm'}))
  }
   
  var peers = {}

  //ui.addMic.onclick = e => addMedia()

  function mute(torf){
    micStream.getAudioTracks()[0].enabled = torf
  }


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



  class Network { 

    constructor(app, addr){
      const self = this
      //console.log(state, addr)
      this.hub = signalhub(addr, app.session.stream)
      this.channel = app.session.stream
      this.id = app.session.id
      this.state = app.state
      this.connections = {}
      this.connecting = {}
      this.distance = -1
      this.offersOut = 0
      this.maxConnections = 4 // start low, test high, also helps spread early pcast testing
      this.duration = null // since-when
      this.channels = {}
      this.sinkStream = thru(buf => {
        for(var n in this.peers){
          let p = this.peers[n]
          if(p.writable) p.write(buf)
        }
      }, function close(){})
    }


    log(){
      console.log.apply(this, arguments)
    }

    closePeerSignal(addr){
      this.hub.unsubscribe(addr)
      //delete this.connections[addr]
    }

    disallowCalls(){
      this.hub.unsubscribe('caller:'+this.id)
    }

    allowCalls(){
      let calls = this.hub.subscribe('caller:'+this.id)
      calls.on('data', msg=>{
        msg=JSON.parse(msg)
        bus.emit('caller', msg)
      })
      bus.on('call', msg =>{
        this.callDirect(msg.peerId)
      })

    }

    initCall(id){
      
      this.hub.broadcast('caller:'+id, {peerId: this.id})
      let peer = this.initConnect(id, false, this.id)
      peer.once('connected', e =>{
        this.callers[id] = peer
        bus.emit('Call Source Captured', peer)

      })
      
      
    }

    callDirect(id){
      let peer = this.initConnect(id, true, this.id)
      peer.once('connected', e =>{
        this.callers[id] = peer
        bus.emit('Call Source Captured', peer)

      })
    }

    sourceSeek(){ // id for a peer stream
      var self = this 
      let mask = short().generate()
      let offerings = this.hub.subscribe(mask)
      let best = 0//Infinity
      var chosen
      var start = new Time
      offersings.on('data', offer => {
        let score = (1 / offer.distance) * offer.duration
        if(score > best) {
          best = score //offer.distance
          chosen = offer
        }
      })
      let t0 = setTimeout(e => {
        if(chosen) {
          this.hub.unsubscribe(mask)
          // do chosen
          bus.emit('sourcePeerIdCaptured', chosen.peerId)
          self.sourceCap(chosen)
        } else {
          _log('Err: No source peer found.')    
        }
      }, 1000)
      
      let peer = this.initConnect(chosen.peerId, true, mask)
      peer.once('connect', e => {
        bus.emit('sourcePeerCaptured', peer)
        this.distance = chosen.distance + 1
        this.sourceStream = peer
        _log('Source Peer Captured.')

      })
      peer.on('close', e => {
        _log('Source Peer Closed')

      })

      this.hub.broadcast('source', 
        JSON.stringify({
          peerId: mask
        })
      )
      
    }

    set sourceStream(stream){
      this._sourceStream = stream
      this.duration = new Time()
      stream.pipe(this.sinkStream)
    }

    get sourceStream(){
      return this._sourceStream
    }

    unseekable(session){
      if(sesion) this.hub.unsubscribe(session)
    }

    isSeekWorthy(){
      let r = this.offersOut < Math.pow(this.distance, 2) * this.maxConnections
      this._seekable = r && this.maxConnections > Object.keys(this.connections).length  && this.sourceStream
      return this._seekable
    }

    seekable(){ 
      const self = this
      let ses = this.hub.subscribe('source')
      _log(`Seekable? ${this.isSeekWorthy()}`)
      ses.on('data', msg =>{
        if (!self.isSeekWorthy()) return self.unseekable('source')
        else if(Math.random() < 1 / Math.pow(self.distance, 2)) return
        else{
          self.offersOut += 1
          setTimeout(e=>{
            self.offersOut--
            self.disinitConnect(msg.peerId, mask)
          }, 1111)
          let mask = short().generate()
          let peer = self.init(msg.peerId, false, mask)
          peer.once('connect', e =>{
            this.peers[msg.peerId] = peer
          })
          peer.once('close', e =>{
            delete this.peers[msg.peerId]
          })
          self.hub.broadcast(msg.peerId, JSON.stringify({
            peerId: mask,
            to: msg.peerId,
            distance: self.distance,
            duration: self.duration.sinceBeginNS()
          }))
        
        }
      })
    }

    disinitConnect(id, mask){
      delete this.connecting[id]
      this.hub.unsubscribe(mask)
    }

    initConnect(id, init, mask){
      var self = this
      let pipe = this.hub.subscribe(mask)
      var caller = new Peer({initiator: init, trickle: false, objectMode: false})
      this.connecting[id] = caller
      pipe.on('error', e => console.log.apply(this, arguments))
      pipe.on('data', function(data){
        data = JSON.parse(data.toString())
        // callerID
        var peer = this.connecting[msg.peerId]
        peer.signal(msg.signal)
        peer.once('connect', e => {
          this.hub.unsubscribe(mask)
        })
        //ui.callers.appendChild(h('div.caller', h('button.connect', `Connect to ${data.name || from}`, {onclick: _connect})))  
      })
      caller._debug = console.log
      caller.on('signal', sig => this.hub.broadcast(id, JSON.stringify({peerId: mask, to: id, signal: sig })))
      caller.once('connect', e => {
        this.connections[id] = caller
        this.connecting[id] = null
        console.log(`connected to ${Object.keys(this.connections).length} peers`)
      })
      caller.on('close', e => {
        this.disinitConnect(id, mask)
      })
      caller.on('error', e => console.log(e))
      return caller
    }

  }

  function addMedia(cb, audio=true, video=false){
    var OpusMediaRecorder = require('opus-media-recorder') 
    var gam = require('getusermedia')
    window.MediaRecorder = OpusMediaRecorder;
    // Web worker and .wasm configuration. Note: This is NOT a part of W3C standard.
    _log(`getUserMedia? ${!!gam}`)
    gam({video, audio}, function(err, stream){
      //console.log(stream.getAudioTracks())


      cb(err, stream)
    })
   }    
})
