var bus = require('page-bus')
var short = require('short-uuid')
var id = short().generate()
var emitters = {}
var meta = bus({key: '_meta_'})

meta.on('data', e => {
  if(!emitters[e.event]) {
    var emitter = emitters[e.event] = bus({key:e.event})
  }
})

module.exports = {on, once, emit}

function on(name, fn){
  if(!emitters[name]) {
    meta.emit('data', {event: name})
    setTimeout(e => on(name, fn), 0)
  }  
  else {
    emitters[name].on(name, fn)
  }
}

function once(name, fn){
  if(!emitters[name]) {
    meta.emit('data', {event: name})
    setTimeout(e => on(name, fn), 0)
  }  
  else emitters[name].once(name, fn)
}

function emit(name, data){
  if(!emitters[name]) {
    meta.emit('data', {event: name})
    setTimeout(e => emit(name, data, 0))
  }  
  else emitters[name].emit(name, data)
}
