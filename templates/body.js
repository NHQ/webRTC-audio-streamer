const html = require('choo/html')

module.exports = function(state, app){


return html`
  <div id="app" class="join colCenter">
    <h1 class=title>
      Gabr
    </h1>
    <h2 class="monograph ul">
      Podcast live-streaming, recording, and real-time talk with listener call-in.
    </h2>
    <a href=/host class=demo>Try the Demo</a>
    <div class="features flexCol colCenter">
      <h3>
        Test Features and Ideas
      </h3>
      <ul>
        <li>Live-Stream and Record Audio Podcasts</li>
        <li>Host Listener Call-Ins, Talk Shows, Presentations</li>
        <li>Chat and text</li>
        <li>Accept payments and Donations</li>
        <li>Charge for Subscriptions, Membership, or Call-ins</li>
        <li>Public or Private Streams</li>
        <li>Integrated Sponsor Portal</li>
        <li>Runs in the Web Browser, no apps or phone numbers needed, <br /> but also works in mobile browsers</li>
        <li>¿Asyncronous Audio Conversations?</li>
        <li>¿Call & Response Convos?</li>
        <li>Call 1-900-555-1337 $4.99 for the 1st minute...</li>

      </ul>
    </div>
    <img src=GabrielHorn.png class=logo />
  </div>
`
}
