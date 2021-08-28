var qs = require('querystring')
var Peer = require('simple-peer')
var ui = require('getids')()
var h = require('hyperscript')
var signalhub = require('signalhub')

const short = require('short-uuid');
const msrc = require('mediasource')
const toa = require('to-arraybuffer')
const btob = require('blob-to-buffer')
var master = new AudioContext
var minimist = require('minimist')
var argv = minimist(process.argv, {
  default: {
    host: '0.0.0.0',
    port: 8009,
    protocol: 'http'
  }
})
var store = require('store')

addMedia()

function mute(torf){
  micStream.getAudioTracks()[0].enabled = torf
}

var Emitter = require('events').EventsEmitter

var ps = require('pull-stream')
var pulse = require('pull-pushable')
var tops = require('stream-to-pull-stream')
var psts = require('pull-stream-to-stream')
class Self extends Emitter {
  
  constructor(q){
    this.id = q.id
    this.peers = []
    this.phonebook = {}
    this.distance = -1
    this.hub = q.hub
    this.session = q.session
    this.maxConnections = q.maxConnections || 11
    if(q.sink) this.sink = q.sink
    if(q.source) {
      this.source = q.source
      this.sourceCaptured()
    }
  }

  set source(stream){ //  must be a pull stream
    if(stream) {
      this.sourceStream = stream
      this.distance = 0 // assume this is the originator
      this.sourceCaptured()
    }
  }

  negotiateSource(){
    var inc = this.hub.subscribe(this.id)
    this.hub.broadcast('entre:'+this.session.id, {callerId: this.id})
    var offers = []
    inc.on('data', offer => {
      offers.push(JSON.parse(offer))
    })
   setTimeout(e => {
    inc.close()
    let nearest = offers.sort((a, b) => a.distance <= b.distance ? 0 : 1)[0]
    nearest.source = true
    this._connect(nearest)
   }, 1000)

  }

  sourceCaptured(){
    if(this.sink) this.source.pipe(this.sink)
    if(this.peers.length){
      this.peers.forEach(id =>{
        ps(this.sourceStream, tops(this.phonebook[id]))
      })
    }
  }

  _connect (data){
    console.log(data)
    if(this.phonebook[data.callerId]) this.phonebook[data.callerId].signal(data.signal)
    else{
      var caller = new Peer({initiator: data.signal ? false : true, trickle: false, objectMode: false})
      this.phonebook[data.callerId] = caller
      //caller.on('stream', stream => {})
      if(data.signal) caller.signal(data.signal) // redundant?
      caller.on('signal', signal => {
        console.log(signal)
        this.hub.broadcast(data.callerId, JSON.stringify({signal: signal, callerId: me.id}))
      }) 
      caller.on('close', _ => {})
      caller.on('connect', e => {
        if(data.source){
          self.distance = data.distance + 1
          self.sourceStream = tops(caller)
          self.sourceCaptured()
          self.emit('sourceCaptured', caller)
          caller.on('close', e => self.emit('sourceClosed', caller))
        }
        else peers.push(data.callerId)
        self.emit('peerConnected', caller)
        caller.on('close', e => {
          this.peers = this.peers.filter(e => e == data.callerId ? 0 : 1)
          delete this.phonebook[data.callerId]
          self.emit('disconnected', data.callerId)
        
        })
        
        
        //console.log(`Connected to ${data.callerId}`)

      }) 
    }
  }

}

function addMedia(){
  var session = qs.parse(window.location.search)
  var hub = signalhub(argv.protocol + '://' + argv.host + ':' + argv.port, 'meow')
  var me = store.get('myself')
  var ael = ui.player
  var deets = {
    id: me.id || short().generate(),
    session : session, 
    hub : hub,
    audio : ael,
    mime : 'audio/webm;codecs=opus'
  }
  var self = new Self(deets)
  ui.callId.value = ui.callId.innerText = window.location.hash.slice(1)
  ui.myid.innerText = me.id
  
  store.set('myself', {id: deets.id})
    
    var pipe = hub.subscribe(me.id)
    var room = hub.subscribe(session.id)
    var entre = hub.broadcast('entre:'+ session.id, {id: me.id})
    // when you can share stream:
    // var entre = hub.subscribe('entre:'+ session.id)

    pipe.on('error', function(e){console.log(e)})
    pipe.on('data', function(data){
      data = JSON.parse(data.toString())
      // callerID
      var from = data.callerId
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
            var src = new MediaSource()
            ael.src = URL.createObjectURL( src )
            src.onsourceopen = e => {
              var srcBuf = src.addSourceBuffer(mime)
              ael.play()
              caller.on('data', e => {
               // console.log(e)
                srcBuf.appendBuffer(toa(e))
              })
            } 
            console.log(`Connected to ${data.callerId}`)

          }) 
        }
      }
    })
}
