var bus = require('page-bus')
//var short = require('short-uuid')

module.exports = function(name){
//  var id = short().generate()
  var id = name
  var emitters = {}
  var names = []
  var meta = bus({key: '_meta_'})
  var join = bus({key: '_join_'})
  var self = bus({key: id})
  var swarm = {} // ids
  var count = 0

  join.emit('data', {id: id})

  join.on('data', e => {
    if(e.id == id) return
    else if(swarm[e.id]) return
    else {
      var em = swarm[e.id] = bus({key: e.id})
      count++
      join.emit('data', {id: id})
    }
  })

  self.on('data', e => {
    e.events.forEach(ev => {
      if(!emitters[e.name]) {
        var emitter = emitters[e.name] = bus({key:e.name})
      }
    })
  })

  meta.on('data', e => {
    if(!emitters[e.name]) emitters[e.id] = bus({key:e.id})
  })

  return {on, once, emit}

  function on(name, fn){
    if(!emitters[name]) {
      names.push(name)
      meta.emit('data', {name: name})
      setTimeout(e => on(name, fn), 0)
    }
    else {
      emitters[name].on(name, fn)
    }
  }

  function once(name, fn){
    if(!emitters[name]) {
      meta.emit('data', {name: name})
      setTimeout(e => on(name, fn), 0)
    }
    else emitters[name].once(name, fn)
  }

  function emit(name, data){
    if(!emitters[name]) {
      meta.emit('data', {name: name})
      setTimeout(e => emit(name, data, 0))
    }
    else emitters[name].emit('data', data)
  }
}
