
require('domready')(re => {
  var h = require('hyperscript')
  var ui = require('getids')()
  var Emitter = require('events')//.EventEmitter //require('./sharedEmitter')
  var bus = new Emitter()
  bus.once('iframeLoaded', e => {
    console.log(e)
    bus.emit('pong', {goat: 1})
    bus.on('clock', e => console.log(e))
  })

  var fs = require('fs')
  var Peer = require('simple-peer')
  var signalhub = require('signalhub')
  const {makeAutoObservable,  autorun} = require('mobx')
  const short = require('short-uuid');
  const toa = require('to-arraybuffer')
  const btob = require('blob-to-buffer')
  const thru = require('through2')
  var store = require('store')
  var shajs = require('sha.js')
  const Time = require('../since-when')
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
  var debub = signalhub('https://folkstack.com:80', 'debug')
  //var ret=debub.subscribe('return')
  var mime = 'audio/ogg'
  var mime = 'audio/ogg;codecs=opus'
  function dlink(buf, mime=mime){
  let file = new Blob([buf], {type:mime})
   let a = h('a', 'download', {href: URL.createObjectURL(file), name:new shajs('sha256').update(buf).digest('hex')+'.ogg', download:true})
   console.log(a)
  ui.tracks.appendChild(a)
  }

  var app 

  window.store = store
  if(!store.get('reset')) {
     
    store.clearAll();
    store.set('reset', true)
  }
  runp([initState, initUI, captureNetwork], (err, app)=>{
    app = app

    ui.init.addEventListener('change', e => {
      app._log('init')

      try{
        initAudio(app, (err, app)=>{
          app._log(err)
          //app.audio.sourceStream.pipe(app.audio.sinkStream) // heh
          if(app.session.broadcasting) {
            app.network.distance = 1
//            app.network.sourceStream = app.audio.sourceStream
           app.network.isSeekWorthy()
            app.network.allowCalls(app.session.stream)
            setTimeout(e => app.audio.start({broadcasing:true}), 1000)
             
          }
          else {
            app.audio.send('resume') 
            app.network.sourceSeek()
            bus.on('sourcePeerCaptured', id => {
              //app.audio.start(1000)
              app.network.connections[id].on('data', buf => {
              
                app.audio.send('sourceBuffer', buf)
              })
            })
          }

          bus.on('callSourceCaptured', id => {
//            app.audio.send('addPeer', 'caller', id)
            
            app.network.conncections[id].on('data', buf => {
              console.log(buf)
              app.audio.send('callBuffer', buf)
              
            })
            
          })
      })} catch (err){
        app._log(err)
      }
    })
    
  })



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
      app.audio.send('param', e[1], e[0])
    })
    let hash = window.location.hash.slice(1)
    var session = store.get('session')
    if(!session) {
      session = {id: short().generate().split().reverse().join().slice(0,11)}
    }
    session.broadcasting =true 
    if(hash.length){
      session.stream = hash //short().generate().split().reverse().join().slice(0,11)
      session.broadcasting = false
    }
    else session.stream = session.id //short().generate().split().reverse().join().slice(0,11)

    app.session = session
  app._log = function(_id) { return e => {
      //ui.debug.appendChild(h('p', e.toString()))    
      debub.broadcast('debug', JSON.stringify({id: _id, log: e}))
      console.log(e)
  } }(session.broadcasting ? session.id : session.stream)
    store.set('session', session)
    console.log(app)
    cb(null, app)
  }


  function initUI(app, cb){
  
    bus.on('caller', msg => {
      let c = h('button', {id: msg.peerId, onclick: e => bus.emit('call', {peerId: e.target.id})})
      ui.tracks.appendChild(c)
    })

    ui.livelink.innerText = `${window.location.href}#${app.session.stream}`
    ui.copybutton.onchange = e => {
      navigator.clipboard.writeText(ui.livelink.innerText)
    }
    ui.request.addEventListener('change', e => {
      app.network.initCall(app.session.stream)
      app.audio.send('captureMic', null, app.session.stream)
    })
    ui.file.addEventListener('change', e => {
      console.log(e.target.files[0])
      //var a = h('audio.invert', {controls: true, src : URL.createObjectURL(e.target.files[0])})
      //ui.tracks.appendChild(a)
      //var c= app.audio.master.createMediaElementSource(a)
      //console.log(a)
      //c.connect(app.audio.trackmixer)
      let id = short().generate()
      //app.tracks[id] = 
      app.audio.send('addAudioTrack', e.target.files[0], id) 
      btob(e.target.files[0], (err, buf) => {
       // sampler(app.audio.master, buf.buffer, (err, node) =>{
          //node.connect(app.audio.master.destination)
          //node.start(0)
       // })      
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

  function initAudio(app, cb){
    var iframe = require('../iframarfi')

    var audio = iframe(require('./audio.js'))
    ui.tracks.appendChild(audio)
    
    window.addEventListener('message', msg => {
      //console.log(msg.data.data.length)
      //audio.contentWindow.postMessage({type: 'sinkBuffer', data: msg.data.data})
      
      var t = msg.data.type 
      if(t == 'debug'){
        app._log(msg.data.data)
      }
      if(t == 'audioSourceBuffer') {
        if(msg.data.id == 'record'){}
        else {
          let u = app.network.connections[msg.data.id] || {}
          //console.log(msg, u)
          if(u.writable) u.write(msg.data.data)
        }
      }
    })


    function send(type, data, id){
      audio.contentWindow.postMessage({type, data, id})
    }


    //setTimeout( e=> audio.contentWindow.postMessage({type: 'startBroadcast'}), 1000)

    app.audio = {
      iframe : audio,
      send: send,
      start: e => send('startBroadcast'),
      stop: e => send('stopBroadcast')
    }
    cb(null, app) 
  }
  
  function initCast(app, cb){
  
      app._log('stateInit')
      cb(null, app)
    
  }
  function captureNetwork(app, cb) {
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
      this.hub.unsubscribe('caller:'+this.id)
    }

    allowCalls(id){
      console.log(id)
      let calls = this.hub.subscribe('caller:'+id)
      calls.on('data', msg=>{
        console.log(msg)
        //msg=JSON.parse(msg)
        bus.emit('caller', msg)
      })
      bus.once('call', msg =>{
        this.callDirect(msg.peerId)
      })

    }

    initCall(id){
      let mask = short().generate() 
      this.hub.broadcast('caller:'+id, {peerId: mask})
      let peer = this.initConnect(id, false, mask)
            app.audio.send('addPeer', 'caller', id)
      peer.on('connect', e =>{
        this.callers[id] = peer
        bus.emit('callSourceCaptured', id)
        peer.on('data', e => console.log(e))
        
      })
      
      
    }

    callDirect(id){
      let peer = this.initConnect(id, true, this.id)
            app.audio.send('addPeer', 'caller', id)
      peer.on('connect', e =>{
        this.callers[id] = peer
        bus.emit('callSourceCaptured', id)
        console.log('CALL PEER CONNECTED')
        peer.on('data', e => console.log(e))

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
            self.isSeekWorthy()
          })
          peer.on('close', e => {
            self.app._log('Source Peer Closed')

          })
        } else {
          self.app._log('Err: No source peer found.')    
        }
      }, 3000)
      

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
        }, 1111*30)
        let mask = short().generate()
        let peer = this.initConnect(msg.peerId, false, mask)
        peer.once('connect', e =>{
          self.peers[msg.peerId] = peer
          app.audio.send('addPeer', 'broadcast', msg.peerId)
          self.isSeekWorthy()
          //if(app.audio.firstBroadcastBuffer) peer.write(app.audio.firstBroadcastBuffer)
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
      delete this.connecting[id]
      this.isSeekWorthy()
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
    var network = new Network(app, argv.protocol + '://' + argv.host + ':' + argv.port)
    app._log('netCap')
    app.network = network

    cb(null, app)
  }

})
