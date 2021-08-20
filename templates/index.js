const head = require('./head.js')
const body = require('./body.js')
const html = require('choo/html')

module.exports = function(state){
  return html`<!DOCTYPE html><html lang="en">${head(state)}${body(state)}</html>`
}
