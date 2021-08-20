var SimplePeer = require('simple-peer')

var peeps = []
var media
module.exports = function(){
  return {
    handleDrop : handleDrop,
    initiate: initiate,
    answer: answer,
    addMedia: addMedia,
    peers: peeps
  }
} 

function addMedia(p){
  media = p
}

function handleDrop(file){
  try{
    var call = files[0].toString('utf8')
    call = JSON.parse(call, function(e, p, d){
      console.log(e, p,d)
    })
    answer(call)
  }catch(e){
    console.log(e)
  }
}

function initiate(opts, cb){

  var peer = macFriend(opts.init, cb)
  
  peer.on('signal', function(data){
    if(data.type === 'offer'){
    
      if(opts.which === 'manual'){
      
        var dl = new Blob([JSON.stringify(data)], {type: 'application/json'})
        var link = window.URL.createObjectURL(dl)
        var a = document.createElement('a')
        a.href = link
        a.download = 'offer.json'
        a.innerText = 'download'
        var ev = new CustomEvent('click', {})
        a.dispatchEvent(ev)
        document.body.appendChild(a)
      
      }

      cb(null, peer, data)
    
    }
  
  })


}

function answer(call, cb){

  var peer = macFriend(false, cb) 

  peer.signal(call)

  var which = false

  peer.on('signal', function(data){
  
    if(data.type === 'answer'){
    
      if(which === 'manual'){
      
        var dl = new Blob([JSON.stringify(data)], {type: 'application/json'})
        var link = window.URL.createObjectURL(dl)
        var a = document.createElement('a')
        a.href = link
        a.download = 'offer.json'
        a.innerText = 'download'
        var ev = new CustomEvent('click', {})
        a.dispatchEvent(ev)
        document.body.appendChild(a)
      
      }

      cb(null, peer, data)
    
    }

  })
}

function macFriend(init, cb){

  var peer = new SimplePeer({initiator: init, trickle: false, stream: media})
 
  var vid_el= undefined

  peer.on('error', function(e){
   console.log(e)
   cb(e)
  })
 
  peer.on('stream', function(stream){
    var vid = document.createElement('video')
    vid.style.width = '640px'
    vid.style.height = '480px'
    vid.srcObject = stream//indow.URL.createObjectURL(stream)
    document.body.appendChild(vid)
    vid.play()
    vid_el = vid
  })

  peer.on('data', function(data){
//    console.log(data.toString())
  })

  peer.on('connect', function(){
    console.log('connected!')
    peer.send('ahoy hoy')
  })

  peer.on('signal', function(data){
  })

  peer.on('close', function(){
    if(vid_el) document.body.removeChild(vid_el)
  })
  
  peeps.push(peer)
  return peer

}


