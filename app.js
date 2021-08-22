//import "./stylesheets/main.css";
//const  fs = require('fs')
var choo = require('choo')
var html = require('choo/html')

var index = require('./templates/body.js')
var app = choo()
app.mount(document.getElementById('app'))
// We can communicate with main process through messages.
var observer = new MutationObserver(function(mutations) {
//  console.log(mutations)
  var m = mutations.pop()
  console.log(m.target.children)
  app.emitter.emit(m.target.children[0].id, m.target.children[0])
  app.emitter.emit('load') //m.target.children[0].id, m.target.children[0])
});

observer.observe(document, {attributes: false, childList: true, characterData: false, subtree:true});
//observer.disconnect();

app.use(function(state, update){
  //state.db = db
  state.title = 'p2phone'
  state.view = '/'
  update.on('view', e => state.view = e)
  update.on('process', e => {
    update.render()
    update.emit(e.calleId) // callback to run JS for hyperx templates
  })
})

app.route('', state => {
  console.log(state)
  app.emitter.emit('unload','')
  return index(state, app)
})

app.route('/host', state => {
  app.emitter.emit('unload','')
  return index(state, app)
})

// listener route
app.route('/stream/:page', state => {
  console.log(state)
  app.emitter.emit('unload','')
  return index(state, app)
})
