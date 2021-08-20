var me_vid = document.getElementById('me')
var call = document.getElementById('call')
var media 
var peers = require('./peer')()
var ui = require('getids')()
var h = require('hyperscript')
//var audio = new AudioContext
//var mic = require('../jsynth-mic')(audio)

// for audio/video webRTC
 //addMedia()

addMedia()

function addMedia(id, audio=true, video=false){
  navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia

  navigator.getUserMedia({video, audio}, function(mediaElement){
    
    media = mediaElement
    me_vid.srcObject = media// window.URL.createObjectURL(mediaElement) 
    me_vid.play()

  }, function(err){
      console.log(err)
  })
}

var minimist = require('minimist')
var argv = minimist(process.argv, {
  default: {
    host: '10.42.0.200',
    port: 8009,
    protocol: 'http:'
  }
})

//console.log(argv)

var me = {id: Math.random().toString().slice(2)}

//var sockethub = require('signalplex')
var signalhub = require('signalhub')
var hub 
  //hub = sockethub(argv.protocol + '//' + argv.host + ':' + argv.port, 'meow')

hub = signalhub(argv.protocol + '//' + argv.host + ':' + argv.port, 'meow')
var pipe = hub.subscribe(me.id)

var other = hub.subscribe('others')
var others = {}

// entre vous
hub.broadcast('others', me.id)
pipe.on('error', function(e){console.log(e)})
pipe.on('data', function(data){
  console.log(data.toString())
  //data = data.toString()
  
  data = JSON.parse(data.toString())
  var from = others[data.from]
  console.log(from, data)
  if(!from){
  
    var call = data.offer
    var opts = {}
    opts.which ='digital'
    opts.init = false
    peers.answer(call, function(e, p, o){
      others[data.from] = {peer: p}
      p.on('close', function(){
        others[data.from] = null
      })
      p.on('data', function(data){
        
      })
      var reply = {from: me.id, offer: o}
      console.log('reply', reply)
      hub.broadcast(data.from, JSON.stringify(reply))
    
    })
  }else{
    from.peer.signal(data.offer)
  }
})

// this happens when a new entity joins
other.on('data', function(id){
  console.log(id)
  ui.callers.appendChild(h('div.caller', h('button.connect', `Connect to ${id}`, {onclick: connect})))  
  function connect(){
  id = id.toString()
  if(!(id === me.id)) {

    var opts = {}
    opts.init = true
    opts.which = 'digital' // else 'manual'
    
    peers.initiate(opts, function(e, p, o){
  //    console.log('peer init' + id + '\n', e,p,o)
      others[id] = {init:true}
      others[id].peer = p
      var offer = {from: me.id}
      offer.offer = o
      hub.broadcast(id, JSON.stringify(offer))
      peers.peers.forEach(e => {if(e.id == id) e.addStream(media)})
    })
  }}
})
