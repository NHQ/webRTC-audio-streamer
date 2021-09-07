var bus = require('page-bus')
var short = require('short-uuid')
var id = short().generate()
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
  let em = swarm[e.id] = bus({key: e.id})
  count++
  if(Math.random() <= 1 / Math.pow(count, 2)) return
  else em.emit('data', {events: names, swamrm: Object.keys(swarm)})
})

self.on('data', e => {
  e.events.forEach(ev => {
    if(!emitters[e.name]) {
      var emitter = emitters[e.name] = bus({key:e.name})
    }
  })
  e.swarm.forEach(s => {
    if(!swarm[s]) swarm[s] = bus({key: s})
  })
 count = swarm.length
})

meta.on('data', e => {
  if(!emitters[e.name]) emitters[e.name] = bus({key:e.name})
})

module.exports = {on, once, emit}

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
  else emitters[name].emit(name, data)
}
