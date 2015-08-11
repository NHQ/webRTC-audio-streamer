var me_vid = document.getElementById('me')
var media 
var peers = require('./peer')()

navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia

navigator.getUserMedia({video: true, audio:true}, function(mediaElement){
  
  media = mediaElement
  me_vid.src = window.URL.createObjectURL(mediaElement) 
  me_vid.play()
  peers.addMedia(media)

}, function(err){
    console.log(err)
})

  var ssb = require('secure-scuttlebutt')
  var defaults = require('secure-scuttlebutt/defaults')
  var memdb = require('memdb')
  var level = require('level-sublevel/bytewise')
  var minimist = require('minimist')
  var argv = minimist(process.argv, {
    default: {
      host: 'localhost',
      port: 11001,
      protocol: 'http:'
    }
  })

  console.log(argv)
  var db = level(memdb(), {valueEncoding: defaults.codec})
  var butt = ssb(db, defaults)

  var me = butt.createFeed()

  var sockethub = require('../signalplex')
  var signalhub = require('signalhub')
  var hub 

  if(argv.protocol === 'ws:')
    hub = sockethub(argv.protocol + '//' + argv.host + ':' + argv.port, 'meow')
  else if(argv.protocol === 'http:'){
    hub = signalhub(argv.protocol + '//' + argv.host + ':' + argv.port, 'meow')
  }
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
      })
    }
  })

  var dnd = require('drag-drop/buffer')
  var customEv = require('custom-event')
  dnd(document.body, peers.handleDrop)
