
require('domready')(re => {
 AudioContext = AudioContext || window.AudioContext || window.webkiAudioContext  
  
  var h = require('hyperscript')
  var ui = require('getids')()
  _log = e =>{
      console.log(e)
      ui.debug.appendChild(h('p', e.toString()))    
  }
  _log('hohoh')
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
  const {makeAutoObservable,  autorun} = require('mobx')
  const short = require('short-uuid');
  const toa = require('to-arraybuffer')
  const btob = require('blob-to-buffer')
  const thru = require('through2')
  var store = require('store')
  var jmic = require('../jsynth-mic/stream')
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

  nana(e => console.log(e))
  window.store = store

  var ael = ui.player
  var mime = 'audio/ogg;codecs=opus'

  ui.init.onclick = e => {
    _log('init')
    try{
    runp([captureSource, captureSink, captureNetwork, initCast].reverse(), (err, state)=>{
      console.log(err, state)
      state.source.source.pipe(state.sink.sink) // heh
      state.network.network.seekable()
    })} catch (err){
      _log(err)
    }
  }

  function initCast(cb){
    master = new AudioContext({sampleRate: 48000})
    const state = {broadcasting: true}
    var uxer = store.get('uxer')
    if(!uxer) {
      uxer = {id: short().generate()}
      store.set('uxer', uxer)
    }
    //ui.myid.innerText = me.id
    state.uxer = uxer
    var session = qs.parse(window.location.search.slice(1))
    if(!session.channel) {
      var pre = store.get('sessionRestore')
      if(!pre) session = {}
      else session = pre
    }
    if(!session.channel) session.channel = short().generate()
    state.session = session
    store.set('sessionRestore', session)
    const monitor = master.createGain()
    monitor.connect(master.destination)
    state.monitor = monitor
    console.log(session)
    ui.monitorRange.addEventListener('change', e => {
      console.log(e.target.value)
      monitor.gain.value = Number(e.target.value)
    })
    master.resume()
    //if(session.id) ui.callId.value = ui.callId.innerText = session.id
    _log('stateInit')
    cb(null, state)
  }
  function captureNetwork(state, cb) {
    var network = new Network(state, argv.protocol + '://' + argv.host + ':' + argv.port)
    _log('netCap')
    state.network = {network: network}

    cb(null, state)
  }

  function captureSource (state, cb) {
    // TODO source is either the mediastream or a peer connection
    
    if(state.broadcasting){
      addMedia((err, stream) =>{
        const workerOptions = {
          encoderWorkerFactory: function () {
            // UMD should be used if you don't use a web worker bundler for this.
            return new Worker(tob(fs.readFileSync('./public/static/encoderWorker.umd.js')))
          },
          OggOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/OggOpusEncoder.wasm')),
          WebMOpusEncoderWasmPath: tob(fs.readFileSync('./public/static/WebMOpusEncoder.wasm'))
        };

        const mic = jmic(master, stream)
        const mixer = master.createChannelMerger(8)

        const restream = master.createMediaStreamDestination()
        mixer.connect(restream)
        mic.connect(mixer, 0, 1)
        const recr = new MediaRecorder(restream.stream, {audioBitsPerSecond:64000, mimeType:mime}, workerOptions)
        mixer.connect(state.monitor)
        state.uxer.mic = stream
        state.uxer.micNode = mic
        var bufr = []
        const strSrc = thru()
        state.network.sourceStream = strSrc
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
        state.source = sourceState
       _log('sourceCap')
    
        cb(err, state)
        
        recr.start(20)
      
      })
    }




  }

  function captureSink(state, cb){
    var {OggOpusDecoder} = require('ogg-opus-decoder')

    async function wsm(log){
    
      const decoder = new OggOpusDecoder({onDecode, onDecodeAll})

      function onDecode () {
      }

      function onDecodeAll ({channelData, samplesDecoded, sampleRate}) {
        let sam = sampler(master, channelData)
        sam.connect(master.destination)
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
      state.sink = sinkState
      _log('sinkCap')
      cb(null, state)
      
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


  class Network { 

    constructor(state, addr){
      const self = this
      //console.log(state, addr)
      this.hub = signalhub(addr, state.session.channel)
      this.state = state
      this.connections = {}
      this.connecting = {}
      this.distance = -1
      this.offerOut = 0
      this.maxConnections = 4 // start low, test high, also helps spread early pcast testing
      this.duration = null // since-when
      this.channels = {}
    }


    log(){
      console.log.apply(this, arguments)
    }

    closePeerSignal(addr){
      this.hub.unsubscribe(addr)
      //delete this.connections[addr]
    }

    openPeer(id){ // callers to this channel (a mask) will get peered
      let pipe = this.hub.subscribe(id)
      pipe.on('error', e => console.log.apply(this, arguments))
      pipe.on('data', function(data){
        data = JSON.parse(data.toString())
        // callerID
        let peer = self.replySignal(data)
        peer.once('connect', e => {
          this.hub.unsubscribe(id)
        })
        //ui.callers.appendChild(h('div.caller', h('button.connect', `Connect to ${data.name || from}`, {onclick: _connect})))  
      })
      //this._seekable()
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
          
        }
      }, 1000)

      this.openPeer(mask)
      this.hub.broadcast('source', 
        JSON.stringify({
          peerId: mask
        })
      )
      
    }
    sourceCap(chosen){
      let peer = this.initConnect(chosen.peerId, true, null)
      peer.once('connect', e => {
        bus.emit('sourcePeerCaptured', peer)
        this.distance = chosen.distance + 1
        this.sourceStream = peer
      })

    }

    set sourceStream(stream){
      this._sourceStream = stream
      stream.pipe(state.sink)//.channelData[0])
      this.duration = new Time()
      for(var n in this.connections) {
        let x= this.connections[n]
        if(x.writable && !(stream == x)){
          stream.pipe(x)
        }
      }
    }

    get sourceStream(){
      return this._sourceStream
    }

    unseekable(session){
      if(sesion) this.hub.unsubscribe(session)
    }

    isSeekWorthy(){
      let r = this.offersOut > Math.pow(this.distance, 2) * this.maxConnections
      this._seekable = r && this.maxConnections > Object.keys(this.connections).length  && this._sourceStream
      return this._seekable
    }

    seekable(){ 
      const self = this
      let ses = this.hub.subscribe('source')
      ses.on('data', msg =>{
        if (!self.isSeekWorthy()) return self.unseekable('source')
        else if(Math.random() < 1 / Math.pow(self.distance, 2)) return
        else{
          self.offersOut += 1
          setTimeout(e=>{
            self.offersOut--
          }, 1111)
          let mask = short().generate()
          self.openPeer(mask)
          self.hub.broadcast(msg.peerId, JSON.stringify({
            peerId: mask,
            to: msg.peerId,
            distance: self.distance,
            duration: self.duration.sinceBeginNS()
          }))
        
        }

      })
    }

    initConnect(id, init, signal){
      var self = this
      var caller = new Peer({initiator: init, trickle: false, objectMode: false})
      if(signal) caller.signal(signal)
      this.connecting[id] = caller
      caller._debug = console.log
      caller.on('signal', sig => this.hub.broadcast(id, JSON.stringify({peerId: self.id, to: id, signal: sig })))
      caller.once('connect', e => {
        this.connections[id] = caller
        this.connecting[id] = null
        if(this.sourceStream) this.sourceStream.pipe(caller)
        console.log('connected to ' + id)
        this.hub.unsubscribe(id)
        if(this.isSeekWorthy()) this.seekable()
      })
      caller.on('close', e => {
        delete this.connections[id]
        if(this.isSeekWorthy()) this.seekable()
      })
      caller.on('error', e => console.log(e))
      return caller
    }

    replySignal(msg){
      var peer = this.connecting[msg.peerId]
      if(!peer) peer = this.initConnect(msg.peerId, false, msg.signal) 
      else peer.signal(msg.signal)
      return peer
    }



  }

  function addMedia(cb, audio=true, video=false){
    var OpusMediaRecorder = require('opus-media-recorder') 
    window.MediaRecorder = OpusMediaRecorder;
    // Web worker and .wasm configuration. Note: This is NOT a part of W3C standard.

    navigator.getUserMedia({video, audio}, function(stream){
      //console.log(stream.getAudioTracks())


      cb(null, stream)
        
      }, function(err){
          cb(err, null)
    })
  }
})
