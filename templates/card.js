const card = require('./card.js')
const html = require('choo/html')

module.exports = function(state){

var cards = state.cards.map(e => card(e))

return html`
<body>
  <div class=content>
    ${cards}
  </div>
  <script type="text/javascript" src="bundle.js"></script>
</body>
`
}
