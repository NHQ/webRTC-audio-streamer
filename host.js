
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

  window.store = store
  if(!store.get('reset')) {
     
    store.clearAll();
    store.set('reset', true)
  }
  runp([initState, initUI], (err, app)=>{
    app = app

    ui.init.addEventListener('change', e => {
      app._log('init')

      try{
        runp([captureSource, captureSink, captureNetwork, initAudio, initCast(app)].reverse(), (err, app)=>{
          console.log(err, app)
          //app.audio.sourceStream.pipe(app.audio.sinkStream) // heh
          if(app.session.broadcasting) {
            app.network.distance = 1
//            app.network.sourceStream = app.audio.sourceStream
            app.network.isSeekWorthy()
            app.network.allowCalls(app.session.stream)
          
          }
          else app.network.sourceSeek()
      })} catch (err){
        app._log(err)
      }
    })
    
  })

  var ael = ui.player
  var mime = 'audio/ogg;codecs=opus'


  function initState(cb){

    class App {
    
      constructor(){
        this.mic = 1/2
        this.monitor = 0
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
    let hash = window.location.hash.slice(1)
    var session = store.get('session')
    if(!session) {
      session = {id: short().generate().split().reverse().join().slice(0,11)}
    }
    session.broadcasting = false
    if(hash.length){
      session.stream = hash //short().generate().split().reverse().join().slice(0,11)
      session.broadcasting = false
    }
    else session.stream = session.id //short().generate().split().reverse().join().slice(0,11)

    app.session = session
  app._log = function(_id) { return e => {
      //ui.debug.appendChild(h('p', e.toString()))    
      debub.broadcast('debug', JSON.stringify({id: _id, log: e}))
  } }(session.id)
    store.set('session', session)
    console.log(app)
    cb(null, app)
  }

  function initAudio(app, cb){
    const audio = {}
    var OpusMediaRecorder = require('opus-media-recorder') 
    window.MediaRecorder = OpusMediaRecorder;
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

    audio.broadcastencoder = new MediaRecorder(audio.broadcaststream.stream, {audioBitsPerSecond:40000, mimeType:mime}, workerOptions)
    audio.callencoder = new MediaRecorder(audio.callstream.stream, {audioBitsPerSecond:40000, mimeType:mime}, workerOptions)
console.log(app)
    audio.broadcastencoder.addEventListener('dataavailable', e => {
      btob(e.data, (err, buf) => {
      //if(app.session.broadcasting) app._log(buf.length)
        //bufr.push(new Uint8Array(buf))
        //app.audio.decoder.decode(buf)     
        app.network.broadcast(buf)
        //strSrc.write(buf)
      })

    })

    audio.callencoder.addEventListener('dataavailable', e => {
      btob(e.data, (err, buf) => {
        //bufr.push(new Uint8Array(buf))
        //app.audio.decoder.decode(buf)     
        //app.network.send(buf)
        //strSrc.write(buf)
      })
    })

    
    audio.broadcastencoder.start(20)

    autorun(()=>{
      if(app.update) {
        audio[app.update[0]].gain.value = Math.max(0, app.update[1])//.monitor
      } 
    })

    app._log(`mediaRecorder added? ${(!!audio.broadcastencoder)}`)

    app.audio = audio
    master.resume()
    cb(null, app)
  }

  function initUI(app, cb){

    ui.livelink.innerText = `https://gabr.vercel.app/#${app.session.stream}`
    ui.copybutton.onchange = e => {
      navigator.clipboard.writeText(ui.link.innerText)
    }
    ui.request.addEventListener('change', e => {
      app.network.initCall(app.session.stream)
    })
    ui.file.addEventListener('change', e => {
      console.log(e.target.files[0])
      var a = h('audio.invert', {controls: true, src : URL.createObjectURL(e.target.files[0])})
      ui.tracks.appendChild(a)
      var c= app.audio.master.createMediaElementSource(a)
      console.log(a)
      c.connect(app.audio.trackmixer)
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
      app._log('stateInit')
      cb(null, app)
    
    }
  }
  function captureNetwork(app, cb) {
    var network = new Network(app, argv.protocol + '://' + argv.host + ':' + argv.port)
    app._log('netCap')
    app.network = network

    cb(null, app)
  }

  function captureSource (app, cb) {
    // TODO source is either the mediastream or a peer connection
    
    if(true || app.session.broadcasting){
      addMedia((err, stream) =>{
        app._log(`mediaStream added? ${(!!stream)}`)
        app._log(`mediaStream error? ${(err)}`)

        console.log(err)
        console.log(stream)

        const mic = app.audio.master.createMediaStreamSource(stream) 
        mic.connect(app.audio.mic)

        app.audio.mediastream = stream
        app.audio.micnode = mic
    
        /*
        var bufr = []
        app.audio.buffer = bufr
        const strSrc = thru((b, r, cb)=>{
            console.log('source', b)
          cb(null, b)
        },e=>{
          console.log(e)
        } )
        app.audio.sourceStream = strSrc
        */
        // do same for host monitoring:
        //for(var smith in phonebook) mediaStream.pipe(phonebook[smith]) 
        //ui.monitor.srcObject = stream// = URL.createObjectURL(stream)      
        // Delete the encoder when finished with it (Emscripten does not automatically call C++ object destructors)
        //encoder.delete();
       app._log('sourceCap')
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
        //console.log(channelData)
        app._log({samplesDecoded, sampleRate})
        let sam = sampler(app.audio.master, channelData)
        sam.connect(app.audio.call)
        sam.start(0)
      }

      await decoder.ready

      log(decoder)
          console.log('WASM')
      
    }

    wsm(decoder => {
      app.audio.decoder = decoder
    bus.on("sourcePeerCaptured", id => {
          app._log('sinkCap')
      //    app.audio.decoder = decoder
          let peer = app.network.connections[id]
          peer.on('data', buf => {
            buf = new Uint8Array(buf.buffer)
        //    app._log(buf.length)
            try{
              decoder.ready.then(() => decoder.decode(buf), err => {
                app._log(err.toString())
              })
            } catch(err){
                app._log(err.toString())
              
            }
          })
      })


      cb(null, app)
       
    })

    

  }



  function tob(buf, type="application/wasm"){
    return URL.createObjectURL(new Blob([new Buffer(buf).buffer], {type}))
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
      this.app = app
      this.hub = signalhub(addr, app.session.stream)
      this.channel = app.session.stream
      this.id = app.session.id
      this.state = app.state
      this.connections = {}
      this.hubs = {} 
      this.peers = {}
      this.callers = {}
      this.connecting = {}
      this.distance = 1
      this.offersOut = 0
      this.maxConnections = 4 // start low, test high, also helps spread early pcast testing
      this.duration = null // since-when
      this.channels = {}
      this.duration = new Time
      this.sinkStream = thru(buf => {
        for(var n in this.peers){
          let p = this.peers[n]
          if(p.writable) p.write(buf)
        }
      }, function close(){})
    }

    broadcast(buf){
      for(var n in this.peers) this.peers[n].write(buf)
    }

    send(buf){
      for(var n in this.callers) this.callers[n].write(buf)
    }

    log(){
      console.log.apply(this, arguments)
    }

    closePeerSignal(addr){
      this.hub.unsubscribe(addr)
      //delete this.connections[addr]
    }

    disallowCalls(id){
      this.hub.unsubscribe('caller:'+id)
    }

    allowCalls(id){
      let calls = this.hub.subscribe('caller:'+id)
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
      var best = 0//Infinity
      var chosen
      var start = new Time
      offerings.on('data', offer => {
        offer = JSON.parse(offer)
        self.app._log(offer)
        let score = (1 / offer.distance) * offer.duration
        if(score > best) {
          best = score //offer.distance
          chosen = offer
        }
      console.log(chosen)
      })
      let t0 = setTimeout(e => {
      console.log(chosen)
        if(chosen) {
    //      this.hub.unsubscribe(mask)
          // do chosen
          bus.emit('sourcePeerIdCaptured', chosen.peerId)
          //self.sourceCap(chosen)
          let peer = this.initConnect(chosen.peerId, true, mask)
          peer.once('connect', e => {
            bus.emit('sourcePeerCaptured', chosen.peerId)
            this.distance = chosen.distance + 1
            this.sourceStream = peer
            self.app._log('Source Peer Captured.')

          })
          peer.on('close', e => {
            self.app._log('Source Peer Closed')

          })
        } else {
          self.app._log('Err: No source peer found.')    
        }
      }, 13000)
      

      this.hub.broadcast('source', 
        JSON.stringify({
          peerId: mask
        })
      )
      
    }

    set sourceStream(stream){
      this._sourceStream = stream
      this.duration = new Time()
      //stream.pipe(this.sinkStream)
      //stream.pipe(app.audio.sinkStream)
    }

    get sourceStream(){
      return this._sourceStream
    }

    unseekable(session){
      if(sesion) this.hub.unsubscribe(session)
    }

    isSeekWorthy(){
      let r = this.offersOut < this.maxConnections
      let s = this.maxConnections > Object.keys(this.connections).length  
      let q = r && s 
      this._seekable = q
      if(q) {
        this.sourcer = this.hub.subscribe('source')
        this.sourcer.on('data', msg => this.seekable(JSON.parse(msg)))
      }
      else {
        if(this.sourcer) this.sourcer.close()
        
      }
      return this._seekable
    }

    setsub(id){
      if(this.hubs[id]) return this.hubs[id]
      else this.hubs[id] = this.hub.subscribe(id)
    }
    getsub(id){
      return this.hubs[id]
    }

    unsub(id){
      if(this.hubs[id]) {
        this.hub.unsubscribe(id) 
        delete this.hubs[id] 
      }
    }

    seekable(msg){ 
    this.app._log(msg)
      let self = this
      if(false) return // || Math.random() < 1 / Math.pow(self.distance, 2)) return
      else{
        self.offersOut += 1
        setTimeout(e=>{
          this.offersOut--
          //this.disnit(msg.peerId, mask)
        }, 1111*3)
        let mask = short().generate()
        let peer = this.initConnect(msg.peerId, false, mask)
        peer.once('connect', e =>{
          self.peers[msg.peerId] = peer
        })
        peer.once('close', e =>{
          delete self.peers[msg.peerId]
          self.isSeekWorthy()
        })
        this.hub.broadcast(msg.peerId, JSON.stringify({
          peerId: mask,
          to: msg.peerId,
          distance: this.distance,
          duration: this.duration.sinceBeginNS()
        }))
      }
    }

    disnit(id, mask){
      //delete this.connecting[id]
      //this.hub.unsubscribe(mask)
    }

    initConnect(id, init, mask){
      var self = this
      let pipe = this.hub.subscribe(mask)
      var caller = new Peer({initiator: init, trickle: false, objectMode: false})
      this.connecting[id] = caller
      pipe.on('error', e => console.log.apply(this, arguments))
      pipe.on('data', function(data){
        data = JSON.parse(data)
        // callerID
        var peer = self.connecting[data.peerId]
        peer.signal(data.signal)
        peer.once('connect', e => {
          // close mask hub
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
        this.disnit(id, mask)
      })
      caller.on('error', e => console.log(e))
      return caller
    }

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
