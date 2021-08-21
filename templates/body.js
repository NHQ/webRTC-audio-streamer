const html = require('choo/html')

module.exports = function(state, app){


return html`
  <div id="app" class="join colCenter">
    <h1 class=title>
      Gabr
    </h1>
    <h2 class="monograph ul">
      Podcast live-streaming, recording, and <br />real-time talk with listener call-in.
    </h2>
    <a href=/ class=demo>Demo Coming Soon</a>
    <div class="features flexCol colCenter">
      <h3>
        Features and Ideas
      </h3>
      <ul class="flexCol">
        <li>Live-Stream and Record Audio Podcasts</li>
        <li>Host Listener Call-Ins, Talk Shows, Presentations</li>
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
    <audio id=xxx controls />
    <img src=GabrielHorn.png class=logo />
  </div>
`
}
