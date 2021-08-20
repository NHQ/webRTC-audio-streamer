const html = require('choo/html')

module.exports = function(state){
return html`
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${state.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
`
}
