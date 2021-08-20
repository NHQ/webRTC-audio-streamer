(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

app.route('/', state => {
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

},{"./templates/body.js":30,"choo":4,"choo/html":3}],2:[function(require,module,exports){
var assert = require('assert')
var LRU = require('nanolru')

module.exports = ChooComponentCache

function ChooComponentCache (state, emit, lru) {
  assert.ok(this instanceof ChooComponentCache, 'ChooComponentCache should be created with `new`')

  assert.equal(typeof state, 'object', 'ChooComponentCache: state should be type object')
  assert.equal(typeof emit, 'function', 'ChooComponentCache: emit should be type function')

  if (typeof lru === 'number') this.cache = new LRU(lru)
  else this.cache = lru || new LRU(100)
  this.state = state
  this.emit = emit
}

// Get & create component instances.
ChooComponentCache.prototype.render = function (Component, id) {
  assert.equal(typeof Component, 'function', 'ChooComponentCache.render: Component should be type function')
  assert.ok(typeof id === 'string' || typeof id === 'number', 'ChooComponentCache.render: id should be type string or type number')

  var el = this.cache.get(id)
  if (!el) {
    var args = []
    for (var i = 2, len = arguments.length; i < len; i++) {
      args.push(arguments[i])
    }
    args.unshift(Component, id, this.state, this.emit)
    el = newCall.apply(newCall, args)
    this.cache.set(id, el)
  }

  return el
}

// Because you can't call `new` and `.apply()` at the same time. This is a mad
// hack, but hey it works so we gonna go for it. Whoop.
function newCall (Cls) {
  return new (Cls.bind.apply(Cls, arguments)) // eslint-disable-line
}

},{"assert":8,"nanolru":17}],3:[function(require,module,exports){
module.exports = require('nanohtml')

},{"nanohtml":13}],4:[function(require,module,exports){
var scrollToAnchor = require('scroll-to-anchor')
var documentReady = require('document-ready')
var nanotiming = require('nanotiming')
var nanorouter = require('nanorouter')
var nanomorph = require('nanomorph')
var nanoquery = require('nanoquery')
var nanohref = require('nanohref')
var nanoraf = require('nanoraf')
var nanobus = require('nanobus')
var assert = require('assert')

var Cache = require('./component/cache')

module.exports = Choo

var HISTORY_OBJECT = {}

function Choo (opts) {
  var timing = nanotiming('choo.constructor')
  if (!(this instanceof Choo)) return new Choo(opts)
  opts = opts || {}

  assert.equal(typeof opts, 'object', 'choo: opts should be type object')

  var self = this

  // define events used by choo
  this._events = {
    DOMCONTENTLOADED: 'DOMContentLoaded',
    DOMTITLECHANGE: 'DOMTitleChange',
    REPLACESTATE: 'replaceState',
    PUSHSTATE: 'pushState',
    NAVIGATE: 'navigate',
    POPSTATE: 'popState',
    RENDER: 'render'
  }

  // properties for internal use only
  this._historyEnabled = opts.history === undefined ? true : opts.history
  this._hrefEnabled = opts.href === undefined ? true : opts.href
  this._hashEnabled = opts.hash === undefined ? false : opts.hash
  this._hasWindow = typeof window !== 'undefined'
  this._cache = opts.cache
  this._loaded = false
  this._stores = [ondomtitlechange]
  this._tree = null

  // state
  var _state = {
    events: this._events,
    components: {}
  }
  if (this._hasWindow) {
    this.state = window.initialState
      ? Object.assign({}, window.initialState, _state)
      : _state
    delete window.initialState
  } else {
    this.state = _state
  }

  // properties that are part of the API
  this.router = nanorouter({ curry: true })
  this.emitter = nanobus('choo.emit')
  this.emit = this.emitter.emit.bind(this.emitter)

  // listen for title changes; available even when calling .toString()
  if (this._hasWindow) this.state.title = document.title
  function ondomtitlechange (state) {
    self.emitter.prependListener(self._events.DOMTITLECHANGE, function (title) {
      assert.equal(typeof title, 'string', 'events.DOMTitleChange: title should be type string')
      state.title = title
      if (self._hasWindow) document.title = title
    })
  }
  timing()
}

Choo.prototype.route = function (route, handler) {
  var routeTiming = nanotiming("choo.route('" + route + "')")
  assert.equal(typeof route, 'string', 'choo.route: route should be type string')
  assert.equal(typeof handler, 'function', 'choo.handler: route should be type function')
  this.router.on(route, handler)
  routeTiming()
}

Choo.prototype.use = function (cb) {
  assert.equal(typeof cb, 'function', 'choo.use: cb should be type function')
  var self = this
  this._stores.push(function (state) {
    var msg = 'choo.use'
    msg = cb.storeName ? msg + '(' + cb.storeName + ')' : msg
    var endTiming = nanotiming(msg)
    cb(state, self.emitter, self)
    endTiming()
  })
}

Choo.prototype.start = function () {
  assert.equal(typeof window, 'object', 'choo.start: window was not found. .start() must be called in a browser, use .toString() if running in Node')
  var startTiming = nanotiming('choo.start')

  var self = this
  if (this._historyEnabled) {
    this.emitter.prependListener(this._events.NAVIGATE, function () {
      self._matchRoute(self.state)
      if (self._loaded) {
        self.emitter.emit(self._events.RENDER)
        setTimeout(scrollToAnchor.bind(null, window.location.hash), 0)
      }
    })

    this.emitter.prependListener(this._events.POPSTATE, function () {
      self.emitter.emit(self._events.NAVIGATE)
    })

    this.emitter.prependListener(this._events.PUSHSTATE, function (href) {
      assert.equal(typeof href, 'string', 'events.pushState: href should be type string')
      window.history.pushState(HISTORY_OBJECT, null, href)
      self.emitter.emit(self._events.NAVIGATE)
    })

    this.emitter.prependListener(this._events.REPLACESTATE, function (href) {
      assert.equal(typeof href, 'string', 'events.replaceState: href should be type string')
      window.history.replaceState(HISTORY_OBJECT, null, href)
      self.emitter.emit(self._events.NAVIGATE)
    })

    window.onpopstate = function () {
      self.emitter.emit(self._events.POPSTATE)
    }

    if (self._hrefEnabled) {
      nanohref(function (location) {
        var href = location.href
        var hash = location.hash
        if (href === window.location.href) {
          if (!self._hashEnabled && hash) scrollToAnchor(hash)
          return
        }
        self.emitter.emit(self._events.PUSHSTATE, href)
      })
    }
  }

  this._setCache(this.state)
  this._matchRoute(this.state)
  this._stores.forEach(function (initStore) {
    initStore(self.state)
  })

  this._tree = this._prerender(this.state)
  assert.ok(this._tree, 'choo.start: no valid DOM node returned for location ' + this.state.href)

  this.emitter.prependListener(self._events.RENDER, nanoraf(function () {
    var renderTiming = nanotiming('choo.render')
    var newTree = self._prerender(self.state)
    assert.ok(newTree, 'choo.render: no valid DOM node returned for location ' + self.state.href)

    assert.equal(self._tree.nodeName, newTree.nodeName, 'choo.render: The target node <' +
      self._tree.nodeName.toLowerCase() + '> is not the same type as the new node <' +
      newTree.nodeName.toLowerCase() + '>.')

    var morphTiming = nanotiming('choo.morph')
    nanomorph(self._tree, newTree)
    morphTiming()

    renderTiming()
  }))

  documentReady(function () {
    self.emitter.emit(self._events.DOMCONTENTLOADED)
    self._loaded = true
  })

  startTiming()
  return this._tree
}

Choo.prototype.mount = function mount (selector) {
  var mountTiming = nanotiming("choo.mount('" + selector + "')")
  if (typeof window !== 'object') {
    assert.ok(typeof selector === 'string', 'choo.mount: selector should be type String')
    this.selector = selector
    mountTiming()
    return this
  }

  assert.ok(typeof selector === 'string' || typeof selector === 'object', 'choo.mount: selector should be type String or HTMLElement')

  var self = this

  documentReady(function () {
    var renderTiming = nanotiming('choo.render')
    var newTree = self.start()
    if (typeof selector === 'string') {
      self._tree = document.querySelector(selector)
    } else {
      self._tree = selector
    }

    assert.ok(self._tree, 'choo.mount: could not query selector: ' + selector)
    assert.equal(self._tree.nodeName, newTree.nodeName, 'choo.mount: The target node <' +
      self._tree.nodeName.toLowerCase() + '> is not the same type as the new node <' +
      newTree.nodeName.toLowerCase() + '>.')

    var morphTiming = nanotiming('choo.morph')
    nanomorph(self._tree, newTree)
    morphTiming()

    renderTiming()
  })
  mountTiming()
}

Choo.prototype.toString = function (location, state) {
  state = state || {}
  state.components = state.components || {}
  state.events = Object.assign({}, state.events, this._events)

  assert.notEqual(typeof window, 'object', 'choo.mount: window was found. .toString() must be called in Node, use .start() or .mount() if running in the browser')
  assert.equal(typeof location, 'string', 'choo.toString: location should be type string')
  assert.equal(typeof state, 'object', 'choo.toString: state should be type object')

  this._setCache(state)
  this._matchRoute(state, location)
  this.emitter.removeAllListeners()
  this._stores.forEach(function (initStore) {
    initStore(state)
  })

  var html = this._prerender(state)
  assert.ok(html, 'choo.toString: no valid value returned for the route ' + location)
  assert(!Array.isArray(html), 'choo.toString: return value was an array for the route ' + location)
  return typeof html.outerHTML === 'string' ? html.outerHTML : html.toString()
}

Choo.prototype._matchRoute = function (state, locationOverride) {
  var location, queryString
  if (locationOverride) {
    location = locationOverride.replace(/\?.+$/, '').replace(/\/$/, '')
    if (!this._hashEnabled) location = location.replace(/#.+$/, '')
    queryString = locationOverride
  } else {
    location = window.location.pathname.replace(/\/$/, '')
    if (this._hashEnabled) location += window.location.hash.replace(/^#/, '/')
    queryString = window.location.search
  }
  var matched = this.router.match(location)
  this._handler = matched.cb
  state.href = location
  state.query = nanoquery(queryString)
  state.route = matched.route
  state.params = matched.params
}

Choo.prototype._prerender = function (state) {
  var routeTiming = nanotiming("choo.prerender('" + state.route + "')")
  var res = this._handler(state, this.emit)
  routeTiming()
  return res
}

Choo.prototype._setCache = function (state) {
  var cache = new Cache(state, this.emitter.emit.bind(this.emitter), this._cache)
  state.cache = renderComponent

  function renderComponent (Component, id) {
    assert.equal(typeof Component, 'function', 'choo.state.cache: Component should be type function')
    var args = []
    for (var i = 0, len = arguments.length; i < len; i++) {
      args.push(arguments[i])
    }
    return cache.render.apply(cache, args)
  }

  // When the state gets stringified, make sure `state.cache` isn't
  // stringified too.
  renderComponent.toJSON = function () {
    return null
  }
}

},{"./component/cache":2,"assert":8,"document-ready":5,"nanobus":9,"nanohref":10,"nanomorph":18,"nanoquery":21,"nanoraf":22,"nanorouter":23,"nanotiming":25,"scroll-to-anchor":27}],5:[function(require,module,exports){
'use strict'

module.exports = ready

function ready (callback) {
  if (typeof document === 'undefined') {
    throw new Error('document-ready only runs in the browser')
  }
  var state = document.readyState
  if (state === 'complete' || state === 'interactive') {
    return setTimeout(callback, 0)
  }

  document.addEventListener('DOMContentLoaded', function onLoad () {
    callback()
  })
}

},{}],6:[function(require,module,exports){
module.exports = attributeToProperty

var transform = {
  'class': 'className',
  'for': 'htmlFor',
  'http-equiv': 'httpEquiv'
}

function attributeToProperty (h) {
  return function (tagName, attrs, children) {
    for (var attr in attrs) {
      if (attr in transform) {
        attrs[transform[attr]] = attrs[attr]
        delete attrs[attr]
      }
    }
    return h(tagName, attrs, children)
  }
}

},{}],7:[function(require,module,exports){
var attrToProp = require('hyperscript-attribute-to-property')

var VAR = 0, TEXT = 1, OPEN = 2, CLOSE = 3, ATTR = 4
var ATTR_KEY = 5, ATTR_KEY_W = 6
var ATTR_VALUE_W = 7, ATTR_VALUE = 8
var ATTR_VALUE_SQ = 9, ATTR_VALUE_DQ = 10
var ATTR_EQ = 11, ATTR_BREAK = 12
var COMMENT = 13

module.exports = function (h, opts) {
  if (!opts) opts = {}
  var concat = opts.concat || function (a, b) {
    return String(a) + String(b)
  }
  if (opts.attrToProp !== false) {
    h = attrToProp(h)
  }

  return function (strings) {
    var state = TEXT, reg = ''
    var arglen = arguments.length
    var parts = []

    for (var i = 0; i < strings.length; i++) {
      if (i < arglen - 1) {
        var arg = arguments[i+1]
        var p = parse(strings[i])
        var xstate = state
        if (xstate === ATTR_VALUE_DQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_SQ) xstate = ATTR_VALUE
        if (xstate === ATTR_VALUE_W) xstate = ATTR_VALUE
        if (xstate === ATTR) xstate = ATTR_KEY
        if (xstate === OPEN) {
          if (reg === '/') {
            p.push([ OPEN, '/', arg ])
            reg = ''
          } else {
            p.push([ OPEN, arg ])
          }
        } else if (xstate === COMMENT && opts.comments) {
          reg += String(arg)
        } else if (xstate !== COMMENT) {
          p.push([ VAR, xstate, arg ])
        }
        parts.push.apply(parts, p)
      } else parts.push.apply(parts, parse(strings[i]))
    }

    var tree = [null,{},[]]
    var stack = [[tree,-1]]
    for (var i = 0; i < parts.length; i++) {
      var cur = stack[stack.length-1][0]
      var p = parts[i], s = p[0]
      if (s === OPEN && /^\//.test(p[1])) {
        var ix = stack[stack.length-1][1]
        if (stack.length > 1) {
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === OPEN) {
        var c = [p[1],{},[]]
        cur[2].push(c)
        stack.push([c,cur[2].length-1])
      } else if (s === ATTR_KEY || (s === VAR && p[1] === ATTR_KEY)) {
        var key = ''
        var copyKey
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_KEY) {
            key = concat(key, parts[i][1])
          } else if (parts[i][0] === VAR && parts[i][1] === ATTR_KEY) {
            if (typeof parts[i][2] === 'object' && !key) {
              for (copyKey in parts[i][2]) {
                if (parts[i][2].hasOwnProperty(copyKey) && !cur[1][copyKey]) {
                  cur[1][copyKey] = parts[i][2][copyKey]
                }
              }
            } else {
              key = concat(key, parts[i][2])
            }
          } else break
        }
        if (parts[i][0] === ATTR_EQ) i++
        var j = i
        for (; i < parts.length; i++) {
          if (parts[i][0] === ATTR_VALUE || parts[i][0] === ATTR_KEY) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][1])
            else parts[i][1]==="" || (cur[1][key] = concat(cur[1][key], parts[i][1]));
          } else if (parts[i][0] === VAR
          && (parts[i][1] === ATTR_VALUE || parts[i][1] === ATTR_KEY)) {
            if (!cur[1][key]) cur[1][key] = strfn(parts[i][2])
            else parts[i][2]==="" || (cur[1][key] = concat(cur[1][key], parts[i][2]));
          } else {
            if (key.length && !cur[1][key] && i === j
            && (parts[i][0] === CLOSE || parts[i][0] === ATTR_BREAK)) {
              // https://html.spec.whatwg.org/multipage/infrastructure.html#boolean-attributes
              // empty string is falsy, not well behaved value in browser
              cur[1][key] = key.toLowerCase()
            }
            if (parts[i][0] === CLOSE) {
              i--
            }
            break
          }
        }
      } else if (s === ATTR_KEY) {
        cur[1][p[1]] = true
      } else if (s === VAR && p[1] === ATTR_KEY) {
        cur[1][p[2]] = true
      } else if (s === CLOSE) {
        if (selfClosing(cur[0]) && stack.length) {
          var ix = stack[stack.length-1][1]
          stack.pop()
          stack[stack.length-1][0][2][ix] = h(
            cur[0], cur[1], cur[2].length ? cur[2] : undefined
          )
        }
      } else if (s === VAR && p[1] === TEXT) {
        if (p[2] === undefined || p[2] === null) p[2] = ''
        else if (!p[2]) p[2] = concat('', p[2])
        if (Array.isArray(p[2][0])) {
          cur[2].push.apply(cur[2], p[2])
        } else {
          cur[2].push(p[2])
        }
      } else if (s === TEXT) {
        cur[2].push(p[1])
      } else if (s === ATTR_EQ || s === ATTR_BREAK) {
        // no-op
      } else {
        throw new Error('unhandled: ' + s)
      }
    }

    if (tree[2].length > 1 && /^\s*$/.test(tree[2][0])) {
      tree[2].shift()
    }

    if (tree[2].length > 2
    || (tree[2].length === 2 && /\S/.test(tree[2][1]))) {
      if (opts.createFragment) return opts.createFragment(tree[2])
      throw new Error(
        'multiple root elements must be wrapped in an enclosing tag'
      )
    }
    if (Array.isArray(tree[2][0]) && typeof tree[2][0][0] === 'string'
    && Array.isArray(tree[2][0][2])) {
      tree[2][0] = h(tree[2][0][0], tree[2][0][1], tree[2][0][2])
    }
    return tree[2][0]

    function parse (str) {
      var res = []
      if (state === ATTR_VALUE_W) state = ATTR
      for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i)
        if (state === TEXT && c === '<') {
          if (reg.length) res.push([TEXT, reg])
          reg = ''
          state = OPEN
        } else if (c === '>' && !quot(state) && state !== COMMENT) {
          if (state === OPEN && reg.length) {
            res.push([OPEN,reg])
          } else if (state === ATTR_KEY) {
            res.push([ATTR_KEY,reg])
          } else if (state === ATTR_VALUE && reg.length) {
            res.push([ATTR_VALUE,reg])
          }
          res.push([CLOSE])
          reg = ''
          state = TEXT
        } else if (state === COMMENT && /-$/.test(reg) && c === '-') {
          if (opts.comments) {
            res.push([ATTR_VALUE,reg.substr(0, reg.length - 1)])
          }
          reg = ''
          state = TEXT
        } else if (state === OPEN && /^!--$/.test(reg)) {
          if (opts.comments) {
            res.push([OPEN, reg],[ATTR_KEY,'comment'],[ATTR_EQ])
          }
          reg = c
          state = COMMENT
        } else if (state === TEXT || state === COMMENT) {
          reg += c
        } else if (state === OPEN && c === '/' && reg.length) {
          // no-op, self closing tag without a space <br/>
        } else if (state === OPEN && /\s/.test(c)) {
          if (reg.length) {
            res.push([OPEN, reg])
          }
          reg = ''
          state = ATTR
        } else if (state === OPEN) {
          reg += c
        } else if (state === ATTR && /[^\s"'=/]/.test(c)) {
          state = ATTR_KEY
          reg = c
        } else if (state === ATTR && /\s/.test(c)) {
          if (reg.length) res.push([ATTR_KEY,reg])
          res.push([ATTR_BREAK])
        } else if (state === ATTR_KEY && /\s/.test(c)) {
          res.push([ATTR_KEY,reg])
          reg = ''
          state = ATTR_KEY_W
        } else if (state === ATTR_KEY && c === '=') {
          res.push([ATTR_KEY,reg],[ATTR_EQ])
          reg = ''
          state = ATTR_VALUE_W
        } else if (state === ATTR_KEY) {
          reg += c
        } else if ((state === ATTR_KEY_W || state === ATTR) && c === '=') {
          res.push([ATTR_EQ])
          state = ATTR_VALUE_W
        } else if ((state === ATTR_KEY_W || state === ATTR) && !/\s/.test(c)) {
          res.push([ATTR_BREAK])
          if (/[\w-]/.test(c)) {
            reg += c
            state = ATTR_KEY
          } else state = ATTR
        } else if (state === ATTR_VALUE_W && c === '"') {
          state = ATTR_VALUE_DQ
        } else if (state === ATTR_VALUE_W && c === "'") {
          state = ATTR_VALUE_SQ
        } else if (state === ATTR_VALUE_DQ && c === '"') {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_SQ && c === "'") {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE_W && !/\s/.test(c)) {
          state = ATTR_VALUE
          i--
        } else if (state === ATTR_VALUE && /\s/.test(c)) {
          res.push([ATTR_VALUE,reg],[ATTR_BREAK])
          reg = ''
          state = ATTR
        } else if (state === ATTR_VALUE || state === ATTR_VALUE_SQ
        || state === ATTR_VALUE_DQ) {
          reg += c
        }
      }
      if (state === TEXT && reg.length) {
        res.push([TEXT,reg])
        reg = ''
      } else if (state === ATTR_VALUE && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_DQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_VALUE_SQ && reg.length) {
        res.push([ATTR_VALUE,reg])
        reg = ''
      } else if (state === ATTR_KEY) {
        res.push([ATTR_KEY,reg])
        reg = ''
      }
      return res
    }
  }

  function strfn (x) {
    if (typeof x === 'function') return x
    else if (typeof x === 'string') return x
    else if (x && typeof x === 'object') return x
    else if (x === null || x === undefined) return x
    else return concat('', x)
  }
}

function quot (state) {
  return state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ
}

var closeRE = RegExp('^(' + [
  'area', 'base', 'basefont', 'bgsound', 'br', 'col', 'command', 'embed',
  'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param',
  'source', 'track', 'wbr', '!--',
  // SVG TAGS
  'animate', 'animateTransform', 'circle', 'cursor', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
  'feTurbulence', 'font-face-format', 'font-face-name', 'font-face-uri',
  'glyph', 'glyphRef', 'hkern', 'image', 'line', 'missing-glyph', 'mpath',
  'path', 'polygon', 'polyline', 'rect', 'set', 'stop', 'tref', 'use', 'view',
  'vkern'
].join('|') + ')(?:[\.#][a-zA-Z0-9\u007F-\uFFFF_:-]+)*$')
function selfClosing (tag) { return closeRE.test(tag) }

},{"hyperscript-attribute-to-property":6}],8:[function(require,module,exports){
assert.notEqual = notEqual
assert.notOk = notOk
assert.equal = equal
assert.ok = assert

module.exports = assert

function equal (a, b, m) {
  assert(a == b, m) // eslint-disable-line eqeqeq
}

function notEqual (a, b, m) {
  assert(a != b, m) // eslint-disable-line eqeqeq
}

function notOk (t, m) {
  assert(!t, m)
}

function assert (t, m) {
  if (!t) throw new Error(m || 'AssertionError')
}

},{}],9:[function(require,module,exports){
var splice = require('remove-array-items')
var nanotiming = require('nanotiming')
var assert = require('assert')

module.exports = Nanobus

function Nanobus (name) {
  if (!(this instanceof Nanobus)) return new Nanobus(name)

  this._name = name || 'nanobus'
  this._starListeners = []
  this._listeners = {}
}

Nanobus.prototype.emit = function (eventName) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.emit: eventName should be type string or symbol')

  var data = []
  for (var i = 1, len = arguments.length; i < len; i++) {
    data.push(arguments[i])
  }

  var emitTiming = nanotiming(this._name + "('" + eventName.toString() + "')")
  var listeners = this._listeners[eventName]
  if (listeners && listeners.length > 0) {
    this._emit(this._listeners[eventName], data)
  }

  if (this._starListeners.length > 0) {
    this._emit(this._starListeners, eventName, data, emitTiming.uuid)
  }
  emitTiming()

  return this
}

Nanobus.prototype.on = Nanobus.prototype.addListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.on: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.on: listener should be type function')

  if (eventName === '*') {
    this._starListeners.push(listener)
  } else {
    if (!this._listeners[eventName]) this._listeners[eventName] = []
    this._listeners[eventName].push(listener)
  }
  return this
}

Nanobus.prototype.prependListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.prependListener: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.prependListener: listener should be type function')

  if (eventName === '*') {
    this._starListeners.unshift(listener)
  } else {
    if (!this._listeners[eventName]) this._listeners[eventName] = []
    this._listeners[eventName].unshift(listener)
  }
  return this
}

Nanobus.prototype.once = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.once: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.once: listener should be type function')

  var self = this
  this.on(eventName, once)
  function once () {
    listener.apply(self, arguments)
    self.removeListener(eventName, once)
  }
  return this
}

Nanobus.prototype.prependOnceListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.prependOnceListener: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.prependOnceListener: listener should be type function')

  var self = this
  this.prependListener(eventName, once)
  function once () {
    listener.apply(self, arguments)
    self.removeListener(eventName, once)
  }
  return this
}

Nanobus.prototype.removeListener = function (eventName, listener) {
  assert.ok(typeof eventName === 'string' || typeof eventName === 'symbol', 'nanobus.removeListener: eventName should be type string or symbol')
  assert.equal(typeof listener, 'function', 'nanobus.removeListener: listener should be type function')

  if (eventName === '*') {
    this._starListeners = this._starListeners.slice()
    return remove(this._starListeners, listener)
  } else {
    if (typeof this._listeners[eventName] !== 'undefined') {
      this._listeners[eventName] = this._listeners[eventName].slice()
    }

    return remove(this._listeners[eventName], listener)
  }

  function remove (arr, listener) {
    if (!arr) return
    var index = arr.indexOf(listener)
    if (index !== -1) {
      splice(arr, index, 1)
      return true
    }
  }
}

Nanobus.prototype.removeAllListeners = function (eventName) {
  if (eventName) {
    if (eventName === '*') {
      this._starListeners = []
    } else {
      this._listeners[eventName] = []
    }
  } else {
    this._starListeners = []
    this._listeners = {}
  }
  return this
}

Nanobus.prototype.listeners = function (eventName) {
  var listeners = eventName !== '*'
    ? this._listeners[eventName]
    : this._starListeners

  var ret = []
  if (listeners) {
    var ilength = listeners.length
    for (var i = 0; i < ilength; i++) ret.push(listeners[i])
  }
  return ret
}

Nanobus.prototype._emit = function (arr, eventName, data, uuid) {
  if (typeof arr === 'undefined') return
  if (arr.length === 0) return
  if (data === undefined) {
    data = eventName
    eventName = null
  }

  if (eventName) {
    if (uuid !== undefined) {
      data = [eventName].concat(data, uuid)
    } else {
      data = [eventName].concat(data)
    }
  }

  var length = arr.length
  for (var i = 0; i < length; i++) {
    var listener = arr[i]
    listener.apply(listener, data)
  }
}

},{"assert":8,"nanotiming":25,"remove-array-items":26}],10:[function(require,module,exports){
var assert = require('assert')

var safeExternalLink = /(noopener|noreferrer) (noopener|noreferrer)/
var protocolLink = /^[\w-_]+:/

module.exports = href

function href (cb, root) {
  assert.notEqual(typeof window, 'undefined', 'nanohref: expected window to exist')

  root = root || window.document

  assert.equal(typeof cb, 'function', 'nanohref: cb should be type function')
  assert.equal(typeof root, 'object', 'nanohref: root should be type object')

  window.addEventListener('click', function (e) {
    if ((e.button && e.button !== 0) ||
      e.ctrlKey || e.metaKey || e.altKey || e.shiftKey ||
      e.defaultPrevented) return

    var anchor = (function traverse (node) {
      if (!node || node === root) return
      if (node.localName !== 'a' || node.href === undefined) {
        return traverse(node.parentNode)
      }
      return node
    })(e.target)

    if (!anchor) return

    if (window.location.protocol !== anchor.protocol ||
        window.location.hostname !== anchor.hostname ||
        window.location.port !== anchor.port ||
      anchor.hasAttribute('data-nanohref-ignore') ||
      anchor.hasAttribute('download') ||
      (anchor.getAttribute('target') === '_blank' &&
        safeExternalLink.test(anchor.getAttribute('rel'))) ||
      protocolLink.test(anchor.getAttribute('href'))) return

    e.preventDefault()
    cb(anchor)
  })
}

},{"assert":8}],11:[function(require,module,exports){
'use strict'

var trailingNewlineRegex = /\n[\s]+$/
var leadingNewlineRegex = /^\n[\s]+/
var trailingSpaceRegex = /[\s]+$/
var leadingSpaceRegex = /^[\s]+/
var multiSpaceRegex = /[\n\s]+/g

var TEXT_TAGS = [
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'data', 'dfn', 'em', 'i',
  'kbd', 'mark', 'q', 'rp', 'rt', 'rtc', 'ruby', 's', 'amp', 'small', 'span',
  'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr'
]

var VERBATIM_TAGS = [
  'code', 'pre', 'textarea'
]

module.exports = function appendChild (el, childs) {
  if (!Array.isArray(childs)) return

  var nodeName = el.nodeName.toLowerCase()

  var hadText = false
  var value, leader

  for (var i = 0, len = childs.length; i < len; i++) {
    var node = childs[i]
    if (Array.isArray(node)) {
      appendChild(el, node)
      continue
    }

    if (typeof node === 'number' ||
      typeof node === 'boolean' ||
      typeof node === 'function' ||
      node instanceof Date ||
      node instanceof RegExp) {
      node = node.toString()
    }

    var lastChild = el.childNodes[el.childNodes.length - 1]

    // Iterate over text nodes
    if (typeof node === 'string') {
      hadText = true

      // If we already had text, append to the existing text
      if (lastChild && lastChild.nodeName === '#text') {
        lastChild.nodeValue += node

      // We didn't have a text node yet, create one
      } else {
        node = el.ownerDocument.createTextNode(node)
        el.appendChild(node)
        lastChild = node
      }

      // If this is the last of the child nodes, make sure we close it out
      // right
      if (i === len - 1) {
        hadText = false
        // Trim the child text nodes if the current node isn't a
        // node where whitespace matters.
        if (TEXT_TAGS.indexOf(nodeName) === -1 &&
          VERBATIM_TAGS.indexOf(nodeName) === -1) {
          value = lastChild.nodeValue
            .replace(leadingNewlineRegex, '')
            .replace(trailingSpaceRegex, '')
            .replace(trailingNewlineRegex, '')
            .replace(multiSpaceRegex, ' ')
          if (value === '') {
            el.removeChild(lastChild)
          } else {
            lastChild.nodeValue = value
          }
        } else if (VERBATIM_TAGS.indexOf(nodeName) === -1) {
          // The very first node in the list should not have leading
          // whitespace. Sibling text nodes should have whitespace if there
          // was any.
          leader = i === 0 ? '' : ' '
          value = lastChild.nodeValue
            .replace(leadingNewlineRegex, leader)
            .replace(leadingSpaceRegex, ' ')
            .replace(trailingSpaceRegex, '')
            .replace(trailingNewlineRegex, '')
            .replace(multiSpaceRegex, ' ')
          lastChild.nodeValue = value
        }
      }

    // Iterate over DOM nodes
    } else if (node && node.nodeType) {
      // If the last node was a text node, make sure it is properly closed out
      if (hadText) {
        hadText = false

        // Trim the child text nodes if the current node isn't a
        // text node or a code node
        if (TEXT_TAGS.indexOf(nodeName) === -1 &&
          VERBATIM_TAGS.indexOf(nodeName) === -1) {
          value = lastChild.nodeValue
            .replace(leadingNewlineRegex, '')
            .replace(trailingNewlineRegex, ' ')
            .replace(multiSpaceRegex, ' ')

          // Remove empty text nodes, append otherwise
          if (value === '') {
            el.removeChild(lastChild)
          } else {
            lastChild.nodeValue = value
          }
        // Trim the child nodes but preserve the appropriate whitespace
        } else if (VERBATIM_TAGS.indexOf(nodeName) === -1) {
          value = lastChild.nodeValue
            .replace(leadingSpaceRegex, ' ')
            .replace(leadingNewlineRegex, '')
            .replace(trailingNewlineRegex, ' ')
            .replace(multiSpaceRegex, ' ')
          lastChild.nodeValue = value
        }
      }

      // Store the last nodename
      var _nodeName = node.nodeName
      if (_nodeName) nodeName = _nodeName.toLowerCase()

      // Append the node to the DOM
      el.appendChild(node)
    }
  }
}

},{}],12:[function(require,module,exports){
'use strict'

module.exports = [
  'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default',
  'defaultchecked', 'defer', 'disabled', 'formnovalidate', 'hidden',
  'ismap', 'loop', 'multiple', 'muted', 'novalidate', 'open', 'playsinline',
  'readonly', 'required', 'reversed', 'selected'
]

},{}],13:[function(require,module,exports){
module.exports = require('./dom')(document)

},{"./dom":15}],14:[function(require,module,exports){
'use strict'

module.exports = [
  'indeterminate'
]

},{}],15:[function(require,module,exports){
'use strict'

var hyperx = require('hyperx')
var appendChild = require('./append-child')
var SVG_TAGS = require('./svg-tags')
var BOOL_PROPS = require('./bool-props')
// Props that need to be set directly rather than with el.setAttribute()
var DIRECT_PROPS = require('./direct-props')

var SVGNS = 'http://www.w3.org/2000/svg'
var XLINKNS = 'http://www.w3.org/1999/xlink'

var COMMENT_TAG = '!--'

module.exports = function (document) {
  function nanoHtmlCreateElement (tag, props, children) {
    var el

    // If an svg tag, it needs a namespace
    if (SVG_TAGS.indexOf(tag) !== -1) {
      props.namespace = SVGNS
    }

    // If we are using a namespace
    var ns = false
    if (props.namespace) {
      ns = props.namespace
      delete props.namespace
    }

    // If we are extending a builtin element
    var isCustomElement = false
    if (props.is) {
      isCustomElement = props.is
      delete props.is
    }

    // Create the element
    if (ns) {
      if (isCustomElement) {
        el = document.createElementNS(ns, tag, { is: isCustomElement })
      } else {
        el = document.createElementNS(ns, tag)
      }
    } else if (tag === COMMENT_TAG) {
      return document.createComment(props.comment)
    } else if (isCustomElement) {
      el = document.createElement(tag, { is: isCustomElement })
    } else {
      el = document.createElement(tag)
    }

    // Create the properties
    for (var p in props) {
      if (props.hasOwnProperty(p)) {
        var key = p.toLowerCase()
        var val = props[p]
        // Normalize className
        if (key === 'classname') {
          key = 'class'
          p = 'class'
        }
        // The for attribute gets transformed to htmlFor, but we just set as for
        if (p === 'htmlFor') {
          p = 'for'
        }
        // If a property is boolean, set itself to the key
        if (BOOL_PROPS.indexOf(key) !== -1) {
          if (String(val) === 'true') val = key
          else if (String(val) === 'false') continue
        }
        // If a property prefers being set directly vs setAttribute
        if (key.slice(0, 2) === 'on' || DIRECT_PROPS.indexOf(key) !== -1) {
          el[p] = val
        } else {
          if (ns) {
            if (p === 'xlink:href') {
              el.setAttributeNS(XLINKNS, p, val)
            } else if (/^xmlns($|:)/i.test(p)) {
              // skip xmlns definitions
            } else {
              el.setAttributeNS(null, p, val)
            }
          } else {
            el.setAttribute(p, val)
          }
        }
      }
    }

    appendChild(el, children)
    return el
  }

  function createFragment (nodes) {
    var fragment = document.createDocumentFragment()
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] == null) continue
      if (Array.isArray(nodes[i])) {
        fragment.appendChild(createFragment(nodes[i]))
      } else {
        if (typeof nodes[i] === 'string') nodes[i] = document.createTextNode(nodes[i])
        fragment.appendChild(nodes[i])
      }
    }
    return fragment
  }

  var exports = hyperx(nanoHtmlCreateElement, {
    comments: true,
    createFragment: createFragment
  })
  exports.default = exports
  exports.createComment = nanoHtmlCreateElement
  return exports
}

},{"./append-child":11,"./bool-props":12,"./direct-props":14,"./svg-tags":16,"hyperx":7}],16:[function(require,module,exports){
'use strict'

module.exports = [
  'svg', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
  'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood',
  'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage',
  'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight',
  'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter',
  'font', 'font-face', 'font-face-format', 'font-face-name', 'font-face-src',
  'font-face-uri', 'foreignObject', 'g', 'glyph', 'glyphRef', 'hkern', 'image',
  'line', 'linearGradient', 'marker', 'mask', 'metadata', 'missing-glyph',
  'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect',
  'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'title', 'tref',
  'tspan', 'use', 'view', 'vkern'
]

},{}],17:[function(require,module,exports){
module.exports = LRU

function LRU (opts) {
  if (!(this instanceof LRU)) return new LRU(opts)
  if (typeof opts === 'number') opts = {max: opts}
  if (!opts) opts = {}
  this.cache = {}
  this.head = this.tail = null
  this.length = 0
  this.max = opts.max || 1000
  this.maxAge = opts.maxAge || 0
}

Object.defineProperty(LRU.prototype, 'keys', {
  get: function () { return Object.keys(this.cache) }
})

LRU.prototype.clear = function () {
  this.cache = {}
  this.head = this.tail = null
  this.length = 0
}

LRU.prototype.remove = function (key) {
  if (typeof key !== 'string') key = '' + key
  if (!this.cache.hasOwnProperty(key)) return

  var element = this.cache[key]
  delete this.cache[key]
  this._unlink(key, element.prev, element.next)
  return element.value
}

LRU.prototype._unlink = function (key, prev, next) {
  this.length--

  if (this.length === 0) {
    this.head = this.tail = null
  } else {
    if (this.head === key) {
      this.head = prev
      this.cache[this.head].next = null
    } else if (this.tail === key) {
      this.tail = next
      this.cache[this.tail].prev = null
    } else {
      this.cache[prev].next = next
      this.cache[next].prev = prev
    }
  }
}

LRU.prototype.peek = function (key) {
  if (!this.cache.hasOwnProperty(key)) return

  var element = this.cache[key]

  if (!this._checkAge(key, element)) return
  return element.value
}

LRU.prototype.set = function (key, value) {
  if (typeof key !== 'string') key = '' + key

  var element

  if (this.cache.hasOwnProperty(key)) {
    element = this.cache[key]
    element.value = value
    if (this.maxAge) element.modified = Date.now()

    // If it's already the head, there's nothing more to do:
    if (key === this.head) return value
    this._unlink(key, element.prev, element.next)
  } else {
    element = {value: value, modified: 0, next: null, prev: null}
    if (this.maxAge) element.modified = Date.now()
    this.cache[key] = element

    // Eviction is only possible if the key didn't already exist:
    if (this.length === this.max) this.evict()
  }

  this.length++
  element.next = null
  element.prev = this.head

  if (this.head) this.cache[this.head].next = key
  this.head = key

  if (!this.tail) this.tail = key
  return value
}

LRU.prototype._checkAge = function (key, element) {
  if (this.maxAge && (Date.now() - element.modified) > this.maxAge) {
    this.remove(key)
    return false
  }
  return true
}

LRU.prototype.get = function (key) {
  if (typeof key !== 'string') key = '' + key
  if (!this.cache.hasOwnProperty(key)) return

  var element = this.cache[key]

  if (!this._checkAge(key, element)) return

  if (this.head !== key) {
    if (key === this.tail) {
      this.tail = element.next
      this.cache[this.tail].prev = null
    } else {
      // Set prev.next -> element.next:
      this.cache[element.prev].next = element.next
    }

    // Set element.next.prev -> element.prev:
    this.cache[element.next].prev = element.prev

    // Element is the new head
    this.cache[this.head].next = key
    element.prev = this.head
    element.next = null
    this.head = key
  }

  return element.value
}

LRU.prototype.evict = function () {
  if (!this.tail) return
  this.remove(this.tail)
}

},{}],18:[function(require,module,exports){
var assert = require('nanoassert')
var morph = require('./lib/morph')

var TEXT_NODE = 3
// var DEBUG = false

module.exports = nanomorph

// Morph one tree into another tree
//
// no parent
//   -> same: diff and walk children
//   -> not same: replace and return
// old node doesn't exist
//   -> insert new node
// new node doesn't exist
//   -> delete old node
// nodes are not the same
//   -> diff nodes and apply patch to old node
// nodes are the same
//   -> walk all child nodes and append to old node
function nanomorph (oldTree, newTree, options) {
  // if (DEBUG) {
  //   console.log(
  //   'nanomorph\nold\n  %s\nnew\n  %s',
  //   oldTree && oldTree.outerHTML,
  //   newTree && newTree.outerHTML
  // )
  // }
  assert.equal(typeof oldTree, 'object', 'nanomorph: oldTree should be an object')
  assert.equal(typeof newTree, 'object', 'nanomorph: newTree should be an object')

  if (options && options.childrenOnly) {
    updateChildren(newTree, oldTree)
    return oldTree
  }

  assert.notEqual(
    newTree.nodeType,
    11,
    'nanomorph: newTree should have one root node (which is not a DocumentFragment)'
  )

  return walk(newTree, oldTree)
}

// Walk and morph a dom tree
function walk (newNode, oldNode) {
  // if (DEBUG) {
  //   console.log(
  //   'walk\nold\n  %s\nnew\n  %s',
  //   oldNode && oldNode.outerHTML,
  //   newNode && newNode.outerHTML
  // )
  // }
  if (!oldNode) {
    return newNode
  } else if (!newNode) {
    return null
  } else if (newNode.isSameNode && newNode.isSameNode(oldNode)) {
    return oldNode
  } else if (newNode.tagName !== oldNode.tagName || getComponentId(newNode) !== getComponentId(oldNode)) {
    return newNode
  } else {
    morph(newNode, oldNode)
    updateChildren(newNode, oldNode)
    return oldNode
  }
}

function getComponentId (node) {
  return node.dataset ? node.dataset.nanomorphComponentId : undefined
}

// Update the children of elements
// (obj, obj) -> null
function updateChildren (newNode, oldNode) {
  // if (DEBUG) {
  //   console.log(
  //   'updateChildren\nold\n  %s\nnew\n  %s',
  //   oldNode && oldNode.outerHTML,
  //   newNode && newNode.outerHTML
  // )
  // }
  var oldChild, newChild, morphed, oldMatch

  // The offset is only ever increased, and used for [i - offset] in the loop
  var offset = 0

  for (var i = 0; ; i++) {
    oldChild = oldNode.childNodes[i]
    newChild = newNode.childNodes[i - offset]
    // if (DEBUG) {
    //   console.log(
    //   '===\n- old\n  %s\n- new\n  %s',
    //   oldChild && oldChild.outerHTML,
    //   newChild && newChild.outerHTML
    // )
    // }
    // Both nodes are empty, do nothing
    if (!oldChild && !newChild) {
      break

    // There is no new child, remove old
    } else if (!newChild) {
      oldNode.removeChild(oldChild)
      i--

    // There is no old child, add new
    } else if (!oldChild) {
      oldNode.appendChild(newChild)
      offset++

    // Both nodes are the same, morph
    } else if (same(newChild, oldChild)) {
      morphed = walk(newChild, oldChild)
      if (morphed !== oldChild) {
        oldNode.replaceChild(morphed, oldChild)
        offset++
      }

    // Both nodes do not share an ID or a placeholder, try reorder
    } else {
      oldMatch = null

      // Try and find a similar node somewhere in the tree
      for (var j = i; j < oldNode.childNodes.length; j++) {
        if (same(oldNode.childNodes[j], newChild)) {
          oldMatch = oldNode.childNodes[j]
          break
        }
      }

      // If there was a node with the same ID or placeholder in the old list
      if (oldMatch) {
        morphed = walk(newChild, oldMatch)
        if (morphed !== oldMatch) offset++
        oldNode.insertBefore(morphed, oldChild)

      // It's safe to morph two nodes in-place if neither has an ID
      } else if (!newChild.id && !oldChild.id) {
        morphed = walk(newChild, oldChild)
        if (morphed !== oldChild) {
          oldNode.replaceChild(morphed, oldChild)
          offset++
        }

      // Insert the node at the index if we couldn't morph or find a matching node
      } else {
        oldNode.insertBefore(newChild, oldChild)
        offset++
      }
    }
  }
}

function same (a, b) {
  if (a.id) return a.id === b.id
  if (a.isSameNode) return a.isSameNode(b)
  if (a.tagName !== b.tagName) return false
  if (a.type === TEXT_NODE) return a.nodeValue === b.nodeValue
  return false
}

},{"./lib/morph":20,"nanoassert":8}],19:[function(require,module,exports){
module.exports = [
  // attribute events (can be set with attributes)
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'onmouseenter',
  'onmouseleave',
  'ontouchcancel',
  'ontouchend',
  'ontouchmove',
  'ontouchstart',
  'ondragstart',
  'ondrag',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondrop',
  'ondragend',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onunload',
  'onabort',
  'onerror',
  'onresize',
  'onscroll',
  'onselect',
  'onchange',
  'onsubmit',
  'onreset',
  'onfocus',
  'onblur',
  'oninput',
  'onanimationend',
  'onanimationiteration',
  'onanimationstart',
  // other common events
  'oncontextmenu',
  'onfocusin',
  'onfocusout'
]

},{}],20:[function(require,module,exports){
var events = require('./events')
var eventsLength = events.length

var ELEMENT_NODE = 1
var TEXT_NODE = 3
var COMMENT_NODE = 8

module.exports = morph

// diff elements and apply the resulting patch to the old node
// (obj, obj) -> null
function morph (newNode, oldNode) {
  var nodeType = newNode.nodeType
  var nodeName = newNode.nodeName

  if (nodeType === ELEMENT_NODE) {
    copyAttrs(newNode, oldNode)
  }

  if (nodeType === TEXT_NODE || nodeType === COMMENT_NODE) {
    if (oldNode.nodeValue !== newNode.nodeValue) {
      oldNode.nodeValue = newNode.nodeValue
    }
  }

  // Some DOM nodes are weird
  // https://github.com/patrick-steele-idem/morphdom/blob/master/src/specialElHandlers.js
  if (nodeName === 'INPUT') updateInput(newNode, oldNode)
  else if (nodeName === 'OPTION') updateOption(newNode, oldNode)
  else if (nodeName === 'TEXTAREA') updateTextarea(newNode, oldNode)

  copyEvents(newNode, oldNode)
}

function copyAttrs (newNode, oldNode) {
  var oldAttrs = oldNode.attributes
  var newAttrs = newNode.attributes
  var attrNamespaceURI = null
  var attrValue = null
  var fromValue = null
  var attrName = null
  var attr = null

  for (var i = newAttrs.length - 1; i >= 0; --i) {
    attr = newAttrs[i]
    attrName = attr.name
    attrNamespaceURI = attr.namespaceURI
    attrValue = attr.value
    if (attrNamespaceURI) {
      attrName = attr.localName || attrName
      fromValue = oldNode.getAttributeNS(attrNamespaceURI, attrName)
      if (fromValue !== attrValue) {
        oldNode.setAttributeNS(attrNamespaceURI, attrName, attrValue)
      }
    } else {
      if (!oldNode.hasAttribute(attrName)) {
        oldNode.setAttribute(attrName, attrValue)
      } else {
        fromValue = oldNode.getAttribute(attrName)
        if (fromValue !== attrValue) {
          // apparently values are always cast to strings, ah well
          if (attrValue === 'null' || attrValue === 'undefined') {
            oldNode.removeAttribute(attrName)
          } else {
            oldNode.setAttribute(attrName, attrValue)
          }
        }
      }
    }
  }

  // Remove any extra attributes found on the original DOM element that
  // weren't found on the target element.
  for (var j = oldAttrs.length - 1; j >= 0; --j) {
    attr = oldAttrs[j]
    if (attr.specified !== false) {
      attrName = attr.name
      attrNamespaceURI = attr.namespaceURI

      if (attrNamespaceURI) {
        attrName = attr.localName || attrName
        if (!newNode.hasAttributeNS(attrNamespaceURI, attrName)) {
          oldNode.removeAttributeNS(attrNamespaceURI, attrName)
        }
      } else {
        if (!newNode.hasAttributeNS(null, attrName)) {
          oldNode.removeAttribute(attrName)
        }
      }
    }
  }
}

function copyEvents (newNode, oldNode) {
  for (var i = 0; i < eventsLength; i++) {
    var ev = events[i]
    if (newNode[ev]) {           // if new element has a whitelisted attribute
      oldNode[ev] = newNode[ev]  // update existing element
    } else if (oldNode[ev]) {    // if existing element has it and new one doesnt
      oldNode[ev] = undefined    // remove it from existing element
    }
  }
}

function updateOption (newNode, oldNode) {
  updateAttribute(newNode, oldNode, 'selected')
}

// The "value" attribute is special for the <input> element since it sets the
// initial value. Changing the "value" attribute without changing the "value"
// property will have no effect since it is only used to the set the initial
// value. Similar for the "checked" attribute, and "disabled".
function updateInput (newNode, oldNode) {
  var newValue = newNode.value
  var oldValue = oldNode.value

  updateAttribute(newNode, oldNode, 'checked')
  updateAttribute(newNode, oldNode, 'disabled')

  // The "indeterminate" property can not be set using an HTML attribute.
  // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox
  if (newNode.indeterminate !== oldNode.indeterminate) {
    oldNode.indeterminate = newNode.indeterminate
  }

  // Persist file value since file inputs can't be changed programatically
  if (oldNode.type === 'file') return

  if (newValue !== oldValue) {
    oldNode.setAttribute('value', newValue)
    oldNode.value = newValue
  }

  if (newValue === 'null') {
    oldNode.value = ''
    oldNode.removeAttribute('value')
  }

  if (!newNode.hasAttributeNS(null, 'value')) {
    oldNode.removeAttribute('value')
  } else if (oldNode.type === 'range') {
    // this is so elements like slider move their UI thingy
    oldNode.value = newValue
  }
}

function updateTextarea (newNode, oldNode) {
  var newValue = newNode.value
  if (newValue !== oldNode.value) {
    oldNode.value = newValue
  }

  if (oldNode.firstChild && oldNode.firstChild.nodeValue !== newValue) {
    // Needed for IE. Apparently IE sets the placeholder as the
    // node value and vise versa. This ignores an empty update.
    if (newValue === '' && oldNode.firstChild.nodeValue === oldNode.placeholder) {
      return
    }

    oldNode.firstChild.nodeValue = newValue
  }
}

function updateAttribute (newNode, oldNode, name) {
  if (newNode[name] !== oldNode[name]) {
    oldNode[name] = newNode[name]
    if (newNode[name]) {
      oldNode.setAttribute(name, '')
    } else {
      oldNode.removeAttribute(name)
    }
  }
}

},{"./events":19}],21:[function(require,module,exports){
var reg = /([^?=&]+)(=([^&]*))?/g
var assert = require('assert')

module.exports = qs

function qs (url) {
  assert.equal(typeof url, 'string', 'nanoquery: url should be type string')

  var obj = {}
  url.replace(/^.*\?/, '').replace(reg, function (a0, a1, a2, a3) {
    var value = decodeURIComponent(a3)
    var key = decodeURIComponent(a1)
    if (obj.hasOwnProperty(key)) {
      if (Array.isArray(obj[key])) obj[key].push(value)
      else obj[key] = [obj[key], value]
    } else {
      obj[key] = value
    }
  })

  return obj
}

},{"assert":8}],22:[function(require,module,exports){
'use strict'

var assert = require('assert')

module.exports = nanoraf

// Only call RAF when needed
// (fn, fn?) -> fn
function nanoraf (render, raf) {
  assert.equal(typeof render, 'function', 'nanoraf: render should be a function')
  assert.ok(typeof raf === 'function' || typeof raf === 'undefined', 'nanoraf: raf should be a function or undefined')

  if (!raf) raf = window.requestAnimationFrame
  var redrawScheduled = false
  var args = null

  return function frame () {
    if (args === null && !redrawScheduled) {
      redrawScheduled = true

      raf(function redraw () {
        redrawScheduled = false

        var length = args.length
        var _args = new Array(length)
        for (var i = 0; i < length; i++) _args[i] = args[i]

        render.apply(render, _args)
        args = null
      })
    }

    args = arguments
  }
}

},{"assert":8}],23:[function(require,module,exports){
var assert = require('assert')
var wayfarer = require('wayfarer')

// electron support
var isLocalFile = (/file:\/\//.test(
  typeof window === 'object' &&
  window.location &&
  window.location.origin
))

/* eslint-disable no-useless-escape */
var electron = '^(file:\/\/|\/)(.*\.html?\/?)?'
var protocol = '^(http(s)?(:\/\/))?(www\.)?'
var domain = '[a-zA-Z0-9-_\.]+(:[0-9]{1,5})?(\/{1})?'
var qs = '[\?].*$'
/* eslint-enable no-useless-escape */

var stripElectron = new RegExp(electron)
var prefix = new RegExp(protocol + domain)
var normalize = new RegExp('#')
var suffix = new RegExp(qs)

module.exports = Nanorouter

function Nanorouter (opts) {
  if (!(this instanceof Nanorouter)) return new Nanorouter(opts)
  opts = opts || {}
  this.router = wayfarer(opts.default || '/404')
}

Nanorouter.prototype.on = function (routename, listener) {
  assert.equal(typeof routename, 'string')
  routename = routename.replace(/^[#/]/, '')
  this.router.on(routename, listener)
}

Nanorouter.prototype.emit = function (routename) {
  assert.equal(typeof routename, 'string')
  routename = pathname(routename, isLocalFile)
  return this.router.emit(routename)
}

Nanorouter.prototype.match = function (routename) {
  assert.equal(typeof routename, 'string')
  routename = pathname(routename, isLocalFile)
  return this.router.match(routename)
}

// replace everything in a route but the pathname and hash
function pathname (routename, isElectron) {
  if (isElectron) routename = routename.replace(stripElectron, '')
  else routename = routename.replace(prefix, '')
  return decodeURI(routename.replace(suffix, '').replace(normalize, '/'))
}

},{"assert":8,"wayfarer":28}],24:[function(require,module,exports){
var assert = require('assert')

var hasWindow = typeof window !== 'undefined'

function createScheduler () {
  var scheduler
  if (hasWindow) {
    if (!window._nanoScheduler) window._nanoScheduler = new NanoScheduler(true)
    scheduler = window._nanoScheduler
  } else {
    scheduler = new NanoScheduler()
  }
  return scheduler
}

function NanoScheduler (hasWindow) {
  this.hasWindow = hasWindow
  this.hasIdle = this.hasWindow && window.requestIdleCallback
  this.method = this.hasIdle ? window.requestIdleCallback.bind(window) : this.setTimeout
  this.scheduled = false
  this.queue = []
}

NanoScheduler.prototype.push = function (cb) {
  assert.equal(typeof cb, 'function', 'nanoscheduler.push: cb should be type function')

  this.queue.push(cb)
  this.schedule()
}

NanoScheduler.prototype.schedule = function () {
  if (this.scheduled) return

  this.scheduled = true
  var self = this
  this.method(function (idleDeadline) {
    var cb
    while (self.queue.length && idleDeadline.timeRemaining() > 0) {
      cb = self.queue.shift()
      cb(idleDeadline)
    }
    self.scheduled = false
    if (self.queue.length) self.schedule()
  })
}

NanoScheduler.prototype.setTimeout = function (cb) {
  setTimeout(cb, 0, {
    timeRemaining: function () {
      return 1
    }
  })
}

module.exports = createScheduler

},{"assert":8}],25:[function(require,module,exports){
var scheduler = require('nanoscheduler')()
var assert = require('assert')

var perf
nanotiming.disabled = true
try {
  perf = window.performance
  nanotiming.disabled = window.localStorage.DISABLE_NANOTIMING === 'true' || !perf.mark
} catch (e) { }

module.exports = nanotiming

function nanotiming (name) {
  assert.equal(typeof name, 'string', 'nanotiming: name should be type string')

  if (nanotiming.disabled) return noop

  var uuid = (perf.now() * 10000).toFixed() % Number.MAX_SAFE_INTEGER
  var startName = 'start-' + uuid + '-' + name
  perf.mark(startName)

  function end (cb) {
    var endName = 'end-' + uuid + '-' + name
    perf.mark(endName)

    scheduler.push(function () {
      var err = null
      try {
        var measureName = name + ' [' + uuid + ']'
        perf.measure(measureName, startName, endName)
        perf.clearMarks(startName)
        perf.clearMarks(endName)
      } catch (e) { err = e }
      if (cb) cb(err, name)
    })
  }

  end.uuid = uuid
  return end
}

function noop (cb) {
  if (cb) {
    scheduler.push(function () {
      cb(new Error('nanotiming: performance API unavailable'))
    })
  }
}

},{"assert":8,"nanoscheduler":24}],26:[function(require,module,exports){
'use strict'

/**
 * Remove a range of items from an array
 *
 * @function removeItems
 * @param {Array<*>} arr The target array
 * @param {number} startIdx The index to begin removing from (inclusive)
 * @param {number} removeCount How many items to remove
 */
module.exports = function removeItems (arr, startIdx, removeCount) {
  var i, length = arr.length

  if (startIdx >= length || removeCount === 0) {
    return
  }

  removeCount = (startIdx + removeCount > length ? length - startIdx : removeCount)

  var len = length - removeCount

  for (i = startIdx; i < len; ++i) {
    arr[i] = arr[i + removeCount]
  }

  arr.length = len
}

},{}],27:[function(require,module,exports){
module.exports = scrollToAnchor

function scrollToAnchor (anchor, options) {
  if (anchor) {
    try {
      var el = document.querySelector(anchor)
      if (el) el.scrollIntoView(options)
    } catch (e) {}
  }
}

},{}],28:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var assert = require('assert')
var trie = require('./trie')

module.exports = Wayfarer

// create a router
// str -> obj
function Wayfarer (dft) {
  if (!(this instanceof Wayfarer)) return new Wayfarer(dft)

  var _default = (dft || '').replace(/^\//, '')
  var _trie = trie()

  emit._trie = _trie
  emit.on = on
  emit.emit = emit
  emit.match = match
  emit._wayfarer = true

  return emit

  // define a route
  // (str, fn) -> obj
  function on (route, cb) {
    assert.equal(typeof route, 'string')
    assert.equal(typeof cb, 'function')

    route = route || '/'

    if (cb._wayfarer && cb._trie) {
      _trie.mount(route, cb._trie.trie)
    } else {
      var node = _trie.create(route)
      node.cb = cb
      node.route = route
    }

    return emit
  }

  // match and call a route
  // (str, obj?) -> null
  function emit (route) {
    var matched = match(route)

    var args = new Array(arguments.length)
    args[0] = matched.params
    for (var i = 1; i < args.length; i++) {
      args[i] = arguments[i]
    }

    return matched.cb.apply(matched.cb, args)
  }

  function match (route) {
    assert.notEqual(route, undefined, "'route' must be defined")

    var matched = _trie.match(route)
    if (matched && matched.cb) return new Route(matched)

    var dft = _trie.match(_default)
    if (dft && dft.cb) return new Route(dft)

    throw new Error("route '" + route + "' did not match")
  }

  function Route (matched) {
    this.cb = matched.cb
    this.route = matched.route
    this.params = matched.params
  }
}

},{"./trie":29,"assert":8}],29:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var assert = require('assert')

module.exports = Trie

// create a new trie
// null -> obj
function Trie () {
  if (!(this instanceof Trie)) return new Trie()
  this.trie = { nodes: {} }
}

// create a node on the trie at route
// and return a node
// str -> obj
Trie.prototype.create = function (route) {
  assert.equal(typeof route, 'string', 'route should be a string')
  // strip leading '/' and split routes
  var routes = route.replace(/^\//, '').split('/')

  function createNode (index, trie) {
    var thisRoute = (has(routes, index) && routes[index])
    if (thisRoute === false) return trie

    var node = null
    if (/^:|^\*/.test(thisRoute)) {
      // if node is a name match, set name and append to ':' node
      if (!has(trie.nodes, '$$')) {
        node = { nodes: {} }
        trie.nodes.$$ = node
      } else {
        node = trie.nodes.$$
      }

      if (thisRoute[0] === '*') {
        trie.wildcard = true
      }

      trie.name = thisRoute.replace(/^:|^\*/, '')
    } else if (!has(trie.nodes, thisRoute)) {
      node = { nodes: {} }
      trie.nodes[thisRoute] = node
    } else {
      node = trie.nodes[thisRoute]
    }

    // we must recurse deeper
    return createNode(index + 1, node)
  }

  return createNode(0, this.trie)
}

// match a route on the trie
// and return the node
// str -> obj
Trie.prototype.match = function (route) {
  assert.equal(typeof route, 'string', 'route should be a string')

  var routes = route.replace(/^\//, '').split('/')
  var params = {}

  function search (index, trie) {
    // either there's no match, or we're done searching
    if (trie === undefined) return undefined
    var thisRoute = routes[index]
    if (thisRoute === undefined) return trie

    if (has(trie.nodes, thisRoute)) {
      // match regular routes first
      return search(index + 1, trie.nodes[thisRoute])
    } else if (trie.name) {
      // match named routes
      try {
        params[trie.name] = decodeURIComponent(thisRoute)
      } catch (e) {
        return search(index, undefined)
      }
      return search(index + 1, trie.nodes.$$)
    } else if (trie.wildcard) {
      // match wildcards
      try {
        params.wildcard = decodeURIComponent(routes.slice(index).join('/'))
      } catch (e) {
        return search(index, undefined)
      }
      // return early, or else search may keep recursing through the wildcard
      return trie.nodes.$$
    } else {
      // no matches found
      return search(index + 1)
    }
  }

  var node = search(0, this.trie)

  if (!node) return undefined
  node = Object.assign({}, node)
  node.params = params
  return node
}

// mount a trie onto a node at route
// (str, obj) -> null
Trie.prototype.mount = function (route, trie) {
  assert.equal(typeof route, 'string', 'route should be a string')
  assert.equal(typeof trie, 'object', 'trie should be a object')

  var split = route.replace(/^\//, '').split('/')
  var node = null
  var key = null

  if (split.length === 1) {
    key = split[0]
    node = this.create(key)
  } else {
    var head = split.join('/')
    key = split[0]
    node = this.create(head)
  }

  Object.assign(node.nodes, trie.nodes)
  if (trie.name) node.name = trie.name

  // delegate properties from '/' to the new node
  // '/' cannot be reached once mounted
  if (node.nodes['']) {
    Object.keys(node.nodes['']).forEach(function (key) {
      if (key === 'nodes') return
      node[key] = node.nodes[''][key]
    })
    Object.assign(node.nodes, node.nodes[''].nodes)
    delete node.nodes[''].nodes
  }
}

function has (object, property) {
  return Object.prototype.hasOwnProperty.call(object, property)
}

},{"assert":8}],30:[function(require,module,exports){
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
        Test & Features and Ideas
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

},{"choo/html":3}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImFwcC5qcyIsIm5vZGVfbW9kdWxlcy9jaG9vL2NvbXBvbmVudC9jYWNoZS5qcyIsIm5vZGVfbW9kdWxlcy9jaG9vL2h0bWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2hvby9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kb2N1bWVudC1yZWFkeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9oeXBlcnNjcmlwdC1hdHRyaWJ1dGUtdG8tcHJvcGVydHkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaHlwZXJ4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL25hbm9hc3NlcnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmFub2J1cy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vaHJlZi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vaHRtbC9saWIvYXBwZW5kLWNoaWxkLmpzIiwibm9kZV9tb2R1bGVzL25hbm9odG1sL2xpYi9ib29sLXByb3BzLmpzIiwibm9kZV9tb2R1bGVzL25hbm9odG1sL2xpYi9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL25hbm9odG1sL2xpYi9kaXJlY3QtcHJvcHMuanMiLCJub2RlX21vZHVsZXMvbmFub2h0bWwvbGliL2RvbS5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vaHRtbC9saWIvc3ZnLXRhZ3MuanMiLCJub2RlX21vZHVsZXMvbmFub2xydS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vbW9ycGgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmFub21vcnBoL2xpYi9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvbmFub21vcnBoL2xpYi9tb3JwaC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vcXVlcnkvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vcmFmL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL25hbm9yb3V0ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmFub3NjaGVkdWxlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vdGltaW5nL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcmVtb3ZlLWFycmF5LWl0ZW1zL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Njcm9sbC10by1hbmNob3IvaW5kZXguanMiLCJub2RlX21vZHVsZXMvd2F5ZmFyZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvd2F5ZmFyZXIvdHJpZS5qcyIsInRlbXBsYXRlcy9ib2R5LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8vaW1wb3J0IFwiLi9zdHlsZXNoZWV0cy9tYWluLmNzc1wiO1xuLy9jb25zdCAgZnMgPSByZXF1aXJlKCdmcycpXG52YXIgY2hvbyA9IHJlcXVpcmUoJ2Nob28nKVxudmFyIGh0bWwgPSByZXF1aXJlKCdjaG9vL2h0bWwnKVxuXG52YXIgaW5kZXggPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9ib2R5LmpzJylcblxudmFyIGFwcCA9IGNob28oKVxuYXBwLm1vdW50KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhcHAnKSlcbi8vIFdlIGNhbiBjb21tdW5pY2F0ZSB3aXRoIG1haW4gcHJvY2VzcyB0aHJvdWdoIG1lc3NhZ2VzLlxudmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24obXV0YXRpb25zKSB7XG4vLyAgY29uc29sZS5sb2cobXV0YXRpb25zKVxuICB2YXIgbSA9IG11dGF0aW9ucy5wb3AoKVxuICBjb25zb2xlLmxvZyhtLnRhcmdldC5jaGlsZHJlbilcbiAgYXBwLmVtaXR0ZXIuZW1pdChtLnRhcmdldC5jaGlsZHJlblswXS5pZCwgbS50YXJnZXQuY2hpbGRyZW5bMF0pXG4gIGFwcC5lbWl0dGVyLmVtaXQoJ2xvYWQnKSAvL20udGFyZ2V0LmNoaWxkcmVuWzBdLmlkLCBtLnRhcmdldC5jaGlsZHJlblswXSlcbn0pO1xuXG5vYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LCB7YXR0cmlidXRlczogZmFsc2UsIGNoaWxkTGlzdDogdHJ1ZSwgY2hhcmFjdGVyRGF0YTogZmFsc2UsIHN1YnRyZWU6dHJ1ZX0pO1xuLy9vYnNlcnZlci5kaXNjb25uZWN0KCk7XG5cbmFwcC51c2UoZnVuY3Rpb24oc3RhdGUsIHVwZGF0ZSl7XG4gIC8vc3RhdGUuZGIgPSBkYlxuICBzdGF0ZS50aXRsZSA9ICdwMnBob25lJ1xuICBzdGF0ZS52aWV3ID0gJy8nXG4gIHVwZGF0ZS5vbigndmlldycsIGUgPT4gc3RhdGUudmlldyA9IGUpXG4gIHVwZGF0ZS5vbigncHJvY2VzcycsIGUgPT4ge1xuICAgIHVwZGF0ZS5yZW5kZXIoKVxuICAgIHVwZGF0ZS5lbWl0KGUuY2FsbGVJZCkgLy8gY2FsbGJhY2sgdG8gcnVuIEpTIGZvciBoeXBlcnggdGVtcGxhdGVzXG4gIH0pXG59KVxuXG5hcHAucm91dGUoJy8nLCBzdGF0ZSA9PiB7XG4gIGFwcC5lbWl0dGVyLmVtaXQoJ3VubG9hZCcsJycpXG4gIHJldHVybiBpbmRleChzdGF0ZSwgYXBwKVxufSlcblxuYXBwLnJvdXRlKCcvaG9zdCcsIHN0YXRlID0+IHtcbiAgYXBwLmVtaXR0ZXIuZW1pdCgndW5sb2FkJywnJylcbiAgcmV0dXJuIGluZGV4KHN0YXRlLCBhcHApXG59KVxuXG4vLyBsaXN0ZW5lciByb3V0ZVxuYXBwLnJvdXRlKCcvc3RyZWFtLzpwYWdlJywgc3RhdGUgPT4ge1xuICBjb25zb2xlLmxvZyhzdGF0ZSlcbiAgYXBwLmVtaXR0ZXIuZW1pdCgndW5sb2FkJywnJylcbiAgcmV0dXJuIGluZGV4KHN0YXRlLCBhcHApXG59KVxuIiwidmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG52YXIgTFJVID0gcmVxdWlyZSgnbmFub2xydScpXG5cbm1vZHVsZS5leHBvcnRzID0gQ2hvb0NvbXBvbmVudENhY2hlXG5cbmZ1bmN0aW9uIENob29Db21wb25lbnRDYWNoZSAoc3RhdGUsIGVtaXQsIGxydSkge1xuICBhc3NlcnQub2sodGhpcyBpbnN0YW5jZW9mIENob29Db21wb25lbnRDYWNoZSwgJ0Nob29Db21wb25lbnRDYWNoZSBzaG91bGQgYmUgY3JlYXRlZCB3aXRoIGBuZXdgJylcblxuICBhc3NlcnQuZXF1YWwodHlwZW9mIHN0YXRlLCAnb2JqZWN0JywgJ0Nob29Db21wb25lbnRDYWNoZTogc3RhdGUgc2hvdWxkIGJlIHR5cGUgb2JqZWN0JylcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBlbWl0LCAnZnVuY3Rpb24nLCAnQ2hvb0NvbXBvbmVudENhY2hlOiBlbWl0IHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcblxuICBpZiAodHlwZW9mIGxydSA9PT0gJ251bWJlcicpIHRoaXMuY2FjaGUgPSBuZXcgTFJVKGxydSlcbiAgZWxzZSB0aGlzLmNhY2hlID0gbHJ1IHx8IG5ldyBMUlUoMTAwKVxuICB0aGlzLnN0YXRlID0gc3RhdGVcbiAgdGhpcy5lbWl0ID0gZW1pdFxufVxuXG4vLyBHZXQgJiBjcmVhdGUgY29tcG9uZW50IGluc3RhbmNlcy5cbkNob29Db21wb25lbnRDYWNoZS5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKENvbXBvbmVudCwgaWQpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBDb21wb25lbnQsICdmdW5jdGlvbicsICdDaG9vQ29tcG9uZW50Q2FjaGUucmVuZGVyOiBDb21wb25lbnQgc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuICBhc3NlcnQub2sodHlwZW9mIGlkID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgaWQgPT09ICdudW1iZXInLCAnQ2hvb0NvbXBvbmVudENhY2hlLnJlbmRlcjogaWQgc2hvdWxkIGJlIHR5cGUgc3RyaW5nIG9yIHR5cGUgbnVtYmVyJylcblxuICB2YXIgZWwgPSB0aGlzLmNhY2hlLmdldChpZClcbiAgaWYgKCFlbCkge1xuICAgIHZhciBhcmdzID0gW11cbiAgICBmb3IgKHZhciBpID0gMiwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBhcmdzLnB1c2goYXJndW1lbnRzW2ldKVxuICAgIH1cbiAgICBhcmdzLnVuc2hpZnQoQ29tcG9uZW50LCBpZCwgdGhpcy5zdGF0ZSwgdGhpcy5lbWl0KVxuICAgIGVsID0gbmV3Q2FsbC5hcHBseShuZXdDYWxsLCBhcmdzKVxuICAgIHRoaXMuY2FjaGUuc2V0KGlkLCBlbClcbiAgfVxuXG4gIHJldHVybiBlbFxufVxuXG4vLyBCZWNhdXNlIHlvdSBjYW4ndCBjYWxsIGBuZXdgIGFuZCBgLmFwcGx5KClgIGF0IHRoZSBzYW1lIHRpbWUuIFRoaXMgaXMgYSBtYWRcbi8vIGhhY2ssIGJ1dCBoZXkgaXQgd29ya3Mgc28gd2UgZ29ubmEgZ28gZm9yIGl0LiBXaG9vcC5cbmZ1bmN0aW9uIG5ld0NhbGwgKENscykge1xuICByZXR1cm4gbmV3IChDbHMuYmluZC5hcHBseShDbHMsIGFyZ3VtZW50cykpIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnbmFub2h0bWwnKVxuIiwidmFyIHNjcm9sbFRvQW5jaG9yID0gcmVxdWlyZSgnc2Nyb2xsLXRvLWFuY2hvcicpXG52YXIgZG9jdW1lbnRSZWFkeSA9IHJlcXVpcmUoJ2RvY3VtZW50LXJlYWR5JylcbnZhciBuYW5vdGltaW5nID0gcmVxdWlyZSgnbmFub3RpbWluZycpXG52YXIgbmFub3JvdXRlciA9IHJlcXVpcmUoJ25hbm9yb3V0ZXInKVxudmFyIG5hbm9tb3JwaCA9IHJlcXVpcmUoJ25hbm9tb3JwaCcpXG52YXIgbmFub3F1ZXJ5ID0gcmVxdWlyZSgnbmFub3F1ZXJ5JylcbnZhciBuYW5vaHJlZiA9IHJlcXVpcmUoJ25hbm9ocmVmJylcbnZhciBuYW5vcmFmID0gcmVxdWlyZSgnbmFub3JhZicpXG52YXIgbmFub2J1cyA9IHJlcXVpcmUoJ25hbm9idXMnKVxudmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG5cbnZhciBDYWNoZSA9IHJlcXVpcmUoJy4vY29tcG9uZW50L2NhY2hlJylcblxubW9kdWxlLmV4cG9ydHMgPSBDaG9vXG5cbnZhciBISVNUT1JZX09CSkVDVCA9IHt9XG5cbmZ1bmN0aW9uIENob28gKG9wdHMpIHtcbiAgdmFyIHRpbWluZyA9IG5hbm90aW1pbmcoJ2Nob28uY29uc3RydWN0b3InKVxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ2hvbykpIHJldHVybiBuZXcgQ2hvbyhvcHRzKVxuICBvcHRzID0gb3B0cyB8fCB7fVxuXG4gIGFzc2VydC5lcXVhbCh0eXBlb2Ygb3B0cywgJ29iamVjdCcsICdjaG9vOiBvcHRzIHNob3VsZCBiZSB0eXBlIG9iamVjdCcpXG5cbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgLy8gZGVmaW5lIGV2ZW50cyB1c2VkIGJ5IGNob29cbiAgdGhpcy5fZXZlbnRzID0ge1xuICAgIERPTUNPTlRFTlRMT0FERUQ6ICdET01Db250ZW50TG9hZGVkJyxcbiAgICBET01USVRMRUNIQU5HRTogJ0RPTVRpdGxlQ2hhbmdlJyxcbiAgICBSRVBMQUNFU1RBVEU6ICdyZXBsYWNlU3RhdGUnLFxuICAgIFBVU0hTVEFURTogJ3B1c2hTdGF0ZScsXG4gICAgTkFWSUdBVEU6ICduYXZpZ2F0ZScsXG4gICAgUE9QU1RBVEU6ICdwb3BTdGF0ZScsXG4gICAgUkVOREVSOiAncmVuZGVyJ1xuICB9XG5cbiAgLy8gcHJvcGVydGllcyBmb3IgaW50ZXJuYWwgdXNlIG9ubHlcbiAgdGhpcy5faGlzdG9yeUVuYWJsZWQgPSBvcHRzLmhpc3RvcnkgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRzLmhpc3RvcnlcbiAgdGhpcy5faHJlZkVuYWJsZWQgPSBvcHRzLmhyZWYgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRzLmhyZWZcbiAgdGhpcy5faGFzaEVuYWJsZWQgPSBvcHRzLmhhc2ggPT09IHVuZGVmaW5lZCA/IGZhbHNlIDogb3B0cy5oYXNoXG4gIHRoaXMuX2hhc1dpbmRvdyA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gIHRoaXMuX2NhY2hlID0gb3B0cy5jYWNoZVxuICB0aGlzLl9sb2FkZWQgPSBmYWxzZVxuICB0aGlzLl9zdG9yZXMgPSBbb25kb210aXRsZWNoYW5nZV1cbiAgdGhpcy5fdHJlZSA9IG51bGxcblxuICAvLyBzdGF0ZVxuICB2YXIgX3N0YXRlID0ge1xuICAgIGV2ZW50czogdGhpcy5fZXZlbnRzLFxuICAgIGNvbXBvbmVudHM6IHt9XG4gIH1cbiAgaWYgKHRoaXMuX2hhc1dpbmRvdykge1xuICAgIHRoaXMuc3RhdGUgPSB3aW5kb3cuaW5pdGlhbFN0YXRlXG4gICAgICA/IE9iamVjdC5hc3NpZ24oe30sIHdpbmRvdy5pbml0aWFsU3RhdGUsIF9zdGF0ZSlcbiAgICAgIDogX3N0YXRlXG4gICAgZGVsZXRlIHdpbmRvdy5pbml0aWFsU3RhdGVcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnN0YXRlID0gX3N0YXRlXG4gIH1cblxuICAvLyBwcm9wZXJ0aWVzIHRoYXQgYXJlIHBhcnQgb2YgdGhlIEFQSVxuICB0aGlzLnJvdXRlciA9IG5hbm9yb3V0ZXIoeyBjdXJyeTogdHJ1ZSB9KVxuICB0aGlzLmVtaXR0ZXIgPSBuYW5vYnVzKCdjaG9vLmVtaXQnKVxuICB0aGlzLmVtaXQgPSB0aGlzLmVtaXR0ZXIuZW1pdC5iaW5kKHRoaXMuZW1pdHRlcilcblxuICAvLyBsaXN0ZW4gZm9yIHRpdGxlIGNoYW5nZXM7IGF2YWlsYWJsZSBldmVuIHdoZW4gY2FsbGluZyAudG9TdHJpbmcoKVxuICBpZiAodGhpcy5faGFzV2luZG93KSB0aGlzLnN0YXRlLnRpdGxlID0gZG9jdW1lbnQudGl0bGVcbiAgZnVuY3Rpb24gb25kb210aXRsZWNoYW5nZSAoc3RhdGUpIHtcbiAgICBzZWxmLmVtaXR0ZXIucHJlcGVuZExpc3RlbmVyKHNlbGYuX2V2ZW50cy5ET01USVRMRUNIQU5HRSwgZnVuY3Rpb24gKHRpdGxlKSB7XG4gICAgICBhc3NlcnQuZXF1YWwodHlwZW9mIHRpdGxlLCAnc3RyaW5nJywgJ2V2ZW50cy5ET01UaXRsZUNoYW5nZTogdGl0bGUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nJylcbiAgICAgIHN0YXRlLnRpdGxlID0gdGl0bGVcbiAgICAgIGlmIChzZWxmLl9oYXNXaW5kb3cpIGRvY3VtZW50LnRpdGxlID0gdGl0bGVcbiAgICB9KVxuICB9XG4gIHRpbWluZygpXG59XG5cbkNob28ucHJvdG90eXBlLnJvdXRlID0gZnVuY3Rpb24gKHJvdXRlLCBoYW5kbGVyKSB7XG4gIHZhciByb3V0ZVRpbWluZyA9IG5hbm90aW1pbmcoXCJjaG9vLnJvdXRlKCdcIiArIHJvdXRlICsgXCInKVwiKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIHJvdXRlLCAnc3RyaW5nJywgJ2Nob28ucm91dGU6IHJvdXRlIHNob3VsZCBiZSB0eXBlIHN0cmluZycpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgaGFuZGxlciwgJ2Z1bmN0aW9uJywgJ2Nob28uaGFuZGxlcjogcm91dGUgc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuICB0aGlzLnJvdXRlci5vbihyb3V0ZSwgaGFuZGxlcilcbiAgcm91dGVUaW1pbmcoKVxufVxuXG5DaG9vLnByb3RvdHlwZS51c2UgPSBmdW5jdGlvbiAoY2IpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBjYiwgJ2Z1bmN0aW9uJywgJ2Nob28udXNlOiBjYiBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG4gIHZhciBzZWxmID0gdGhpc1xuICB0aGlzLl9zdG9yZXMucHVzaChmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICB2YXIgbXNnID0gJ2Nob28udXNlJ1xuICAgIG1zZyA9IGNiLnN0b3JlTmFtZSA/IG1zZyArICcoJyArIGNiLnN0b3JlTmFtZSArICcpJyA6IG1zZ1xuICAgIHZhciBlbmRUaW1pbmcgPSBuYW5vdGltaW5nKG1zZylcbiAgICBjYihzdGF0ZSwgc2VsZi5lbWl0dGVyLCBzZWxmKVxuICAgIGVuZFRpbWluZygpXG4gIH0pXG59XG5cbkNob28ucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24gKCkge1xuICBhc3NlcnQuZXF1YWwodHlwZW9mIHdpbmRvdywgJ29iamVjdCcsICdjaG9vLnN0YXJ0OiB3aW5kb3cgd2FzIG5vdCBmb3VuZC4gLnN0YXJ0KCkgbXVzdCBiZSBjYWxsZWQgaW4gYSBicm93c2VyLCB1c2UgLnRvU3RyaW5nKCkgaWYgcnVubmluZyBpbiBOb2RlJylcbiAgdmFyIHN0YXJ0VGltaW5nID0gbmFub3RpbWluZygnY2hvby5zdGFydCcpXG5cbiAgdmFyIHNlbGYgPSB0aGlzXG4gIGlmICh0aGlzLl9oaXN0b3J5RW5hYmxlZCkge1xuICAgIHRoaXMuZW1pdHRlci5wcmVwZW5kTGlzdGVuZXIodGhpcy5fZXZlbnRzLk5BVklHQVRFLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9tYXRjaFJvdXRlKHNlbGYuc3RhdGUpXG4gICAgICBpZiAoc2VsZi5fbG9hZGVkKSB7XG4gICAgICAgIHNlbGYuZW1pdHRlci5lbWl0KHNlbGYuX2V2ZW50cy5SRU5ERVIpXG4gICAgICAgIHNldFRpbWVvdXQoc2Nyb2xsVG9BbmNob3IuYmluZChudWxsLCB3aW5kb3cubG9jYXRpb24uaGFzaCksIDApXG4gICAgICB9XG4gICAgfSlcblxuICAgIHRoaXMuZW1pdHRlci5wcmVwZW5kTGlzdGVuZXIodGhpcy5fZXZlbnRzLlBPUFNUQVRFLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLmVtaXR0ZXIuZW1pdChzZWxmLl9ldmVudHMuTkFWSUdBVEUpXG4gICAgfSlcblxuICAgIHRoaXMuZW1pdHRlci5wcmVwZW5kTGlzdGVuZXIodGhpcy5fZXZlbnRzLlBVU0hTVEFURSwgZnVuY3Rpb24gKGhyZWYpIHtcbiAgICAgIGFzc2VydC5lcXVhbCh0eXBlb2YgaHJlZiwgJ3N0cmluZycsICdldmVudHMucHVzaFN0YXRlOiBocmVmIHNob3VsZCBiZSB0eXBlIHN0cmluZycpXG4gICAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUoSElTVE9SWV9PQkpFQ1QsIG51bGwsIGhyZWYpXG4gICAgICBzZWxmLmVtaXR0ZXIuZW1pdChzZWxmLl9ldmVudHMuTkFWSUdBVEUpXG4gICAgfSlcblxuICAgIHRoaXMuZW1pdHRlci5wcmVwZW5kTGlzdGVuZXIodGhpcy5fZXZlbnRzLlJFUExBQ0VTVEFURSwgZnVuY3Rpb24gKGhyZWYpIHtcbiAgICAgIGFzc2VydC5lcXVhbCh0eXBlb2YgaHJlZiwgJ3N0cmluZycsICdldmVudHMucmVwbGFjZVN0YXRlOiBocmVmIHNob3VsZCBiZSB0eXBlIHN0cmluZycpXG4gICAgICB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoSElTVE9SWV9PQkpFQ1QsIG51bGwsIGhyZWYpXG4gICAgICBzZWxmLmVtaXR0ZXIuZW1pdChzZWxmLl9ldmVudHMuTkFWSUdBVEUpXG4gICAgfSlcblxuICAgIHdpbmRvdy5vbnBvcHN0YXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5lbWl0dGVyLmVtaXQoc2VsZi5fZXZlbnRzLlBPUFNUQVRFKVxuICAgIH1cblxuICAgIGlmIChzZWxmLl9ocmVmRW5hYmxlZCkge1xuICAgICAgbmFub2hyZWYoZnVuY3Rpb24gKGxvY2F0aW9uKSB7XG4gICAgICAgIHZhciBocmVmID0gbG9jYXRpb24uaHJlZlxuICAgICAgICB2YXIgaGFzaCA9IGxvY2F0aW9uLmhhc2hcbiAgICAgICAgaWYgKGhyZWYgPT09IHdpbmRvdy5sb2NhdGlvbi5ocmVmKSB7XG4gICAgICAgICAgaWYgKCFzZWxmLl9oYXNoRW5hYmxlZCAmJiBoYXNoKSBzY3JvbGxUb0FuY2hvcihoYXNoKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIHNlbGYuZW1pdHRlci5lbWl0KHNlbGYuX2V2ZW50cy5QVVNIU1RBVEUsIGhyZWYpXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHRoaXMuX3NldENhY2hlKHRoaXMuc3RhdGUpXG4gIHRoaXMuX21hdGNoUm91dGUodGhpcy5zdGF0ZSlcbiAgdGhpcy5fc3RvcmVzLmZvckVhY2goZnVuY3Rpb24gKGluaXRTdG9yZSkge1xuICAgIGluaXRTdG9yZShzZWxmLnN0YXRlKVxuICB9KVxuXG4gIHRoaXMuX3RyZWUgPSB0aGlzLl9wcmVyZW5kZXIodGhpcy5zdGF0ZSlcbiAgYXNzZXJ0Lm9rKHRoaXMuX3RyZWUsICdjaG9vLnN0YXJ0OiBubyB2YWxpZCBET00gbm9kZSByZXR1cm5lZCBmb3IgbG9jYXRpb24gJyArIHRoaXMuc3RhdGUuaHJlZilcblxuICB0aGlzLmVtaXR0ZXIucHJlcGVuZExpc3RlbmVyKHNlbGYuX2V2ZW50cy5SRU5ERVIsIG5hbm9yYWYoZnVuY3Rpb24gKCkge1xuICAgIHZhciByZW5kZXJUaW1pbmcgPSBuYW5vdGltaW5nKCdjaG9vLnJlbmRlcicpXG4gICAgdmFyIG5ld1RyZWUgPSBzZWxmLl9wcmVyZW5kZXIoc2VsZi5zdGF0ZSlcbiAgICBhc3NlcnQub2sobmV3VHJlZSwgJ2Nob28ucmVuZGVyOiBubyB2YWxpZCBET00gbm9kZSByZXR1cm5lZCBmb3IgbG9jYXRpb24gJyArIHNlbGYuc3RhdGUuaHJlZilcblxuICAgIGFzc2VydC5lcXVhbChzZWxmLl90cmVlLm5vZGVOYW1lLCBuZXdUcmVlLm5vZGVOYW1lLCAnY2hvby5yZW5kZXI6IFRoZSB0YXJnZXQgbm9kZSA8JyArXG4gICAgICBzZWxmLl90cmVlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgKyAnPiBpcyBub3QgdGhlIHNhbWUgdHlwZSBhcyB0aGUgbmV3IG5vZGUgPCcgK1xuICAgICAgbmV3VHJlZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICsgJz4uJylcblxuICAgIHZhciBtb3JwaFRpbWluZyA9IG5hbm90aW1pbmcoJ2Nob28ubW9ycGgnKVxuICAgIG5hbm9tb3JwaChzZWxmLl90cmVlLCBuZXdUcmVlKVxuICAgIG1vcnBoVGltaW5nKClcblxuICAgIHJlbmRlclRpbWluZygpXG4gIH0pKVxuXG4gIGRvY3VtZW50UmVhZHkoZnVuY3Rpb24gKCkge1xuICAgIHNlbGYuZW1pdHRlci5lbWl0KHNlbGYuX2V2ZW50cy5ET01DT05URU5UTE9BREVEKVxuICAgIHNlbGYuX2xvYWRlZCA9IHRydWVcbiAgfSlcblxuICBzdGFydFRpbWluZygpXG4gIHJldHVybiB0aGlzLl90cmVlXG59XG5cbkNob28ucHJvdG90eXBlLm1vdW50ID0gZnVuY3Rpb24gbW91bnQgKHNlbGVjdG9yKSB7XG4gIHZhciBtb3VudFRpbWluZyA9IG5hbm90aW1pbmcoXCJjaG9vLm1vdW50KCdcIiArIHNlbGVjdG9yICsgXCInKVwiKVxuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ29iamVjdCcpIHtcbiAgICBhc3NlcnQub2sodHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJywgJ2Nob28ubW91bnQ6IHNlbGVjdG9yIHNob3VsZCBiZSB0eXBlIFN0cmluZycpXG4gICAgdGhpcy5zZWxlY3RvciA9IHNlbGVjdG9yXG4gICAgbW91bnRUaW1pbmcoKVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBhc3NlcnQub2sodHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJyB8fCB0eXBlb2Ygc2VsZWN0b3IgPT09ICdvYmplY3QnLCAnY2hvby5tb3VudDogc2VsZWN0b3Igc2hvdWxkIGJlIHR5cGUgU3RyaW5nIG9yIEhUTUxFbGVtZW50JylcblxuICB2YXIgc2VsZiA9IHRoaXNcblxuICBkb2N1bWVudFJlYWR5KGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVuZGVyVGltaW5nID0gbmFub3RpbWluZygnY2hvby5yZW5kZXInKVxuICAgIHZhciBuZXdUcmVlID0gc2VsZi5zdGFydCgpXG4gICAgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHNlbGYuX3RyZWUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl90cmVlID0gc2VsZWN0b3JcbiAgICB9XG5cbiAgICBhc3NlcnQub2soc2VsZi5fdHJlZSwgJ2Nob28ubW91bnQ6IGNvdWxkIG5vdCBxdWVyeSBzZWxlY3RvcjogJyArIHNlbGVjdG9yKVxuICAgIGFzc2VydC5lcXVhbChzZWxmLl90cmVlLm5vZGVOYW1lLCBuZXdUcmVlLm5vZGVOYW1lLCAnY2hvby5tb3VudDogVGhlIHRhcmdldCBub2RlIDwnICtcbiAgICAgIHNlbGYuX3RyZWUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSArICc+IGlzIG5vdCB0aGUgc2FtZSB0eXBlIGFzIHRoZSBuZXcgbm9kZSA8JyArXG4gICAgICBuZXdUcmVlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgKyAnPi4nKVxuXG4gICAgdmFyIG1vcnBoVGltaW5nID0gbmFub3RpbWluZygnY2hvby5tb3JwaCcpXG4gICAgbmFub21vcnBoKHNlbGYuX3RyZWUsIG5ld1RyZWUpXG4gICAgbW9ycGhUaW1pbmcoKVxuXG4gICAgcmVuZGVyVGltaW5nKClcbiAgfSlcbiAgbW91bnRUaW1pbmcoKVxufVxuXG5DaG9vLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIChsb2NhdGlvbiwgc3RhdGUpIHtcbiAgc3RhdGUgPSBzdGF0ZSB8fCB7fVxuICBzdGF0ZS5jb21wb25lbnRzID0gc3RhdGUuY29tcG9uZW50cyB8fCB7fVxuICBzdGF0ZS5ldmVudHMgPSBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZS5ldmVudHMsIHRoaXMuX2V2ZW50cylcblxuICBhc3NlcnQubm90RXF1YWwodHlwZW9mIHdpbmRvdywgJ29iamVjdCcsICdjaG9vLm1vdW50OiB3aW5kb3cgd2FzIGZvdW5kLiAudG9TdHJpbmcoKSBtdXN0IGJlIGNhbGxlZCBpbiBOb2RlLCB1c2UgLnN0YXJ0KCkgb3IgLm1vdW50KCkgaWYgcnVubmluZyBpbiB0aGUgYnJvd3NlcicpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbG9jYXRpb24sICdzdHJpbmcnLCAnY2hvby50b1N0cmluZzogbG9jYXRpb24gc2hvdWxkIGJlIHR5cGUgc3RyaW5nJylcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBzdGF0ZSwgJ29iamVjdCcsICdjaG9vLnRvU3RyaW5nOiBzdGF0ZSBzaG91bGQgYmUgdHlwZSBvYmplY3QnKVxuXG4gIHRoaXMuX3NldENhY2hlKHN0YXRlKVxuICB0aGlzLl9tYXRjaFJvdXRlKHN0YXRlLCBsb2NhdGlvbilcbiAgdGhpcy5lbWl0dGVyLnJlbW92ZUFsbExpc3RlbmVycygpXG4gIHRoaXMuX3N0b3Jlcy5mb3JFYWNoKGZ1bmN0aW9uIChpbml0U3RvcmUpIHtcbiAgICBpbml0U3RvcmUoc3RhdGUpXG4gIH0pXG5cbiAgdmFyIGh0bWwgPSB0aGlzLl9wcmVyZW5kZXIoc3RhdGUpXG4gIGFzc2VydC5vayhodG1sLCAnY2hvby50b1N0cmluZzogbm8gdmFsaWQgdmFsdWUgcmV0dXJuZWQgZm9yIHRoZSByb3V0ZSAnICsgbG9jYXRpb24pXG4gIGFzc2VydCghQXJyYXkuaXNBcnJheShodG1sKSwgJ2Nob28udG9TdHJpbmc6IHJldHVybiB2YWx1ZSB3YXMgYW4gYXJyYXkgZm9yIHRoZSByb3V0ZSAnICsgbG9jYXRpb24pXG4gIHJldHVybiB0eXBlb2YgaHRtbC5vdXRlckhUTUwgPT09ICdzdHJpbmcnID8gaHRtbC5vdXRlckhUTUwgOiBodG1sLnRvU3RyaW5nKClcbn1cblxuQ2hvby5wcm90b3R5cGUuX21hdGNoUm91dGUgPSBmdW5jdGlvbiAoc3RhdGUsIGxvY2F0aW9uT3ZlcnJpZGUpIHtcbiAgdmFyIGxvY2F0aW9uLCBxdWVyeVN0cmluZ1xuICBpZiAobG9jYXRpb25PdmVycmlkZSkge1xuICAgIGxvY2F0aW9uID0gbG9jYXRpb25PdmVycmlkZS5yZXBsYWNlKC9cXD8uKyQvLCAnJykucmVwbGFjZSgvXFwvJC8sICcnKVxuICAgIGlmICghdGhpcy5faGFzaEVuYWJsZWQpIGxvY2F0aW9uID0gbG9jYXRpb24ucmVwbGFjZSgvIy4rJC8sICcnKVxuICAgIHF1ZXJ5U3RyaW5nID0gbG9jYXRpb25PdmVycmlkZVxuICB9IGVsc2Uge1xuICAgIGxvY2F0aW9uID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnJlcGxhY2UoL1xcLyQvLCAnJylcbiAgICBpZiAodGhpcy5faGFzaEVuYWJsZWQpIGxvY2F0aW9uICs9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnJlcGxhY2UoL14jLywgJy8nKVxuICAgIHF1ZXJ5U3RyaW5nID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaFxuICB9XG4gIHZhciBtYXRjaGVkID0gdGhpcy5yb3V0ZXIubWF0Y2gobG9jYXRpb24pXG4gIHRoaXMuX2hhbmRsZXIgPSBtYXRjaGVkLmNiXG4gIHN0YXRlLmhyZWYgPSBsb2NhdGlvblxuICBzdGF0ZS5xdWVyeSA9IG5hbm9xdWVyeShxdWVyeVN0cmluZylcbiAgc3RhdGUucm91dGUgPSBtYXRjaGVkLnJvdXRlXG4gIHN0YXRlLnBhcmFtcyA9IG1hdGNoZWQucGFyYW1zXG59XG5cbkNob28ucHJvdG90eXBlLl9wcmVyZW5kZXIgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgdmFyIHJvdXRlVGltaW5nID0gbmFub3RpbWluZyhcImNob28ucHJlcmVuZGVyKCdcIiArIHN0YXRlLnJvdXRlICsgXCInKVwiKVxuICB2YXIgcmVzID0gdGhpcy5faGFuZGxlcihzdGF0ZSwgdGhpcy5lbWl0KVxuICByb3V0ZVRpbWluZygpXG4gIHJldHVybiByZXNcbn1cblxuQ2hvby5wcm90b3R5cGUuX3NldENhY2hlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHZhciBjYWNoZSA9IG5ldyBDYWNoZShzdGF0ZSwgdGhpcy5lbWl0dGVyLmVtaXQuYmluZCh0aGlzLmVtaXR0ZXIpLCB0aGlzLl9jYWNoZSlcbiAgc3RhdGUuY2FjaGUgPSByZW5kZXJDb21wb25lbnRcblxuICBmdW5jdGlvbiByZW5kZXJDb21wb25lbnQgKENvbXBvbmVudCwgaWQpIHtcbiAgICBhc3NlcnQuZXF1YWwodHlwZW9mIENvbXBvbmVudCwgJ2Z1bmN0aW9uJywgJ2Nob28uc3RhdGUuY2FjaGU6IENvbXBvbmVudCBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG4gICAgdmFyIGFyZ3MgPSBbXVxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGFyZ3MucHVzaChhcmd1bWVudHNbaV0pXG4gICAgfVxuICAgIHJldHVybiBjYWNoZS5yZW5kZXIuYXBwbHkoY2FjaGUsIGFyZ3MpXG4gIH1cblxuICAvLyBXaGVuIHRoZSBzdGF0ZSBnZXRzIHN0cmluZ2lmaWVkLCBtYWtlIHN1cmUgYHN0YXRlLmNhY2hlYCBpc24ndFxuICAvLyBzdHJpbmdpZmllZCB0b28uXG4gIHJlbmRlckNvbXBvbmVudC50b0pTT04gPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbm1vZHVsZS5leHBvcnRzID0gcmVhZHlcblxuZnVuY3Rpb24gcmVhZHkgKGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdkb2N1bWVudC1yZWFkeSBvbmx5IHJ1bnMgaW4gdGhlIGJyb3dzZXInKVxuICB9XG4gIHZhciBzdGF0ZSA9IGRvY3VtZW50LnJlYWR5U3RhdGVcbiAgaWYgKHN0YXRlID09PSAnY29tcGxldGUnIHx8IHN0YXRlID09PSAnaW50ZXJhY3RpdmUnKSB7XG4gICAgcmV0dXJuIHNldFRpbWVvdXQoY2FsbGJhY2ssIDApXG4gIH1cblxuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24gb25Mb2FkICgpIHtcbiAgICBjYWxsYmFjaygpXG4gIH0pXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGF0dHJpYnV0ZVRvUHJvcGVydHlcblxudmFyIHRyYW5zZm9ybSA9IHtcbiAgJ2NsYXNzJzogJ2NsYXNzTmFtZScsXG4gICdmb3InOiAnaHRtbEZvcicsXG4gICdodHRwLWVxdWl2JzogJ2h0dHBFcXVpdidcbn1cblxuZnVuY3Rpb24gYXR0cmlidXRlVG9Qcm9wZXJ0eSAoaCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHRhZ05hbWUsIGF0dHJzLCBjaGlsZHJlbikge1xuICAgIGZvciAodmFyIGF0dHIgaW4gYXR0cnMpIHtcbiAgICAgIGlmIChhdHRyIGluIHRyYW5zZm9ybSkge1xuICAgICAgICBhdHRyc1t0cmFuc2Zvcm1bYXR0cl1dID0gYXR0cnNbYXR0cl1cbiAgICAgICAgZGVsZXRlIGF0dHJzW2F0dHJdXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBoKHRhZ05hbWUsIGF0dHJzLCBjaGlsZHJlbilcbiAgfVxufVxuIiwidmFyIGF0dHJUb1Byb3AgPSByZXF1aXJlKCdoeXBlcnNjcmlwdC1hdHRyaWJ1dGUtdG8tcHJvcGVydHknKVxuXG52YXIgVkFSID0gMCwgVEVYVCA9IDEsIE9QRU4gPSAyLCBDTE9TRSA9IDMsIEFUVFIgPSA0XG52YXIgQVRUUl9LRVkgPSA1LCBBVFRSX0tFWV9XID0gNlxudmFyIEFUVFJfVkFMVUVfVyA9IDcsIEFUVFJfVkFMVUUgPSA4XG52YXIgQVRUUl9WQUxVRV9TUSA9IDksIEFUVFJfVkFMVUVfRFEgPSAxMFxudmFyIEFUVFJfRVEgPSAxMSwgQVRUUl9CUkVBSyA9IDEyXG52YXIgQ09NTUVOVCA9IDEzXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGgsIG9wdHMpIHtcbiAgaWYgKCFvcHRzKSBvcHRzID0ge31cbiAgdmFyIGNvbmNhdCA9IG9wdHMuY29uY2F0IHx8IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgcmV0dXJuIFN0cmluZyhhKSArIFN0cmluZyhiKVxuICB9XG4gIGlmIChvcHRzLmF0dHJUb1Byb3AgIT09IGZhbHNlKSB7XG4gICAgaCA9IGF0dHJUb1Byb3AoaClcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoc3RyaW5ncykge1xuICAgIHZhciBzdGF0ZSA9IFRFWFQsIHJlZyA9ICcnXG4gICAgdmFyIGFyZ2xlbiA9IGFyZ3VtZW50cy5sZW5ndGhcbiAgICB2YXIgcGFydHMgPSBbXVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHJpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoaSA8IGFyZ2xlbiAtIDEpIHtcbiAgICAgICAgdmFyIGFyZyA9IGFyZ3VtZW50c1tpKzFdXG4gICAgICAgIHZhciBwID0gcGFyc2Uoc3RyaW5nc1tpXSlcbiAgICAgICAgdmFyIHhzdGF0ZSA9IHN0YXRlXG4gICAgICAgIGlmICh4c3RhdGUgPT09IEFUVFJfVkFMVUVfRFEpIHhzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSkgeHN0YXRlID0gQVRUUl9WQUxVRVxuICAgICAgICBpZiAoeHN0YXRlID09PSBBVFRSX1ZBTFVFX1cpIHhzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gQVRUUikgeHN0YXRlID0gQVRUUl9LRVlcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gT1BFTikge1xuICAgICAgICAgIGlmIChyZWcgPT09ICcvJykge1xuICAgICAgICAgICAgcC5wdXNoKFsgT1BFTiwgJy8nLCBhcmcgXSlcbiAgICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHAucHVzaChbIE9QRU4sIGFyZyBdKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh4c3RhdGUgPT09IENPTU1FTlQgJiYgb3B0cy5jb21tZW50cykge1xuICAgICAgICAgIHJlZyArPSBTdHJpbmcoYXJnKVxuICAgICAgICB9IGVsc2UgaWYgKHhzdGF0ZSAhPT0gQ09NTUVOVCkge1xuICAgICAgICAgIHAucHVzaChbIFZBUiwgeHN0YXRlLCBhcmcgXSlcbiAgICAgICAgfVxuICAgICAgICBwYXJ0cy5wdXNoLmFwcGx5KHBhcnRzLCBwKVxuICAgICAgfSBlbHNlIHBhcnRzLnB1c2guYXBwbHkocGFydHMsIHBhcnNlKHN0cmluZ3NbaV0pKVxuICAgIH1cblxuICAgIHZhciB0cmVlID0gW251bGwse30sW11dXG4gICAgdmFyIHN0YWNrID0gW1t0cmVlLC0xXV1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgY3VyID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdWzBdXG4gICAgICB2YXIgcCA9IHBhcnRzW2ldLCBzID0gcFswXVxuICAgICAgaWYgKHMgPT09IE9QRU4gJiYgL15cXC8vLnRlc3QocFsxXSkpIHtcbiAgICAgICAgdmFyIGl4ID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdWzFdXG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgc3RhY2sucG9wKClcbiAgICAgICAgICBzdGFja1tzdGFjay5sZW5ndGgtMV1bMF1bMl1baXhdID0gaChcbiAgICAgICAgICAgIGN1clswXSwgY3VyWzFdLCBjdXJbMl0ubGVuZ3RoID8gY3VyWzJdIDogdW5kZWZpbmVkXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IE9QRU4pIHtcbiAgICAgICAgdmFyIGMgPSBbcFsxXSx7fSxbXV1cbiAgICAgICAgY3VyWzJdLnB1c2goYylcbiAgICAgICAgc3RhY2sucHVzaChbYyxjdXJbMl0ubGVuZ3RoLTFdKVxuICAgICAgfSBlbHNlIGlmIChzID09PSBBVFRSX0tFWSB8fCAocyA9PT0gVkFSICYmIHBbMV0gPT09IEFUVFJfS0VZKSkge1xuICAgICAgICB2YXIga2V5ID0gJydcbiAgICAgICAgdmFyIGNvcHlLZXlcbiAgICAgICAgZm9yICg7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChwYXJ0c1tpXVswXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIGtleSA9IGNvbmNhdChrZXksIHBhcnRzW2ldWzFdKVxuICAgICAgICAgIH0gZWxzZSBpZiAocGFydHNbaV1bMF0gPT09IFZBUiAmJiBwYXJ0c1tpXVsxXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcGFydHNbaV1bMl0gPT09ICdvYmplY3QnICYmICFrZXkpIHtcbiAgICAgICAgICAgICAgZm9yIChjb3B5S2V5IGluIHBhcnRzW2ldWzJdKSB7XG4gICAgICAgICAgICAgICAgaWYgKHBhcnRzW2ldWzJdLmhhc093blByb3BlcnR5KGNvcHlLZXkpICYmICFjdXJbMV1bY29weUtleV0pIHtcbiAgICAgICAgICAgICAgICAgIGN1clsxXVtjb3B5S2V5XSA9IHBhcnRzW2ldWzJdW2NvcHlLZXldXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBrZXkgPSBjb25jYXQoa2V5LCBwYXJ0c1tpXVsyXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydHNbaV1bMF0gPT09IEFUVFJfRVEpIGkrK1xuICAgICAgICB2YXIgaiA9IGlcbiAgICAgICAgZm9yICg7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChwYXJ0c1tpXVswXSA9PT0gQVRUUl9WQUxVRSB8fCBwYXJ0c1tpXVswXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIGlmICghY3VyWzFdW2tleV0pIGN1clsxXVtrZXldID0gc3RyZm4ocGFydHNbaV1bMV0pXG4gICAgICAgICAgICBlbHNlIHBhcnRzW2ldWzFdPT09XCJcIiB8fCAoY3VyWzFdW2tleV0gPSBjb25jYXQoY3VyWzFdW2tleV0sIHBhcnRzW2ldWzFdKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChwYXJ0c1tpXVswXSA9PT0gVkFSXG4gICAgICAgICAgJiYgKHBhcnRzW2ldWzFdID09PSBBVFRSX1ZBTFVFIHx8IHBhcnRzW2ldWzFdID09PSBBVFRSX0tFWSkpIHtcbiAgICAgICAgICAgIGlmICghY3VyWzFdW2tleV0pIGN1clsxXVtrZXldID0gc3RyZm4ocGFydHNbaV1bMl0pXG4gICAgICAgICAgICBlbHNlIHBhcnRzW2ldWzJdPT09XCJcIiB8fCAoY3VyWzFdW2tleV0gPSBjb25jYXQoY3VyWzFdW2tleV0sIHBhcnRzW2ldWzJdKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChrZXkubGVuZ3RoICYmICFjdXJbMV1ba2V5XSAmJiBpID09PSBqXG4gICAgICAgICAgICAmJiAocGFydHNbaV1bMF0gPT09IENMT1NFIHx8IHBhcnRzW2ldWzBdID09PSBBVFRSX0JSRUFLKSkge1xuICAgICAgICAgICAgICAvLyBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9pbmZyYXN0cnVjdHVyZS5odG1sI2Jvb2xlYW4tYXR0cmlidXRlc1xuICAgICAgICAgICAgICAvLyBlbXB0eSBzdHJpbmcgaXMgZmFsc3ksIG5vdCB3ZWxsIGJlaGF2ZWQgdmFsdWUgaW4gYnJvd3NlclxuICAgICAgICAgICAgICBjdXJbMV1ba2V5XSA9IGtleS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGFydHNbaV1bMF0gPT09IENMT1NFKSB7XG4gICAgICAgICAgICAgIGktLVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgY3VyWzFdW3BbMV1dID0gdHJ1ZVxuICAgICAgfSBlbHNlIGlmIChzID09PSBWQVIgJiYgcFsxXSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgY3VyWzFdW3BbMl1dID0gdHJ1ZVxuICAgICAgfSBlbHNlIGlmIChzID09PSBDTE9TRSkge1xuICAgICAgICBpZiAoc2VsZkNsb3NpbmcoY3VyWzBdKSAmJiBzdGFjay5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgaXggPSBzdGFja1tzdGFjay5sZW5ndGgtMV1bMV1cbiAgICAgICAgICBzdGFjay5wb3AoKVxuICAgICAgICAgIHN0YWNrW3N0YWNrLmxlbmd0aC0xXVswXVsyXVtpeF0gPSBoKFxuICAgICAgICAgICAgY3VyWzBdLCBjdXJbMV0sIGN1clsyXS5sZW5ndGggPyBjdXJbMl0gOiB1bmRlZmluZWRcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gVkFSICYmIHBbMV0gPT09IFRFWFQpIHtcbiAgICAgICAgaWYgKHBbMl0gPT09IHVuZGVmaW5lZCB8fCBwWzJdID09PSBudWxsKSBwWzJdID0gJydcbiAgICAgICAgZWxzZSBpZiAoIXBbMl0pIHBbMl0gPSBjb25jYXQoJycsIHBbMl0pXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBbMl1bMF0pKSB7XG4gICAgICAgICAgY3VyWzJdLnB1c2guYXBwbHkoY3VyWzJdLCBwWzJdKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGN1clsyXS5wdXNoKHBbMl0pXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gVEVYVCkge1xuICAgICAgICBjdXJbMl0ucHVzaChwWzFdKVxuICAgICAgfSBlbHNlIGlmIChzID09PSBBVFRSX0VRIHx8IHMgPT09IEFUVFJfQlJFQUspIHtcbiAgICAgICAgLy8gbm8tb3BcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndW5oYW5kbGVkOiAnICsgcylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodHJlZVsyXS5sZW5ndGggPiAxICYmIC9eXFxzKiQvLnRlc3QodHJlZVsyXVswXSkpIHtcbiAgICAgIHRyZWVbMl0uc2hpZnQoKVxuICAgIH1cblxuICAgIGlmICh0cmVlWzJdLmxlbmd0aCA+IDJcbiAgICB8fCAodHJlZVsyXS5sZW5ndGggPT09IDIgJiYgL1xcUy8udGVzdCh0cmVlWzJdWzFdKSkpIHtcbiAgICAgIGlmIChvcHRzLmNyZWF0ZUZyYWdtZW50KSByZXR1cm4gb3B0cy5jcmVhdGVGcmFnbWVudCh0cmVlWzJdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnbXVsdGlwbGUgcm9vdCBlbGVtZW50cyBtdXN0IGJlIHdyYXBwZWQgaW4gYW4gZW5jbG9zaW5nIHRhZydcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodHJlZVsyXVswXSkgJiYgdHlwZW9mIHRyZWVbMl1bMF1bMF0gPT09ICdzdHJpbmcnXG4gICAgJiYgQXJyYXkuaXNBcnJheSh0cmVlWzJdWzBdWzJdKSkge1xuICAgICAgdHJlZVsyXVswXSA9IGgodHJlZVsyXVswXVswXSwgdHJlZVsyXVswXVsxXSwgdHJlZVsyXVswXVsyXSlcbiAgICB9XG4gICAgcmV0dXJuIHRyZWVbMl1bMF1cblxuICAgIGZ1bmN0aW9uIHBhcnNlIChzdHIpIHtcbiAgICAgIHZhciByZXMgPSBbXVxuICAgICAgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cpIHN0YXRlID0gQVRUUlxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGMgPSBzdHIuY2hhckF0KGkpXG4gICAgICAgIGlmIChzdGF0ZSA9PT0gVEVYVCAmJiBjID09PSAnPCcpIHtcbiAgICAgICAgICBpZiAocmVnLmxlbmd0aCkgcmVzLnB1c2goW1RFWFQsIHJlZ10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IE9QRU5cbiAgICAgICAgfSBlbHNlIGlmIChjID09PSAnPicgJiYgIXF1b3Qoc3RhdGUpICYmIHN0YXRlICE9PSBDT01NRU5UKSB7XG4gICAgICAgICAgaWYgKHN0YXRlID09PSBPUEVOICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtPUEVOLHJlZ10pXG4gICAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9LRVkpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUUgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzLnB1c2goW0NMT1NFXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gVEVYVFxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBDT01NRU5UICYmIC8tJC8udGVzdChyZWcpICYmIGMgPT09ICctJykge1xuICAgICAgICAgIGlmIChvcHRzLmNvbW1lbnRzKSB7XG4gICAgICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWcuc3Vic3RyKDAsIHJlZy5sZW5ndGggLSAxKV0pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBURVhUXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IE9QRU4gJiYgL14hLS0kLy50ZXN0KHJlZykpIHtcbiAgICAgICAgICBpZiAob3B0cy5jb21tZW50cykge1xuICAgICAgICAgICAgcmVzLnB1c2goW09QRU4sIHJlZ10sW0FUVFJfS0VZLCdjb21tZW50J10sW0FUVFJfRVFdKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZWcgPSBjXG4gICAgICAgICAgc3RhdGUgPSBDT01NRU5UXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IFRFWFQgfHwgc3RhdGUgPT09IENPTU1FTlQpIHtcbiAgICAgICAgICByZWcgKz0gY1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBPUEVOICYmIGMgPT09ICcvJyAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gbm8tb3AsIHNlbGYgY2xvc2luZyB0YWcgd2l0aG91dCBhIHNwYWNlIDxici8+XG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IE9QRU4gJiYgL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIGlmIChyZWcubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXMucHVzaChbT1BFTiwgcmVnXSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gT1BFTikge1xuICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFIgJiYgL1teXFxzXCInPS9dLy50ZXN0KGMpKSB7XG4gICAgICAgICAgc3RhdGUgPSBBVFRSX0tFWVxuICAgICAgICAgIHJlZyA9IGNcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUiAmJiAvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgaWYgKHJlZy5sZW5ndGgpIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0JSRUFLXSlcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9LRVkgJiYgL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSX0tFWV9XXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZICYmIGMgPT09ICc9Jykge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddLFtBVFRSX0VRXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRV9XXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgfSBlbHNlIGlmICgoc3RhdGUgPT09IEFUVFJfS0VZX1cgfHwgc3RhdGUgPT09IEFUVFIpICYmIGMgPT09ICc9Jykge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX0VRXSlcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfV1xuICAgICAgICB9IGVsc2UgaWYgKChzdGF0ZSA9PT0gQVRUUl9LRVlfVyB8fCBzdGF0ZSA9PT0gQVRUUikgJiYgIS9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9CUkVBS10pXG4gICAgICAgICAgaWYgKC9bXFx3LV0vLnRlc3QoYykpIHtcbiAgICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgICAgICBzdGF0ZSA9IEFUVFJfS0VZXG4gICAgICAgICAgfSBlbHNlIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cgJiYgYyA9PT0gJ1wiJykge1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRV9EUVxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cgJiYgYyA9PT0gXCInXCIpIHtcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfU1FcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUSAmJiBjID09PSAnXCInKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSxbQVRUUl9CUkVBS10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSAmJiBjID09PSBcIidcIikge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10sW0FUVFJfQlJFQUtdKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfVyAmJiAhL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9WQUxVRVxuICAgICAgICAgIGktLVxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFICYmIC9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddLFtBVFRSX0JSRUFLXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFIHx8IHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRXG4gICAgICAgIHx8IHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRKSB7XG4gICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHN0YXRlID09PSBURVhUICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgcmVzLnB1c2goW1RFWFQscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUUgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUSAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgIHJlcy5wdXNoKFtBVFRSX0tFWSxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHN0cmZuICh4KSB7XG4gICAgaWYgKHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nKSByZXR1cm4geFxuICAgIGVsc2UgaWYgKHR5cGVvZiB4ID09PSAnc3RyaW5nJykgcmV0dXJuIHhcbiAgICBlbHNlIGlmICh4ICYmIHR5cGVvZiB4ID09PSAnb2JqZWN0JykgcmV0dXJuIHhcbiAgICBlbHNlIGlmICh4ID09PSBudWxsIHx8IHggPT09IHVuZGVmaW5lZCkgcmV0dXJuIHhcbiAgICBlbHNlIHJldHVybiBjb25jYXQoJycsIHgpXG4gIH1cbn1cblxuZnVuY3Rpb24gcXVvdCAoc3RhdGUpIHtcbiAgcmV0dXJuIHN0YXRlID09PSBBVFRSX1ZBTFVFX1NRIHx8IHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRXG59XG5cbnZhciBjbG9zZVJFID0gUmVnRXhwKCdeKCcgKyBbXG4gICdhcmVhJywgJ2Jhc2UnLCAnYmFzZWZvbnQnLCAnYmdzb3VuZCcsICdicicsICdjb2wnLCAnY29tbWFuZCcsICdlbWJlZCcsXG4gICdmcmFtZScsICdocicsICdpbWcnLCAnaW5wdXQnLCAnaXNpbmRleCcsICdrZXlnZW4nLCAnbGluaycsICdtZXRhJywgJ3BhcmFtJyxcbiAgJ3NvdXJjZScsICd0cmFjaycsICd3YnInLCAnIS0tJyxcbiAgLy8gU1ZHIFRBR1NcbiAgJ2FuaW1hdGUnLCAnYW5pbWF0ZVRyYW5zZm9ybScsICdjaXJjbGUnLCAnY3Vyc29yJywgJ2Rlc2MnLCAnZWxsaXBzZScsXG4gICdmZUJsZW5kJywgJ2ZlQ29sb3JNYXRyaXgnLCAnZmVDb21wb3NpdGUnLFxuICAnZmVDb252b2x2ZU1hdHJpeCcsICdmZURpZmZ1c2VMaWdodGluZycsICdmZURpc3BsYWNlbWVudE1hcCcsXG4gICdmZURpc3RhbnRMaWdodCcsICdmZUZsb29kJywgJ2ZlRnVuY0EnLCAnZmVGdW5jQicsICdmZUZ1bmNHJywgJ2ZlRnVuY1InLFxuICAnZmVHYXVzc2lhbkJsdXInLCAnZmVJbWFnZScsICdmZU1lcmdlTm9kZScsICdmZU1vcnBob2xvZ3knLFxuICAnZmVPZmZzZXQnLCAnZmVQb2ludExpZ2h0JywgJ2ZlU3BlY3VsYXJMaWdodGluZycsICdmZVNwb3RMaWdodCcsICdmZVRpbGUnLFxuICAnZmVUdXJidWxlbmNlJywgJ2ZvbnQtZmFjZS1mb3JtYXQnLCAnZm9udC1mYWNlLW5hbWUnLCAnZm9udC1mYWNlLXVyaScsXG4gICdnbHlwaCcsICdnbHlwaFJlZicsICdoa2VybicsICdpbWFnZScsICdsaW5lJywgJ21pc3NpbmctZ2x5cGgnLCAnbXBhdGgnLFxuICAncGF0aCcsICdwb2x5Z29uJywgJ3BvbHlsaW5lJywgJ3JlY3QnLCAnc2V0JywgJ3N0b3AnLCAndHJlZicsICd1c2UnLCAndmlldycsXG4gICd2a2Vybidcbl0uam9pbignfCcpICsgJykoPzpbXFwuI11bYS16QS1aMC05XFx1MDA3Ri1cXHVGRkZGXzotXSspKiQnKVxuZnVuY3Rpb24gc2VsZkNsb3NpbmcgKHRhZykgeyByZXR1cm4gY2xvc2VSRS50ZXN0KHRhZykgfVxuIiwiYXNzZXJ0Lm5vdEVxdWFsID0gbm90RXF1YWxcbmFzc2VydC5ub3RPayA9IG5vdE9rXG5hc3NlcnQuZXF1YWwgPSBlcXVhbFxuYXNzZXJ0Lm9rID0gYXNzZXJ0XG5cbm1vZHVsZS5leHBvcnRzID0gYXNzZXJ0XG5cbmZ1bmN0aW9uIGVxdWFsIChhLCBiLCBtKSB7XG4gIGFzc2VydChhID09IGIsIG0pIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG59XG5cbmZ1bmN0aW9uIG5vdEVxdWFsIChhLCBiLCBtKSB7XG4gIGFzc2VydChhICE9IGIsIG0pIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG59XG5cbmZ1bmN0aW9uIG5vdE9rICh0LCBtKSB7XG4gIGFzc2VydCghdCwgbSlcbn1cblxuZnVuY3Rpb24gYXNzZXJ0ICh0LCBtKSB7XG4gIGlmICghdCkgdGhyb3cgbmV3IEVycm9yKG0gfHwgJ0Fzc2VydGlvbkVycm9yJylcbn1cbiIsInZhciBzcGxpY2UgPSByZXF1aXJlKCdyZW1vdmUtYXJyYXktaXRlbXMnKVxudmFyIG5hbm90aW1pbmcgPSByZXF1aXJlKCduYW5vdGltaW5nJylcbnZhciBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IE5hbm9idXNcblxuZnVuY3Rpb24gTmFub2J1cyAobmFtZSkge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTmFub2J1cykpIHJldHVybiBuZXcgTmFub2J1cyhuYW1lKVxuXG4gIHRoaXMuX25hbWUgPSBuYW1lIHx8ICduYW5vYnVzJ1xuICB0aGlzLl9zdGFyTGlzdGVuZXJzID0gW11cbiAgdGhpcy5fbGlzdGVuZXJzID0ge31cbn1cblxuTmFub2J1cy5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIChldmVudE5hbWUpIHtcbiAgYXNzZXJ0Lm9rKHR5cGVvZiBldmVudE5hbWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBldmVudE5hbWUgPT09ICdzeW1ib2wnLCAnbmFub2J1cy5lbWl0OiBldmVudE5hbWUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nIG9yIHN5bWJvbCcpXG5cbiAgdmFyIGRhdGEgPSBbXVxuICBmb3IgKHZhciBpID0gMSwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgZGF0YS5wdXNoKGFyZ3VtZW50c1tpXSlcbiAgfVxuXG4gIHZhciBlbWl0VGltaW5nID0gbmFub3RpbWluZyh0aGlzLl9uYW1lICsgXCIoJ1wiICsgZXZlbnROYW1lLnRvU3RyaW5nKCkgKyBcIicpXCIpXG4gIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXVxuICBpZiAobGlzdGVuZXJzICYmIGxpc3RlbmVycy5sZW5ndGggPiAwKSB7XG4gICAgdGhpcy5fZW1pdCh0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSwgZGF0YSlcbiAgfVxuXG4gIGlmICh0aGlzLl9zdGFyTGlzdGVuZXJzLmxlbmd0aCA+IDApIHtcbiAgICB0aGlzLl9lbWl0KHRoaXMuX3N0YXJMaXN0ZW5lcnMsIGV2ZW50TmFtZSwgZGF0YSwgZW1pdFRpbWluZy51dWlkKVxuICB9XG4gIGVtaXRUaW1pbmcoKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbk5hbm9idXMucHJvdG90eXBlLm9uID0gTmFub2J1cy5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICBhc3NlcnQub2sodHlwZW9mIGV2ZW50TmFtZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGV2ZW50TmFtZSA9PT0gJ3N5bWJvbCcsICduYW5vYnVzLm9uOiBldmVudE5hbWUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nIG9yIHN5bWJvbCcpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbGlzdGVuZXIsICdmdW5jdGlvbicsICduYW5vYnVzLm9uOiBsaXN0ZW5lciBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG5cbiAgaWYgKGV2ZW50TmFtZSA9PT0gJyonKSB7XG4gICAgdGhpcy5fc3Rhckxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKVxuICB9IGVsc2Uge1xuICAgIGlmICghdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0pIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdID0gW11cbiAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGxpc3RlbmVyKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbk5hbm9idXMucHJvdG90eXBlLnByZXBlbmRMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gIGFzc2VydC5vayh0eXBlb2YgZXZlbnROYW1lID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZXZlbnROYW1lID09PSAnc3ltYm9sJywgJ25hbm9idXMucHJlcGVuZExpc3RlbmVyOiBldmVudE5hbWUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nIG9yIHN5bWJvbCcpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbGlzdGVuZXIsICdmdW5jdGlvbicsICduYW5vYnVzLnByZXBlbmRMaXN0ZW5lcjogbGlzdGVuZXIgc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuXG4gIGlmIChldmVudE5hbWUgPT09ICcqJykge1xuICAgIHRoaXMuX3N0YXJMaXN0ZW5lcnMudW5zaGlmdChsaXN0ZW5lcilcbiAgfSBlbHNlIHtcbiAgICBpZiAoIXRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdKSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdXG4gICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0udW5zaGlmdChsaXN0ZW5lcilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5OYW5vYnVzLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgYXNzZXJ0Lm9rKHR5cGVvZiBldmVudE5hbWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBldmVudE5hbWUgPT09ICdzeW1ib2wnLCAnbmFub2J1cy5vbmNlOiBldmVudE5hbWUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nIG9yIHN5bWJvbCcpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbGlzdGVuZXIsICdmdW5jdGlvbicsICduYW5vYnVzLm9uY2U6IGxpc3RlbmVyIHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcblxuICB2YXIgc2VsZiA9IHRoaXNcbiAgdGhpcy5vbihldmVudE5hbWUsIG9uY2UpXG4gIGZ1bmN0aW9uIG9uY2UgKCkge1xuICAgIGxpc3RlbmVyLmFwcGx5KHNlbGYsIGFyZ3VtZW50cylcbiAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKGV2ZW50TmFtZSwgb25jZSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5OYW5vYnVzLnByb3RvdHlwZS5wcmVwZW5kT25jZUxpc3RlbmVyID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgYXNzZXJ0Lm9rKHR5cGVvZiBldmVudE5hbWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBldmVudE5hbWUgPT09ICdzeW1ib2wnLCAnbmFub2J1cy5wcmVwZW5kT25jZUxpc3RlbmVyOiBldmVudE5hbWUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nIG9yIHN5bWJvbCcpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbGlzdGVuZXIsICdmdW5jdGlvbicsICduYW5vYnVzLnByZXBlbmRPbmNlTGlzdGVuZXI6IGxpc3RlbmVyIHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcblxuICB2YXIgc2VsZiA9IHRoaXNcbiAgdGhpcy5wcmVwZW5kTGlzdGVuZXIoZXZlbnROYW1lLCBvbmNlKVxuICBmdW5jdGlvbiBvbmNlICgpIHtcbiAgICBsaXN0ZW5lci5hcHBseShzZWxmLCBhcmd1bWVudHMpXG4gICAgc2VsZi5yZW1vdmVMaXN0ZW5lcihldmVudE5hbWUsIG9uY2UpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuTmFub2J1cy5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICBhc3NlcnQub2sodHlwZW9mIGV2ZW50TmFtZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGV2ZW50TmFtZSA9PT0gJ3N5bWJvbCcsICduYW5vYnVzLnJlbW92ZUxpc3RlbmVyOiBldmVudE5hbWUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nIG9yIHN5bWJvbCcpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbGlzdGVuZXIsICdmdW5jdGlvbicsICduYW5vYnVzLnJlbW92ZUxpc3RlbmVyOiBsaXN0ZW5lciBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG5cbiAgaWYgKGV2ZW50TmFtZSA9PT0gJyonKSB7XG4gICAgdGhpcy5fc3Rhckxpc3RlbmVycyA9IHRoaXMuX3N0YXJMaXN0ZW5lcnMuc2xpY2UoKVxuICAgIHJldHVybiByZW1vdmUodGhpcy5fc3Rhckxpc3RlbmVycywgbGlzdGVuZXIpXG4gIH0gZWxzZSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0uc2xpY2UoKVxuICAgIH1cblxuICAgIHJldHVybiByZW1vdmUodGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0sIGxpc3RlbmVyKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlIChhcnIsIGxpc3RlbmVyKSB7XG4gICAgaWYgKCFhcnIpIHJldHVyblxuICAgIHZhciBpbmRleCA9IGFyci5pbmRleE9mKGxpc3RlbmVyKVxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIHNwbGljZShhcnIsIGluZGV4LCAxKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH1cbn1cblxuTmFub2J1cy5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24gKGV2ZW50TmFtZSkge1xuICBpZiAoZXZlbnROYW1lKSB7XG4gICAgaWYgKGV2ZW50TmFtZSA9PT0gJyonKSB7XG4gICAgICB0aGlzLl9zdGFyTGlzdGVuZXJzID0gW11cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLl9zdGFyTGlzdGVuZXJzID0gW11cbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbk5hbm9idXMucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChldmVudE5hbWUpIHtcbiAgdmFyIGxpc3RlbmVycyA9IGV2ZW50TmFtZSAhPT0gJyonXG4gICAgPyB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXVxuICAgIDogdGhpcy5fc3Rhckxpc3RlbmVyc1xuXG4gIHZhciByZXQgPSBbXVxuICBpZiAobGlzdGVuZXJzKSB7XG4gICAgdmFyIGlsZW5ndGggPSBsaXN0ZW5lcnMubGVuZ3RoXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbGVuZ3RoOyBpKyspIHJldC5wdXNoKGxpc3RlbmVyc1tpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbk5hbm9idXMucHJvdG90eXBlLl9lbWl0ID0gZnVuY3Rpb24gKGFyciwgZXZlbnROYW1lLCBkYXRhLCB1dWlkKSB7XG4gIGlmICh0eXBlb2YgYXJyID09PSAndW5kZWZpbmVkJykgcmV0dXJuXG4gIGlmIChhcnIubGVuZ3RoID09PSAwKSByZXR1cm5cbiAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgIGRhdGEgPSBldmVudE5hbWVcbiAgICBldmVudE5hbWUgPSBudWxsXG4gIH1cblxuICBpZiAoZXZlbnROYW1lKSB7XG4gICAgaWYgKHV1aWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZGF0YSA9IFtldmVudE5hbWVdLmNvbmNhdChkYXRhLCB1dWlkKVxuICAgIH0gZWxzZSB7XG4gICAgICBkYXRhID0gW2V2ZW50TmFtZV0uY29uY2F0KGRhdGEpXG4gICAgfVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGFyci5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBsaXN0ZW5lciA9IGFycltpXVxuICAgIGxpc3RlbmVyLmFwcGx5KGxpc3RlbmVyLCBkYXRhKVxuICB9XG59XG4iLCJ2YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcblxudmFyIHNhZmVFeHRlcm5hbExpbmsgPSAvKG5vb3BlbmVyfG5vcmVmZXJyZXIpIChub29wZW5lcnxub3JlZmVycmVyKS9cbnZhciBwcm90b2NvbExpbmsgPSAvXltcXHctX10rOi9cblxubW9kdWxlLmV4cG9ydHMgPSBocmVmXG5cbmZ1bmN0aW9uIGhyZWYgKGNiLCByb290KSB7XG4gIGFzc2VydC5ub3RFcXVhbCh0eXBlb2Ygd2luZG93LCAndW5kZWZpbmVkJywgJ25hbm9ocmVmOiBleHBlY3RlZCB3aW5kb3cgdG8gZXhpc3QnKVxuXG4gIHJvb3QgPSByb290IHx8IHdpbmRvdy5kb2N1bWVudFxuXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgY2IsICdmdW5jdGlvbicsICduYW5vaHJlZjogY2Igc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIHJvb3QsICdvYmplY3QnLCAnbmFub2hyZWY6IHJvb3Qgc2hvdWxkIGJlIHR5cGUgb2JqZWN0JylcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZSkge1xuICAgIGlmICgoZS5idXR0b24gJiYgZS5idXR0b24gIT09IDApIHx8XG4gICAgICBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYWx0S2V5IHx8IGUuc2hpZnRLZXkgfHxcbiAgICAgIGUuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuXG5cbiAgICB2YXIgYW5jaG9yID0gKGZ1bmN0aW9uIHRyYXZlcnNlIChub2RlKSB7XG4gICAgICBpZiAoIW5vZGUgfHwgbm9kZSA9PT0gcm9vdCkgcmV0dXJuXG4gICAgICBpZiAobm9kZS5sb2NhbE5hbWUgIT09ICdhJyB8fCBub2RlLmhyZWYgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdHJhdmVyc2Uobm9kZS5wYXJlbnROb2RlKVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5vZGVcbiAgICB9KShlLnRhcmdldClcblxuICAgIGlmICghYW5jaG9yKSByZXR1cm5cblxuICAgIGlmICh3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgIT09IGFuY2hvci5wcm90b2NvbCB8fFxuICAgICAgICB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUgIT09IGFuY2hvci5ob3N0bmFtZSB8fFxuICAgICAgICB3aW5kb3cubG9jYXRpb24ucG9ydCAhPT0gYW5jaG9yLnBvcnQgfHxcbiAgICAgIGFuY2hvci5oYXNBdHRyaWJ1dGUoJ2RhdGEtbmFub2hyZWYtaWdub3JlJykgfHxcbiAgICAgIGFuY2hvci5oYXNBdHRyaWJ1dGUoJ2Rvd25sb2FkJykgfHxcbiAgICAgIChhbmNob3IuZ2V0QXR0cmlidXRlKCd0YXJnZXQnKSA9PT0gJ19ibGFuaycgJiZcbiAgICAgICAgc2FmZUV4dGVybmFsTGluay50ZXN0KGFuY2hvci5nZXRBdHRyaWJ1dGUoJ3JlbCcpKSkgfHxcbiAgICAgIHByb3RvY29sTGluay50ZXN0KGFuY2hvci5nZXRBdHRyaWJ1dGUoJ2hyZWYnKSkpIHJldHVyblxuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY2IoYW5jaG9yKVxuICB9KVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciB0cmFpbGluZ05ld2xpbmVSZWdleCA9IC9cXG5bXFxzXSskL1xudmFyIGxlYWRpbmdOZXdsaW5lUmVnZXggPSAvXlxcbltcXHNdKy9cbnZhciB0cmFpbGluZ1NwYWNlUmVnZXggPSAvW1xcc10rJC9cbnZhciBsZWFkaW5nU3BhY2VSZWdleCA9IC9eW1xcc10rL1xudmFyIG11bHRpU3BhY2VSZWdleCA9IC9bXFxuXFxzXSsvZ1xuXG52YXIgVEVYVF9UQUdTID0gW1xuICAnYScsICdhYmJyJywgJ2InLCAnYmRpJywgJ2JkbycsICdicicsICdjaXRlJywgJ2RhdGEnLCAnZGZuJywgJ2VtJywgJ2knLFxuICAna2JkJywgJ21hcmsnLCAncScsICdycCcsICdydCcsICdydGMnLCAncnVieScsICdzJywgJ2FtcCcsICdzbWFsbCcsICdzcGFuJyxcbiAgJ3N0cm9uZycsICdzdWInLCAnc3VwJywgJ3RpbWUnLCAndScsICd2YXInLCAnd2JyJ1xuXVxuXG52YXIgVkVSQkFUSU1fVEFHUyA9IFtcbiAgJ2NvZGUnLCAncHJlJywgJ3RleHRhcmVhJ1xuXVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGFwcGVuZENoaWxkIChlbCwgY2hpbGRzKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShjaGlsZHMpKSByZXR1cm5cblxuICB2YXIgbm9kZU5hbWUgPSBlbC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpXG5cbiAgdmFyIGhhZFRleHQgPSBmYWxzZVxuICB2YXIgdmFsdWUsIGxlYWRlclxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjaGlsZHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgbm9kZSA9IGNoaWxkc1tpXVxuICAgIGlmIChBcnJheS5pc0FycmF5KG5vZGUpKSB7XG4gICAgICBhcHBlbmRDaGlsZChlbCwgbm9kZSlcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBub2RlID09PSAnbnVtYmVyJyB8fFxuICAgICAgdHlwZW9mIG5vZGUgPT09ICdib29sZWFuJyB8fFxuICAgICAgdHlwZW9mIG5vZGUgPT09ICdmdW5jdGlvbicgfHxcbiAgICAgIG5vZGUgaW5zdGFuY2VvZiBEYXRlIHx8XG4gICAgICBub2RlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICBub2RlID0gbm9kZS50b1N0cmluZygpXG4gICAgfVxuXG4gICAgdmFyIGxhc3RDaGlsZCA9IGVsLmNoaWxkTm9kZXNbZWwuY2hpbGROb2Rlcy5sZW5ndGggLSAxXVxuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIHRleHQgbm9kZXNcbiAgICBpZiAodHlwZW9mIG5vZGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBoYWRUZXh0ID0gdHJ1ZVxuXG4gICAgICAvLyBJZiB3ZSBhbHJlYWR5IGhhZCB0ZXh0LCBhcHBlbmQgdG8gdGhlIGV4aXN0aW5nIHRleHRcbiAgICAgIGlmIChsYXN0Q2hpbGQgJiYgbGFzdENoaWxkLm5vZGVOYW1lID09PSAnI3RleHQnKSB7XG4gICAgICAgIGxhc3RDaGlsZC5ub2RlVmFsdWUgKz0gbm9kZVxuXG4gICAgICAvLyBXZSBkaWRuJ3QgaGF2ZSBhIHRleHQgbm9kZSB5ZXQsIGNyZWF0ZSBvbmVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUgPSBlbC5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG5vZGUpXG4gICAgICAgIGVsLmFwcGVuZENoaWxkKG5vZGUpXG4gICAgICAgIGxhc3RDaGlsZCA9IG5vZGVcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhpcyBpcyB0aGUgbGFzdCBvZiB0aGUgY2hpbGQgbm9kZXMsIG1ha2Ugc3VyZSB3ZSBjbG9zZSBpdCBvdXRcbiAgICAgIC8vIHJpZ2h0XG4gICAgICBpZiAoaSA9PT0gbGVuIC0gMSkge1xuICAgICAgICBoYWRUZXh0ID0gZmFsc2VcbiAgICAgICAgLy8gVHJpbSB0aGUgY2hpbGQgdGV4dCBub2RlcyBpZiB0aGUgY3VycmVudCBub2RlIGlzbid0IGFcbiAgICAgICAgLy8gbm9kZSB3aGVyZSB3aGl0ZXNwYWNlIG1hdHRlcnMuXG4gICAgICAgIGlmIChURVhUX1RBR1MuaW5kZXhPZihub2RlTmFtZSkgPT09IC0xICYmXG4gICAgICAgICAgVkVSQkFUSU1fVEFHUy5pbmRleE9mKG5vZGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgICB2YWx1ZSA9IGxhc3RDaGlsZC5ub2RlVmFsdWVcbiAgICAgICAgICAgIC5yZXBsYWNlKGxlYWRpbmdOZXdsaW5lUmVnZXgsICcnKVxuICAgICAgICAgICAgLnJlcGxhY2UodHJhaWxpbmdTcGFjZVJlZ2V4LCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKHRyYWlsaW5nTmV3bGluZVJlZ2V4LCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKG11bHRpU3BhY2VSZWdleCwgJyAnKVxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gJycpIHtcbiAgICAgICAgICAgIGVsLnJlbW92ZUNoaWxkKGxhc3RDaGlsZClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGFzdENoaWxkLm5vZGVWYWx1ZSA9IHZhbHVlXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKFZFUkJBVElNX1RBR1MuaW5kZXhPZihub2RlTmFtZSkgPT09IC0xKSB7XG4gICAgICAgICAgLy8gVGhlIHZlcnkgZmlyc3Qgbm9kZSBpbiB0aGUgbGlzdCBzaG91bGQgbm90IGhhdmUgbGVhZGluZ1xuICAgICAgICAgIC8vIHdoaXRlc3BhY2UuIFNpYmxpbmcgdGV4dCBub2RlcyBzaG91bGQgaGF2ZSB3aGl0ZXNwYWNlIGlmIHRoZXJlXG4gICAgICAgICAgLy8gd2FzIGFueS5cbiAgICAgICAgICBsZWFkZXIgPSBpID09PSAwID8gJycgOiAnICdcbiAgICAgICAgICB2YWx1ZSA9IGxhc3RDaGlsZC5ub2RlVmFsdWVcbiAgICAgICAgICAgIC5yZXBsYWNlKGxlYWRpbmdOZXdsaW5lUmVnZXgsIGxlYWRlcilcbiAgICAgICAgICAgIC5yZXBsYWNlKGxlYWRpbmdTcGFjZVJlZ2V4LCAnICcpXG4gICAgICAgICAgICAucmVwbGFjZSh0cmFpbGluZ1NwYWNlUmVnZXgsICcnKVxuICAgICAgICAgICAgLnJlcGxhY2UodHJhaWxpbmdOZXdsaW5lUmVnZXgsICcnKVxuICAgICAgICAgICAgLnJlcGxhY2UobXVsdGlTcGFjZVJlZ2V4LCAnICcpXG4gICAgICAgICAgbGFzdENoaWxkLm5vZGVWYWx1ZSA9IHZhbHVlXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgIC8vIEl0ZXJhdGUgb3ZlciBET00gbm9kZXNcbiAgICB9IGVsc2UgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSkge1xuICAgICAgLy8gSWYgdGhlIGxhc3Qgbm9kZSB3YXMgYSB0ZXh0IG5vZGUsIG1ha2Ugc3VyZSBpdCBpcyBwcm9wZXJseSBjbG9zZWQgb3V0XG4gICAgICBpZiAoaGFkVGV4dCkge1xuICAgICAgICBoYWRUZXh0ID0gZmFsc2VcblxuICAgICAgICAvLyBUcmltIHRoZSBjaGlsZCB0ZXh0IG5vZGVzIGlmIHRoZSBjdXJyZW50IG5vZGUgaXNuJ3QgYVxuICAgICAgICAvLyB0ZXh0IG5vZGUgb3IgYSBjb2RlIG5vZGVcbiAgICAgICAgaWYgKFRFWFRfVEFHUy5pbmRleE9mKG5vZGVOYW1lKSA9PT0gLTEgJiZcbiAgICAgICAgICBWRVJCQVRJTV9UQUdTLmluZGV4T2Yobm9kZU5hbWUpID09PSAtMSkge1xuICAgICAgICAgIHZhbHVlID0gbGFzdENoaWxkLm5vZGVWYWx1ZVxuICAgICAgICAgICAgLnJlcGxhY2UobGVhZGluZ05ld2xpbmVSZWdleCwgJycpXG4gICAgICAgICAgICAucmVwbGFjZSh0cmFpbGluZ05ld2xpbmVSZWdleCwgJyAnKVxuICAgICAgICAgICAgLnJlcGxhY2UobXVsdGlTcGFjZVJlZ2V4LCAnICcpXG5cbiAgICAgICAgICAvLyBSZW1vdmUgZW1wdHkgdGV4dCBub2RlcywgYXBwZW5kIG90aGVyd2lzZVxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gJycpIHtcbiAgICAgICAgICAgIGVsLnJlbW92ZUNoaWxkKGxhc3RDaGlsZClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGFzdENoaWxkLm5vZGVWYWx1ZSA9IHZhbHVlXG4gICAgICAgICAgfVxuICAgICAgICAvLyBUcmltIHRoZSBjaGlsZCBub2RlcyBidXQgcHJlc2VydmUgdGhlIGFwcHJvcHJpYXRlIHdoaXRlc3BhY2VcbiAgICAgICAgfSBlbHNlIGlmIChWRVJCQVRJTV9UQUdTLmluZGV4T2Yobm9kZU5hbWUpID09PSAtMSkge1xuICAgICAgICAgIHZhbHVlID0gbGFzdENoaWxkLm5vZGVWYWx1ZVxuICAgICAgICAgICAgLnJlcGxhY2UobGVhZGluZ1NwYWNlUmVnZXgsICcgJylcbiAgICAgICAgICAgIC5yZXBsYWNlKGxlYWRpbmdOZXdsaW5lUmVnZXgsICcnKVxuICAgICAgICAgICAgLnJlcGxhY2UodHJhaWxpbmdOZXdsaW5lUmVnZXgsICcgJylcbiAgICAgICAgICAgIC5yZXBsYWNlKG11bHRpU3BhY2VSZWdleCwgJyAnKVxuICAgICAgICAgIGxhc3RDaGlsZC5ub2RlVmFsdWUgPSB2YWx1ZVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFN0b3JlIHRoZSBsYXN0IG5vZGVuYW1lXG4gICAgICB2YXIgX25vZGVOYW1lID0gbm9kZS5ub2RlTmFtZVxuICAgICAgaWYgKF9ub2RlTmFtZSkgbm9kZU5hbWUgPSBfbm9kZU5hbWUudG9Mb3dlckNhc2UoKVxuXG4gICAgICAvLyBBcHBlbmQgdGhlIG5vZGUgdG8gdGhlIERPTVxuICAgICAgZWwuYXBwZW5kQ2hpbGQobm9kZSlcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IFtcbiAgJ2FzeW5jJywgJ2F1dG9mb2N1cycsICdhdXRvcGxheScsICdjaGVja2VkJywgJ2NvbnRyb2xzJywgJ2RlZmF1bHQnLFxuICAnZGVmYXVsdGNoZWNrZWQnLCAnZGVmZXInLCAnZGlzYWJsZWQnLCAnZm9ybW5vdmFsaWRhdGUnLCAnaGlkZGVuJyxcbiAgJ2lzbWFwJywgJ2xvb3AnLCAnbXVsdGlwbGUnLCAnbXV0ZWQnLCAnbm92YWxpZGF0ZScsICdvcGVuJywgJ3BsYXlzaW5saW5lJyxcbiAgJ3JlYWRvbmx5JywgJ3JlcXVpcmVkJywgJ3JldmVyc2VkJywgJ3NlbGVjdGVkJ1xuXVxuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2RvbScpKGRvY3VtZW50KVxuIiwiJ3VzZSBzdHJpY3QnXG5cbm1vZHVsZS5leHBvcnRzID0gW1xuICAnaW5kZXRlcm1pbmF0ZSdcbl1cbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgaHlwZXJ4ID0gcmVxdWlyZSgnaHlwZXJ4JylcbnZhciBhcHBlbmRDaGlsZCA9IHJlcXVpcmUoJy4vYXBwZW5kLWNoaWxkJylcbnZhciBTVkdfVEFHUyA9IHJlcXVpcmUoJy4vc3ZnLXRhZ3MnKVxudmFyIEJPT0xfUFJPUFMgPSByZXF1aXJlKCcuL2Jvb2wtcHJvcHMnKVxuLy8gUHJvcHMgdGhhdCBuZWVkIHRvIGJlIHNldCBkaXJlY3RseSByYXRoZXIgdGhhbiB3aXRoIGVsLnNldEF0dHJpYnV0ZSgpXG52YXIgRElSRUNUX1BST1BTID0gcmVxdWlyZSgnLi9kaXJlY3QtcHJvcHMnKVxuXG52YXIgU1ZHTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnXG52YXIgWExJTktOUyA9ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJ1xuXG52YXIgQ09NTUVOVF9UQUcgPSAnIS0tJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChkb2N1bWVudCkge1xuICBmdW5jdGlvbiBuYW5vSHRtbENyZWF0ZUVsZW1lbnQgKHRhZywgcHJvcHMsIGNoaWxkcmVuKSB7XG4gICAgdmFyIGVsXG5cbiAgICAvLyBJZiBhbiBzdmcgdGFnLCBpdCBuZWVkcyBhIG5hbWVzcGFjZVxuICAgIGlmIChTVkdfVEFHUy5pbmRleE9mKHRhZykgIT09IC0xKSB7XG4gICAgICBwcm9wcy5uYW1lc3BhY2UgPSBTVkdOU1xuICAgIH1cblxuICAgIC8vIElmIHdlIGFyZSB1c2luZyBhIG5hbWVzcGFjZVxuICAgIHZhciBucyA9IGZhbHNlXG4gICAgaWYgKHByb3BzLm5hbWVzcGFjZSkge1xuICAgICAgbnMgPSBwcm9wcy5uYW1lc3BhY2VcbiAgICAgIGRlbGV0ZSBwcm9wcy5uYW1lc3BhY2VcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBhcmUgZXh0ZW5kaW5nIGEgYnVpbHRpbiBlbGVtZW50XG4gICAgdmFyIGlzQ3VzdG9tRWxlbWVudCA9IGZhbHNlXG4gICAgaWYgKHByb3BzLmlzKSB7XG4gICAgICBpc0N1c3RvbUVsZW1lbnQgPSBwcm9wcy5pc1xuICAgICAgZGVsZXRlIHByb3BzLmlzXG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHRoZSBlbGVtZW50XG4gICAgaWYgKG5zKSB7XG4gICAgICBpZiAoaXNDdXN0b21FbGVtZW50KSB7XG4gICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5zLCB0YWcsIHsgaXM6IGlzQ3VzdG9tRWxlbWVudCB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMobnMsIHRhZylcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRhZyA9PT0gQ09NTUVOVF9UQUcpIHtcbiAgICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVDb21tZW50KHByb3BzLmNvbW1lbnQpXG4gICAgfSBlbHNlIGlmIChpc0N1c3RvbUVsZW1lbnQpIHtcbiAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcsIHsgaXM6IGlzQ3VzdG9tRWxlbWVudCB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgcHJvcGVydGllc1xuICAgIGZvciAodmFyIHAgaW4gcHJvcHMpIHtcbiAgICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eShwKSkge1xuICAgICAgICB2YXIga2V5ID0gcC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIHZhciB2YWwgPSBwcm9wc1twXVxuICAgICAgICAvLyBOb3JtYWxpemUgY2xhc3NOYW1lXG4gICAgICAgIGlmIChrZXkgPT09ICdjbGFzc25hbWUnKSB7XG4gICAgICAgICAga2V5ID0gJ2NsYXNzJ1xuICAgICAgICAgIHAgPSAnY2xhc3MnXG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlIGZvciBhdHRyaWJ1dGUgZ2V0cyB0cmFuc2Zvcm1lZCB0byBodG1sRm9yLCBidXQgd2UganVzdCBzZXQgYXMgZm9yXG4gICAgICAgIGlmIChwID09PSAnaHRtbEZvcicpIHtcbiAgICAgICAgICBwID0gJ2ZvcidcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiBhIHByb3BlcnR5IGlzIGJvb2xlYW4sIHNldCBpdHNlbGYgdG8gdGhlIGtleVxuICAgICAgICBpZiAoQk9PTF9QUk9QUy5pbmRleE9mKGtleSkgIT09IC0xKSB7XG4gICAgICAgICAgaWYgKFN0cmluZyh2YWwpID09PSAndHJ1ZScpIHZhbCA9IGtleVxuICAgICAgICAgIGVsc2UgaWYgKFN0cmluZyh2YWwpID09PSAnZmFsc2UnKSBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIC8vIElmIGEgcHJvcGVydHkgcHJlZmVycyBiZWluZyBzZXQgZGlyZWN0bHkgdnMgc2V0QXR0cmlidXRlXG4gICAgICAgIGlmIChrZXkuc2xpY2UoMCwgMikgPT09ICdvbicgfHwgRElSRUNUX1BST1BTLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcbiAgICAgICAgICBlbFtwXSA9IHZhbFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChucykge1xuICAgICAgICAgICAgaWYgKHAgPT09ICd4bGluazpocmVmJykge1xuICAgICAgICAgICAgICBlbC5zZXRBdHRyaWJ1dGVOUyhYTElOS05TLCBwLCB2YWwpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKC9eeG1sbnMoJHw6KS9pLnRlc3QocCkpIHtcbiAgICAgICAgICAgICAgLy8gc2tpcCB4bWxucyBkZWZpbml0aW9uc1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlTlMobnVsbCwgcCwgdmFsKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbC5zZXRBdHRyaWJ1dGUocCwgdmFsKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGFwcGVuZENoaWxkKGVsLCBjaGlsZHJlbilcbiAgICByZXR1cm4gZWxcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUZyYWdtZW50IChub2Rlcykge1xuICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChub2Rlc1tpXSA9PSBudWxsKSBjb250aW51ZVxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkobm9kZXNbaV0pKSB7XG4gICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGNyZWF0ZUZyYWdtZW50KG5vZGVzW2ldKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZXNbaV0gPT09ICdzdHJpbmcnKSBub2Rlc1tpXSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG5vZGVzW2ldKVxuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChub2Rlc1tpXSlcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50XG4gIH1cblxuICB2YXIgZXhwb3J0cyA9IGh5cGVyeChuYW5vSHRtbENyZWF0ZUVsZW1lbnQsIHtcbiAgICBjb21tZW50czogdHJ1ZSxcbiAgICBjcmVhdGVGcmFnbWVudDogY3JlYXRlRnJhZ21lbnRcbiAgfSlcbiAgZXhwb3J0cy5kZWZhdWx0ID0gZXhwb3J0c1xuICBleHBvcnRzLmNyZWF0ZUNvbW1lbnQgPSBuYW5vSHRtbENyZWF0ZUVsZW1lbnRcbiAgcmV0dXJuIGV4cG9ydHNcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IFtcbiAgJ3N2ZycsICdhbHRHbHlwaCcsICdhbHRHbHlwaERlZicsICdhbHRHbHlwaEl0ZW0nLCAnYW5pbWF0ZScsICdhbmltYXRlQ29sb3InLFxuICAnYW5pbWF0ZU1vdGlvbicsICdhbmltYXRlVHJhbnNmb3JtJywgJ2NpcmNsZScsICdjbGlwUGF0aCcsICdjb2xvci1wcm9maWxlJyxcbiAgJ2N1cnNvcicsICdkZWZzJywgJ2Rlc2MnLCAnZWxsaXBzZScsICdmZUJsZW5kJywgJ2ZlQ29sb3JNYXRyaXgnLFxuICAnZmVDb21wb25lbnRUcmFuc2ZlcicsICdmZUNvbXBvc2l0ZScsICdmZUNvbnZvbHZlTWF0cml4JyxcbiAgJ2ZlRGlmZnVzZUxpZ2h0aW5nJywgJ2ZlRGlzcGxhY2VtZW50TWFwJywgJ2ZlRGlzdGFudExpZ2h0JywgJ2ZlRmxvb2QnLFxuICAnZmVGdW5jQScsICdmZUZ1bmNCJywgJ2ZlRnVuY0cnLCAnZmVGdW5jUicsICdmZUdhdXNzaWFuQmx1cicsICdmZUltYWdlJyxcbiAgJ2ZlTWVyZ2UnLCAnZmVNZXJnZU5vZGUnLCAnZmVNb3JwaG9sb2d5JywgJ2ZlT2Zmc2V0JywgJ2ZlUG9pbnRMaWdodCcsXG4gICdmZVNwZWN1bGFyTGlnaHRpbmcnLCAnZmVTcG90TGlnaHQnLCAnZmVUaWxlJywgJ2ZlVHVyYnVsZW5jZScsICdmaWx0ZXInLFxuICAnZm9udCcsICdmb250LWZhY2UnLCAnZm9udC1mYWNlLWZvcm1hdCcsICdmb250LWZhY2UtbmFtZScsICdmb250LWZhY2Utc3JjJyxcbiAgJ2ZvbnQtZmFjZS11cmknLCAnZm9yZWlnbk9iamVjdCcsICdnJywgJ2dseXBoJywgJ2dseXBoUmVmJywgJ2hrZXJuJywgJ2ltYWdlJyxcbiAgJ2xpbmUnLCAnbGluZWFyR3JhZGllbnQnLCAnbWFya2VyJywgJ21hc2snLCAnbWV0YWRhdGEnLCAnbWlzc2luZy1nbHlwaCcsXG4gICdtcGF0aCcsICdwYXRoJywgJ3BhdHRlcm4nLCAncG9seWdvbicsICdwb2x5bGluZScsICdyYWRpYWxHcmFkaWVudCcsICdyZWN0JyxcbiAgJ3NldCcsICdzdG9wJywgJ3N3aXRjaCcsICdzeW1ib2wnLCAndGV4dCcsICd0ZXh0UGF0aCcsICd0aXRsZScsICd0cmVmJyxcbiAgJ3RzcGFuJywgJ3VzZScsICd2aWV3JywgJ3ZrZXJuJ1xuXVxuIiwibW9kdWxlLmV4cG9ydHMgPSBMUlVcblxuZnVuY3Rpb24gTFJVIChvcHRzKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBMUlUpKSByZXR1cm4gbmV3IExSVShvcHRzKVxuICBpZiAodHlwZW9mIG9wdHMgPT09ICdudW1iZXInKSBvcHRzID0ge21heDogb3B0c31cbiAgaWYgKCFvcHRzKSBvcHRzID0ge31cbiAgdGhpcy5jYWNoZSA9IHt9XG4gIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IG51bGxcbiAgdGhpcy5sZW5ndGggPSAwXG4gIHRoaXMubWF4ID0gb3B0cy5tYXggfHwgMTAwMFxuICB0aGlzLm1heEFnZSA9IG9wdHMubWF4QWdlIHx8IDBcbn1cblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KExSVS5wcm90b3R5cGUsICdrZXlzJywge1xuICBnZXQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuY2FjaGUpIH1cbn0pXG5cbkxSVS5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuY2FjaGUgPSB7fVxuICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSBudWxsXG4gIHRoaXMubGVuZ3RoID0gMFxufVxuXG5MUlUucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSBrZXkgPSAnJyArIGtleVxuICBpZiAoIXRoaXMuY2FjaGUuaGFzT3duUHJvcGVydHkoa2V5KSkgcmV0dXJuXG5cbiAgdmFyIGVsZW1lbnQgPSB0aGlzLmNhY2hlW2tleV1cbiAgZGVsZXRlIHRoaXMuY2FjaGVba2V5XVxuICB0aGlzLl91bmxpbmsoa2V5LCBlbGVtZW50LnByZXYsIGVsZW1lbnQubmV4dClcbiAgcmV0dXJuIGVsZW1lbnQudmFsdWVcbn1cblxuTFJVLnByb3RvdHlwZS5fdW5saW5rID0gZnVuY3Rpb24gKGtleSwgcHJldiwgbmV4dCkge1xuICB0aGlzLmxlbmd0aC0tXG5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gbnVsbFxuICB9IGVsc2Uge1xuICAgIGlmICh0aGlzLmhlYWQgPT09IGtleSkge1xuICAgICAgdGhpcy5oZWFkID0gcHJldlxuICAgICAgdGhpcy5jYWNoZVt0aGlzLmhlYWRdLm5leHQgPSBudWxsXG4gICAgfSBlbHNlIGlmICh0aGlzLnRhaWwgPT09IGtleSkge1xuICAgICAgdGhpcy50YWlsID0gbmV4dFxuICAgICAgdGhpcy5jYWNoZVt0aGlzLnRhaWxdLnByZXYgPSBudWxsXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2FjaGVbcHJldl0ubmV4dCA9IG5leHRcbiAgICAgIHRoaXMuY2FjaGVbbmV4dF0ucHJldiA9IHByZXZcbiAgICB9XG4gIH1cbn1cblxuTFJVLnByb3RvdHlwZS5wZWVrID0gZnVuY3Rpb24gKGtleSkge1xuICBpZiAoIXRoaXMuY2FjaGUuaGFzT3duUHJvcGVydHkoa2V5KSkgcmV0dXJuXG5cbiAgdmFyIGVsZW1lbnQgPSB0aGlzLmNhY2hlW2tleV1cblxuICBpZiAoIXRoaXMuX2NoZWNrQWdlKGtleSwgZWxlbWVudCkpIHJldHVyblxuICByZXR1cm4gZWxlbWVudC52YWx1ZVxufVxuXG5MUlUucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gIGlmICh0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykga2V5ID0gJycgKyBrZXlcblxuICB2YXIgZWxlbWVudFxuXG4gIGlmICh0aGlzLmNhY2hlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICBlbGVtZW50ID0gdGhpcy5jYWNoZVtrZXldXG4gICAgZWxlbWVudC52YWx1ZSA9IHZhbHVlXG4gICAgaWYgKHRoaXMubWF4QWdlKSBlbGVtZW50Lm1vZGlmaWVkID0gRGF0ZS5ub3coKVxuXG4gICAgLy8gSWYgaXQncyBhbHJlYWR5IHRoZSBoZWFkLCB0aGVyZSdzIG5vdGhpbmcgbW9yZSB0byBkbzpcbiAgICBpZiAoa2V5ID09PSB0aGlzLmhlYWQpIHJldHVybiB2YWx1ZVxuICAgIHRoaXMuX3VubGluayhrZXksIGVsZW1lbnQucHJldiwgZWxlbWVudC5uZXh0KVxuICB9IGVsc2Uge1xuICAgIGVsZW1lbnQgPSB7dmFsdWU6IHZhbHVlLCBtb2RpZmllZDogMCwgbmV4dDogbnVsbCwgcHJldjogbnVsbH1cbiAgICBpZiAodGhpcy5tYXhBZ2UpIGVsZW1lbnQubW9kaWZpZWQgPSBEYXRlLm5vdygpXG4gICAgdGhpcy5jYWNoZVtrZXldID0gZWxlbWVudFxuXG4gICAgLy8gRXZpY3Rpb24gaXMgb25seSBwb3NzaWJsZSBpZiB0aGUga2V5IGRpZG4ndCBhbHJlYWR5IGV4aXN0OlxuICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gdGhpcy5tYXgpIHRoaXMuZXZpY3QoKVxuICB9XG5cbiAgdGhpcy5sZW5ndGgrK1xuICBlbGVtZW50Lm5leHQgPSBudWxsXG4gIGVsZW1lbnQucHJldiA9IHRoaXMuaGVhZFxuXG4gIGlmICh0aGlzLmhlYWQpIHRoaXMuY2FjaGVbdGhpcy5oZWFkXS5uZXh0ID0ga2V5XG4gIHRoaXMuaGVhZCA9IGtleVxuXG4gIGlmICghdGhpcy50YWlsKSB0aGlzLnRhaWwgPSBrZXlcbiAgcmV0dXJuIHZhbHVlXG59XG5cbkxSVS5wcm90b3R5cGUuX2NoZWNrQWdlID0gZnVuY3Rpb24gKGtleSwgZWxlbWVudCkge1xuICBpZiAodGhpcy5tYXhBZ2UgJiYgKERhdGUubm93KCkgLSBlbGVtZW50Lm1vZGlmaWVkKSA+IHRoaXMubWF4QWdlKSB7XG4gICAgdGhpcy5yZW1vdmUoa2V5KVxuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIHJldHVybiB0cnVlXG59XG5cbkxSVS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xuICBpZiAodHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIGtleSA9ICcnICsga2V5XG4gIGlmICghdGhpcy5jYWNoZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSByZXR1cm5cblxuICB2YXIgZWxlbWVudCA9IHRoaXMuY2FjaGVba2V5XVxuXG4gIGlmICghdGhpcy5fY2hlY2tBZ2Uoa2V5LCBlbGVtZW50KSkgcmV0dXJuXG5cbiAgaWYgKHRoaXMuaGVhZCAhPT0ga2V5KSB7XG4gICAgaWYgKGtleSA9PT0gdGhpcy50YWlsKSB7XG4gICAgICB0aGlzLnRhaWwgPSBlbGVtZW50Lm5leHRcbiAgICAgIHRoaXMuY2FjaGVbdGhpcy50YWlsXS5wcmV2ID0gbnVsbFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTZXQgcHJldi5uZXh0IC0+IGVsZW1lbnQubmV4dDpcbiAgICAgIHRoaXMuY2FjaGVbZWxlbWVudC5wcmV2XS5uZXh0ID0gZWxlbWVudC5uZXh0XG4gICAgfVxuXG4gICAgLy8gU2V0IGVsZW1lbnQubmV4dC5wcmV2IC0+IGVsZW1lbnQucHJldjpcbiAgICB0aGlzLmNhY2hlW2VsZW1lbnQubmV4dF0ucHJldiA9IGVsZW1lbnQucHJldlxuXG4gICAgLy8gRWxlbWVudCBpcyB0aGUgbmV3IGhlYWRcbiAgICB0aGlzLmNhY2hlW3RoaXMuaGVhZF0ubmV4dCA9IGtleVxuICAgIGVsZW1lbnQucHJldiA9IHRoaXMuaGVhZFxuICAgIGVsZW1lbnQubmV4dCA9IG51bGxcbiAgICB0aGlzLmhlYWQgPSBrZXlcbiAgfVxuXG4gIHJldHVybiBlbGVtZW50LnZhbHVlXG59XG5cbkxSVS5wcm90b3R5cGUuZXZpY3QgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy50YWlsKSByZXR1cm5cbiAgdGhpcy5yZW1vdmUodGhpcy50YWlsKVxufVxuIiwidmFyIGFzc2VydCA9IHJlcXVpcmUoJ25hbm9hc3NlcnQnKVxudmFyIG1vcnBoID0gcmVxdWlyZSgnLi9saWIvbW9ycGgnKVxuXG52YXIgVEVYVF9OT0RFID0gM1xuLy8gdmFyIERFQlVHID0gZmFsc2VcblxubW9kdWxlLmV4cG9ydHMgPSBuYW5vbW9ycGhcblxuLy8gTW9ycGggb25lIHRyZWUgaW50byBhbm90aGVyIHRyZWVcbi8vXG4vLyBubyBwYXJlbnRcbi8vICAgLT4gc2FtZTogZGlmZiBhbmQgd2FsayBjaGlsZHJlblxuLy8gICAtPiBub3Qgc2FtZTogcmVwbGFjZSBhbmQgcmV0dXJuXG4vLyBvbGQgbm9kZSBkb2Vzbid0IGV4aXN0XG4vLyAgIC0+IGluc2VydCBuZXcgbm9kZVxuLy8gbmV3IG5vZGUgZG9lc24ndCBleGlzdFxuLy8gICAtPiBkZWxldGUgb2xkIG5vZGVcbi8vIG5vZGVzIGFyZSBub3QgdGhlIHNhbWVcbi8vICAgLT4gZGlmZiBub2RlcyBhbmQgYXBwbHkgcGF0Y2ggdG8gb2xkIG5vZGVcbi8vIG5vZGVzIGFyZSB0aGUgc2FtZVxuLy8gICAtPiB3YWxrIGFsbCBjaGlsZCBub2RlcyBhbmQgYXBwZW5kIHRvIG9sZCBub2RlXG5mdW5jdGlvbiBuYW5vbW9ycGggKG9sZFRyZWUsIG5ld1RyZWUsIG9wdGlvbnMpIHtcbiAgLy8gaWYgKERFQlVHKSB7XG4gIC8vICAgY29uc29sZS5sb2coXG4gIC8vICAgJ25hbm9tb3JwaFxcbm9sZFxcbiAgJXNcXG5uZXdcXG4gICVzJyxcbiAgLy8gICBvbGRUcmVlICYmIG9sZFRyZWUub3V0ZXJIVE1MLFxuICAvLyAgIG5ld1RyZWUgJiYgbmV3VHJlZS5vdXRlckhUTUxcbiAgLy8gKVxuICAvLyB9XG4gIGFzc2VydC5lcXVhbCh0eXBlb2Ygb2xkVHJlZSwgJ29iamVjdCcsICduYW5vbW9ycGg6IG9sZFRyZWUgc2hvdWxkIGJlIGFuIG9iamVjdCcpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbmV3VHJlZSwgJ29iamVjdCcsICduYW5vbW9ycGg6IG5ld1RyZWUgc2hvdWxkIGJlIGFuIG9iamVjdCcpXG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5jaGlsZHJlbk9ubHkpIHtcbiAgICB1cGRhdGVDaGlsZHJlbihuZXdUcmVlLCBvbGRUcmVlKVxuICAgIHJldHVybiBvbGRUcmVlXG4gIH1cblxuICBhc3NlcnQubm90RXF1YWwoXG4gICAgbmV3VHJlZS5ub2RlVHlwZSxcbiAgICAxMSxcbiAgICAnbmFub21vcnBoOiBuZXdUcmVlIHNob3VsZCBoYXZlIG9uZSByb290IG5vZGUgKHdoaWNoIGlzIG5vdCBhIERvY3VtZW50RnJhZ21lbnQpJ1xuICApXG5cbiAgcmV0dXJuIHdhbGsobmV3VHJlZSwgb2xkVHJlZSlcbn1cblxuLy8gV2FsayBhbmQgbW9ycGggYSBkb20gdHJlZVxuZnVuY3Rpb24gd2FsayAobmV3Tm9kZSwgb2xkTm9kZSkge1xuICAvLyBpZiAoREVCVUcpIHtcbiAgLy8gICBjb25zb2xlLmxvZyhcbiAgLy8gICAnd2Fsa1xcbm9sZFxcbiAgJXNcXG5uZXdcXG4gICVzJyxcbiAgLy8gICBvbGROb2RlICYmIG9sZE5vZGUub3V0ZXJIVE1MLFxuICAvLyAgIG5ld05vZGUgJiYgbmV3Tm9kZS5vdXRlckhUTUxcbiAgLy8gKVxuICAvLyB9XG4gIGlmICghb2xkTm9kZSkge1xuICAgIHJldHVybiBuZXdOb2RlXG4gIH0gZWxzZSBpZiAoIW5ld05vZGUpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9IGVsc2UgaWYgKG5ld05vZGUuaXNTYW1lTm9kZSAmJiBuZXdOb2RlLmlzU2FtZU5vZGUob2xkTm9kZSkpIHtcbiAgICByZXR1cm4gb2xkTm9kZVxuICB9IGVsc2UgaWYgKG5ld05vZGUudGFnTmFtZSAhPT0gb2xkTm9kZS50YWdOYW1lIHx8IGdldENvbXBvbmVudElkKG5ld05vZGUpICE9PSBnZXRDb21wb25lbnRJZChvbGROb2RlKSkge1xuICAgIHJldHVybiBuZXdOb2RlXG4gIH0gZWxzZSB7XG4gICAgbW9ycGgobmV3Tm9kZSwgb2xkTm9kZSlcbiAgICB1cGRhdGVDaGlsZHJlbihuZXdOb2RlLCBvbGROb2RlKVxuICAgIHJldHVybiBvbGROb2RlXG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50SWQgKG5vZGUpIHtcbiAgcmV0dXJuIG5vZGUuZGF0YXNldCA/IG5vZGUuZGF0YXNldC5uYW5vbW9ycGhDb21wb25lbnRJZCA6IHVuZGVmaW5lZFxufVxuXG4vLyBVcGRhdGUgdGhlIGNoaWxkcmVuIG9mIGVsZW1lbnRzXG4vLyAob2JqLCBvYmopIC0+IG51bGxcbmZ1bmN0aW9uIHVwZGF0ZUNoaWxkcmVuIChuZXdOb2RlLCBvbGROb2RlKSB7XG4gIC8vIGlmIChERUJVRykge1xuICAvLyAgIGNvbnNvbGUubG9nKFxuICAvLyAgICd1cGRhdGVDaGlsZHJlblxcbm9sZFxcbiAgJXNcXG5uZXdcXG4gICVzJyxcbiAgLy8gICBvbGROb2RlICYmIG9sZE5vZGUub3V0ZXJIVE1MLFxuICAvLyAgIG5ld05vZGUgJiYgbmV3Tm9kZS5vdXRlckhUTUxcbiAgLy8gKVxuICAvLyB9XG4gIHZhciBvbGRDaGlsZCwgbmV3Q2hpbGQsIG1vcnBoZWQsIG9sZE1hdGNoXG5cbiAgLy8gVGhlIG9mZnNldCBpcyBvbmx5IGV2ZXIgaW5jcmVhc2VkLCBhbmQgdXNlZCBmb3IgW2kgLSBvZmZzZXRdIGluIHRoZSBsb29wXG4gIHZhciBvZmZzZXQgPSAwXG5cbiAgZm9yICh2YXIgaSA9IDA7IDsgaSsrKSB7XG4gICAgb2xkQ2hpbGQgPSBvbGROb2RlLmNoaWxkTm9kZXNbaV1cbiAgICBuZXdDaGlsZCA9IG5ld05vZGUuY2hpbGROb2Rlc1tpIC0gb2Zmc2V0XVxuICAgIC8vIGlmIChERUJVRykge1xuICAgIC8vICAgY29uc29sZS5sb2coXG4gICAgLy8gICAnPT09XFxuLSBvbGRcXG4gICVzXFxuLSBuZXdcXG4gICVzJyxcbiAgICAvLyAgIG9sZENoaWxkICYmIG9sZENoaWxkLm91dGVySFRNTCxcbiAgICAvLyAgIG5ld0NoaWxkICYmIG5ld0NoaWxkLm91dGVySFRNTFxuICAgIC8vIClcbiAgICAvLyB9XG4gICAgLy8gQm90aCBub2RlcyBhcmUgZW1wdHksIGRvIG5vdGhpbmdcbiAgICBpZiAoIW9sZENoaWxkICYmICFuZXdDaGlsZCkge1xuICAgICAgYnJlYWtcblxuICAgIC8vIFRoZXJlIGlzIG5vIG5ldyBjaGlsZCwgcmVtb3ZlIG9sZFxuICAgIH0gZWxzZSBpZiAoIW5ld0NoaWxkKSB7XG4gICAgICBvbGROb2RlLnJlbW92ZUNoaWxkKG9sZENoaWxkKVxuICAgICAgaS0tXG5cbiAgICAvLyBUaGVyZSBpcyBubyBvbGQgY2hpbGQsIGFkZCBuZXdcbiAgICB9IGVsc2UgaWYgKCFvbGRDaGlsZCkge1xuICAgICAgb2xkTm9kZS5hcHBlbmRDaGlsZChuZXdDaGlsZClcbiAgICAgIG9mZnNldCsrXG5cbiAgICAvLyBCb3RoIG5vZGVzIGFyZSB0aGUgc2FtZSwgbW9ycGhcbiAgICB9IGVsc2UgaWYgKHNhbWUobmV3Q2hpbGQsIG9sZENoaWxkKSkge1xuICAgICAgbW9ycGhlZCA9IHdhbGsobmV3Q2hpbGQsIG9sZENoaWxkKVxuICAgICAgaWYgKG1vcnBoZWQgIT09IG9sZENoaWxkKSB7XG4gICAgICAgIG9sZE5vZGUucmVwbGFjZUNoaWxkKG1vcnBoZWQsIG9sZENoaWxkKVxuICAgICAgICBvZmZzZXQrK1xuICAgICAgfVxuXG4gICAgLy8gQm90aCBub2RlcyBkbyBub3Qgc2hhcmUgYW4gSUQgb3IgYSBwbGFjZWhvbGRlciwgdHJ5IHJlb3JkZXJcbiAgICB9IGVsc2Uge1xuICAgICAgb2xkTWF0Y2ggPSBudWxsXG5cbiAgICAgIC8vIFRyeSBhbmQgZmluZCBhIHNpbWlsYXIgbm9kZSBzb21ld2hlcmUgaW4gdGhlIHRyZWVcbiAgICAgIGZvciAodmFyIGogPSBpOyBqIDwgb2xkTm9kZS5jaGlsZE5vZGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChzYW1lKG9sZE5vZGUuY2hpbGROb2Rlc1tqXSwgbmV3Q2hpbGQpKSB7XG4gICAgICAgICAgb2xkTWF0Y2ggPSBvbGROb2RlLmNoaWxkTm9kZXNbal1cbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoZXJlIHdhcyBhIG5vZGUgd2l0aCB0aGUgc2FtZSBJRCBvciBwbGFjZWhvbGRlciBpbiB0aGUgb2xkIGxpc3RcbiAgICAgIGlmIChvbGRNYXRjaCkge1xuICAgICAgICBtb3JwaGVkID0gd2FsayhuZXdDaGlsZCwgb2xkTWF0Y2gpXG4gICAgICAgIGlmIChtb3JwaGVkICE9PSBvbGRNYXRjaCkgb2Zmc2V0KytcbiAgICAgICAgb2xkTm9kZS5pbnNlcnRCZWZvcmUobW9ycGhlZCwgb2xkQ2hpbGQpXG5cbiAgICAgIC8vIEl0J3Mgc2FmZSB0byBtb3JwaCB0d28gbm9kZXMgaW4tcGxhY2UgaWYgbmVpdGhlciBoYXMgYW4gSURcbiAgICAgIH0gZWxzZSBpZiAoIW5ld0NoaWxkLmlkICYmICFvbGRDaGlsZC5pZCkge1xuICAgICAgICBtb3JwaGVkID0gd2FsayhuZXdDaGlsZCwgb2xkQ2hpbGQpXG4gICAgICAgIGlmIChtb3JwaGVkICE9PSBvbGRDaGlsZCkge1xuICAgICAgICAgIG9sZE5vZGUucmVwbGFjZUNoaWxkKG1vcnBoZWQsIG9sZENoaWxkKVxuICAgICAgICAgIG9mZnNldCsrXG4gICAgICAgIH1cblxuICAgICAgLy8gSW5zZXJ0IHRoZSBub2RlIGF0IHRoZSBpbmRleCBpZiB3ZSBjb3VsZG4ndCBtb3JwaCBvciBmaW5kIGEgbWF0Y2hpbmcgbm9kZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2xkTm9kZS5pbnNlcnRCZWZvcmUobmV3Q2hpbGQsIG9sZENoaWxkKVxuICAgICAgICBvZmZzZXQrK1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBzYW1lIChhLCBiKSB7XG4gIGlmIChhLmlkKSByZXR1cm4gYS5pZCA9PT0gYi5pZFxuICBpZiAoYS5pc1NhbWVOb2RlKSByZXR1cm4gYS5pc1NhbWVOb2RlKGIpXG4gIGlmIChhLnRhZ05hbWUgIT09IGIudGFnTmFtZSkgcmV0dXJuIGZhbHNlXG4gIGlmIChhLnR5cGUgPT09IFRFWFRfTk9ERSkgcmV0dXJuIGEubm9kZVZhbHVlID09PSBiLm5vZGVWYWx1ZVxuICByZXR1cm4gZmFsc2Vcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAvLyBhdHRyaWJ1dGUgZXZlbnRzIChjYW4gYmUgc2V0IHdpdGggYXR0cmlidXRlcylcbiAgJ29uY2xpY2snLFxuICAnb25kYmxjbGljaycsXG4gICdvbm1vdXNlZG93bicsXG4gICdvbm1vdXNldXAnLFxuICAnb25tb3VzZW92ZXInLFxuICAnb25tb3VzZW1vdmUnLFxuICAnb25tb3VzZW91dCcsXG4gICdvbm1vdXNlZW50ZXInLFxuICAnb25tb3VzZWxlYXZlJyxcbiAgJ29udG91Y2hjYW5jZWwnLFxuICAnb250b3VjaGVuZCcsXG4gICdvbnRvdWNobW92ZScsXG4gICdvbnRvdWNoc3RhcnQnLFxuICAnb25kcmFnc3RhcnQnLFxuICAnb25kcmFnJyxcbiAgJ29uZHJhZ2VudGVyJyxcbiAgJ29uZHJhZ2xlYXZlJyxcbiAgJ29uZHJhZ292ZXInLFxuICAnb25kcm9wJyxcbiAgJ29uZHJhZ2VuZCcsXG4gICdvbmtleWRvd24nLFxuICAnb25rZXlwcmVzcycsXG4gICdvbmtleXVwJyxcbiAgJ29udW5sb2FkJyxcbiAgJ29uYWJvcnQnLFxuICAnb25lcnJvcicsXG4gICdvbnJlc2l6ZScsXG4gICdvbnNjcm9sbCcsXG4gICdvbnNlbGVjdCcsXG4gICdvbmNoYW5nZScsXG4gICdvbnN1Ym1pdCcsXG4gICdvbnJlc2V0JyxcbiAgJ29uZm9jdXMnLFxuICAnb25ibHVyJyxcbiAgJ29uaW5wdXQnLFxuICAnb25hbmltYXRpb25lbmQnLFxuICAnb25hbmltYXRpb25pdGVyYXRpb24nLFxuICAnb25hbmltYXRpb25zdGFydCcsXG4gIC8vIG90aGVyIGNvbW1vbiBldmVudHNcbiAgJ29uY29udGV4dG1lbnUnLFxuICAnb25mb2N1c2luJyxcbiAgJ29uZm9jdXNvdXQnXG5dXG4iLCJ2YXIgZXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMnKVxudmFyIGV2ZW50c0xlbmd0aCA9IGV2ZW50cy5sZW5ndGhcblxudmFyIEVMRU1FTlRfTk9ERSA9IDFcbnZhciBURVhUX05PREUgPSAzXG52YXIgQ09NTUVOVF9OT0RFID0gOFxuXG5tb2R1bGUuZXhwb3J0cyA9IG1vcnBoXG5cbi8vIGRpZmYgZWxlbWVudHMgYW5kIGFwcGx5IHRoZSByZXN1bHRpbmcgcGF0Y2ggdG8gdGhlIG9sZCBub2RlXG4vLyAob2JqLCBvYmopIC0+IG51bGxcbmZ1bmN0aW9uIG1vcnBoIChuZXdOb2RlLCBvbGROb2RlKSB7XG4gIHZhciBub2RlVHlwZSA9IG5ld05vZGUubm9kZVR5cGVcbiAgdmFyIG5vZGVOYW1lID0gbmV3Tm9kZS5ub2RlTmFtZVxuXG4gIGlmIChub2RlVHlwZSA9PT0gRUxFTUVOVF9OT0RFKSB7XG4gICAgY29weUF0dHJzKG5ld05vZGUsIG9sZE5vZGUpXG4gIH1cblxuICBpZiAobm9kZVR5cGUgPT09IFRFWFRfTk9ERSB8fCBub2RlVHlwZSA9PT0gQ09NTUVOVF9OT0RFKSB7XG4gICAgaWYgKG9sZE5vZGUubm9kZVZhbHVlICE9PSBuZXdOb2RlLm5vZGVWYWx1ZSkge1xuICAgICAgb2xkTm9kZS5ub2RlVmFsdWUgPSBuZXdOb2RlLm5vZGVWYWx1ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgRE9NIG5vZGVzIGFyZSB3ZWlyZFxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGF0cmljay1zdGVlbGUtaWRlbS9tb3JwaGRvbS9ibG9iL21hc3Rlci9zcmMvc3BlY2lhbEVsSGFuZGxlcnMuanNcbiAgaWYgKG5vZGVOYW1lID09PSAnSU5QVVQnKSB1cGRhdGVJbnB1dChuZXdOb2RlLCBvbGROb2RlKVxuICBlbHNlIGlmIChub2RlTmFtZSA9PT0gJ09QVElPTicpIHVwZGF0ZU9wdGlvbihuZXdOb2RlLCBvbGROb2RlKVxuICBlbHNlIGlmIChub2RlTmFtZSA9PT0gJ1RFWFRBUkVBJykgdXBkYXRlVGV4dGFyZWEobmV3Tm9kZSwgb2xkTm9kZSlcblxuICBjb3B5RXZlbnRzKG5ld05vZGUsIG9sZE5vZGUpXG59XG5cbmZ1bmN0aW9uIGNvcHlBdHRycyAobmV3Tm9kZSwgb2xkTm9kZSkge1xuICB2YXIgb2xkQXR0cnMgPSBvbGROb2RlLmF0dHJpYnV0ZXNcbiAgdmFyIG5ld0F0dHJzID0gbmV3Tm9kZS5hdHRyaWJ1dGVzXG4gIHZhciBhdHRyTmFtZXNwYWNlVVJJID0gbnVsbFxuICB2YXIgYXR0clZhbHVlID0gbnVsbFxuICB2YXIgZnJvbVZhbHVlID0gbnVsbFxuICB2YXIgYXR0ck5hbWUgPSBudWxsXG4gIHZhciBhdHRyID0gbnVsbFxuXG4gIGZvciAodmFyIGkgPSBuZXdBdHRycy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgIGF0dHIgPSBuZXdBdHRyc1tpXVxuICAgIGF0dHJOYW1lID0gYXR0ci5uYW1lXG4gICAgYXR0ck5hbWVzcGFjZVVSSSA9IGF0dHIubmFtZXNwYWNlVVJJXG4gICAgYXR0clZhbHVlID0gYXR0ci52YWx1ZVxuICAgIGlmIChhdHRyTmFtZXNwYWNlVVJJKSB7XG4gICAgICBhdHRyTmFtZSA9IGF0dHIubG9jYWxOYW1lIHx8IGF0dHJOYW1lXG4gICAgICBmcm9tVmFsdWUgPSBvbGROb2RlLmdldEF0dHJpYnV0ZU5TKGF0dHJOYW1lc3BhY2VVUkksIGF0dHJOYW1lKVxuICAgICAgaWYgKGZyb21WYWx1ZSAhPT0gYXR0clZhbHVlKSB7XG4gICAgICAgIG9sZE5vZGUuc2V0QXR0cmlidXRlTlMoYXR0ck5hbWVzcGFjZVVSSSwgYXR0ck5hbWUsIGF0dHJWYWx1ZSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFvbGROb2RlLmhhc0F0dHJpYnV0ZShhdHRyTmFtZSkpIHtcbiAgICAgICAgb2xkTm9kZS5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyb21WYWx1ZSA9IG9sZE5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICBpZiAoZnJvbVZhbHVlICE9PSBhdHRyVmFsdWUpIHtcbiAgICAgICAgICAvLyBhcHBhcmVudGx5IHZhbHVlcyBhcmUgYWx3YXlzIGNhc3QgdG8gc3RyaW5ncywgYWggd2VsbFxuICAgICAgICAgIGlmIChhdHRyVmFsdWUgPT09ICdudWxsJyB8fCBhdHRyVmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvbGROb2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb2xkTm9kZS5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBSZW1vdmUgYW55IGV4dHJhIGF0dHJpYnV0ZXMgZm91bmQgb24gdGhlIG9yaWdpbmFsIERPTSBlbGVtZW50IHRoYXRcbiAgLy8gd2VyZW4ndCBmb3VuZCBvbiB0aGUgdGFyZ2V0IGVsZW1lbnQuXG4gIGZvciAodmFyIGogPSBvbGRBdHRycy5sZW5ndGggLSAxOyBqID49IDA7IC0taikge1xuICAgIGF0dHIgPSBvbGRBdHRyc1tqXVxuICAgIGlmIChhdHRyLnNwZWNpZmllZCAhPT0gZmFsc2UpIHtcbiAgICAgIGF0dHJOYW1lID0gYXR0ci5uYW1lXG4gICAgICBhdHRyTmFtZXNwYWNlVVJJID0gYXR0ci5uYW1lc3BhY2VVUklcblxuICAgICAgaWYgKGF0dHJOYW1lc3BhY2VVUkkpIHtcbiAgICAgICAgYXR0ck5hbWUgPSBhdHRyLmxvY2FsTmFtZSB8fCBhdHRyTmFtZVxuICAgICAgICBpZiAoIW5ld05vZGUuaGFzQXR0cmlidXRlTlMoYXR0ck5hbWVzcGFjZVVSSSwgYXR0ck5hbWUpKSB7XG4gICAgICAgICAgb2xkTm9kZS5yZW1vdmVBdHRyaWJ1dGVOUyhhdHRyTmFtZXNwYWNlVVJJLCBhdHRyTmFtZSlcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFuZXdOb2RlLmhhc0F0dHJpYnV0ZU5TKG51bGwsIGF0dHJOYW1lKSkge1xuICAgICAgICAgIG9sZE5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNvcHlFdmVudHMgKG5ld05vZGUsIG9sZE5vZGUpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBldmVudHNMZW5ndGg7IGkrKykge1xuICAgIHZhciBldiA9IGV2ZW50c1tpXVxuICAgIGlmIChuZXdOb2RlW2V2XSkgeyAgICAgICAgICAgLy8gaWYgbmV3IGVsZW1lbnQgaGFzIGEgd2hpdGVsaXN0ZWQgYXR0cmlidXRlXG4gICAgICBvbGROb2RlW2V2XSA9IG5ld05vZGVbZXZdICAvLyB1cGRhdGUgZXhpc3RpbmcgZWxlbWVudFxuICAgIH0gZWxzZSBpZiAob2xkTm9kZVtldl0pIHsgICAgLy8gaWYgZXhpc3RpbmcgZWxlbWVudCBoYXMgaXQgYW5kIG5ldyBvbmUgZG9lc250XG4gICAgICBvbGROb2RlW2V2XSA9IHVuZGVmaW5lZCAgICAvLyByZW1vdmUgaXQgZnJvbSBleGlzdGluZyBlbGVtZW50XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZU9wdGlvbiAobmV3Tm9kZSwgb2xkTm9kZSkge1xuICB1cGRhdGVBdHRyaWJ1dGUobmV3Tm9kZSwgb2xkTm9kZSwgJ3NlbGVjdGVkJylcbn1cblxuLy8gVGhlIFwidmFsdWVcIiBhdHRyaWJ1dGUgaXMgc3BlY2lhbCBmb3IgdGhlIDxpbnB1dD4gZWxlbWVudCBzaW5jZSBpdCBzZXRzIHRoZVxuLy8gaW5pdGlhbCB2YWx1ZS4gQ2hhbmdpbmcgdGhlIFwidmFsdWVcIiBhdHRyaWJ1dGUgd2l0aG91dCBjaGFuZ2luZyB0aGUgXCJ2YWx1ZVwiXG4vLyBwcm9wZXJ0eSB3aWxsIGhhdmUgbm8gZWZmZWN0IHNpbmNlIGl0IGlzIG9ubHkgdXNlZCB0byB0aGUgc2V0IHRoZSBpbml0aWFsXG4vLyB2YWx1ZS4gU2ltaWxhciBmb3IgdGhlIFwiY2hlY2tlZFwiIGF0dHJpYnV0ZSwgYW5kIFwiZGlzYWJsZWRcIi5cbmZ1bmN0aW9uIHVwZGF0ZUlucHV0IChuZXdOb2RlLCBvbGROb2RlKSB7XG4gIHZhciBuZXdWYWx1ZSA9IG5ld05vZGUudmFsdWVcbiAgdmFyIG9sZFZhbHVlID0gb2xkTm9kZS52YWx1ZVxuXG4gIHVwZGF0ZUF0dHJpYnV0ZShuZXdOb2RlLCBvbGROb2RlLCAnY2hlY2tlZCcpXG4gIHVwZGF0ZUF0dHJpYnV0ZShuZXdOb2RlLCBvbGROb2RlLCAnZGlzYWJsZWQnKVxuXG4gIC8vIFRoZSBcImluZGV0ZXJtaW5hdGVcIiBwcm9wZXJ0eSBjYW4gbm90IGJlIHNldCB1c2luZyBhbiBIVE1MIGF0dHJpYnV0ZS5cbiAgLy8gU2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0hUTUwvRWxlbWVudC9pbnB1dC9jaGVja2JveFxuICBpZiAobmV3Tm9kZS5pbmRldGVybWluYXRlICE9PSBvbGROb2RlLmluZGV0ZXJtaW5hdGUpIHtcbiAgICBvbGROb2RlLmluZGV0ZXJtaW5hdGUgPSBuZXdOb2RlLmluZGV0ZXJtaW5hdGVcbiAgfVxuXG4gIC8vIFBlcnNpc3QgZmlsZSB2YWx1ZSBzaW5jZSBmaWxlIGlucHV0cyBjYW4ndCBiZSBjaGFuZ2VkIHByb2dyYW1hdGljYWxseVxuICBpZiAob2xkTm9kZS50eXBlID09PSAnZmlsZScpIHJldHVyblxuXG4gIGlmIChuZXdWYWx1ZSAhPT0gb2xkVmFsdWUpIHtcbiAgICBvbGROb2RlLnNldEF0dHJpYnV0ZSgndmFsdWUnLCBuZXdWYWx1ZSlcbiAgICBvbGROb2RlLnZhbHVlID0gbmV3VmFsdWVcbiAgfVxuXG4gIGlmIChuZXdWYWx1ZSA9PT0gJ251bGwnKSB7XG4gICAgb2xkTm9kZS52YWx1ZSA9ICcnXG4gICAgb2xkTm9kZS5yZW1vdmVBdHRyaWJ1dGUoJ3ZhbHVlJylcbiAgfVxuXG4gIGlmICghbmV3Tm9kZS5oYXNBdHRyaWJ1dGVOUyhudWxsLCAndmFsdWUnKSkge1xuICAgIG9sZE5vZGUucmVtb3ZlQXR0cmlidXRlKCd2YWx1ZScpXG4gIH0gZWxzZSBpZiAob2xkTm9kZS50eXBlID09PSAncmFuZ2UnKSB7XG4gICAgLy8gdGhpcyBpcyBzbyBlbGVtZW50cyBsaWtlIHNsaWRlciBtb3ZlIHRoZWlyIFVJIHRoaW5neVxuICAgIG9sZE5vZGUudmFsdWUgPSBuZXdWYWx1ZVxuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVRleHRhcmVhIChuZXdOb2RlLCBvbGROb2RlKSB7XG4gIHZhciBuZXdWYWx1ZSA9IG5ld05vZGUudmFsdWVcbiAgaWYgKG5ld1ZhbHVlICE9PSBvbGROb2RlLnZhbHVlKSB7XG4gICAgb2xkTm9kZS52YWx1ZSA9IG5ld1ZhbHVlXG4gIH1cblxuICBpZiAob2xkTm9kZS5maXJzdENoaWxkICYmIG9sZE5vZGUuZmlyc3RDaGlsZC5ub2RlVmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgLy8gTmVlZGVkIGZvciBJRS4gQXBwYXJlbnRseSBJRSBzZXRzIHRoZSBwbGFjZWhvbGRlciBhcyB0aGVcbiAgICAvLyBub2RlIHZhbHVlIGFuZCB2aXNlIHZlcnNhLiBUaGlzIGlnbm9yZXMgYW4gZW1wdHkgdXBkYXRlLlxuICAgIGlmIChuZXdWYWx1ZSA9PT0gJycgJiYgb2xkTm9kZS5maXJzdENoaWxkLm5vZGVWYWx1ZSA9PT0gb2xkTm9kZS5wbGFjZWhvbGRlcikge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgb2xkTm9kZS5maXJzdENoaWxkLm5vZGVWYWx1ZSA9IG5ld1ZhbHVlXG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlQXR0cmlidXRlIChuZXdOb2RlLCBvbGROb2RlLCBuYW1lKSB7XG4gIGlmIChuZXdOb2RlW25hbWVdICE9PSBvbGROb2RlW25hbWVdKSB7XG4gICAgb2xkTm9kZVtuYW1lXSA9IG5ld05vZGVbbmFtZV1cbiAgICBpZiAobmV3Tm9kZVtuYW1lXSkge1xuICAgICAgb2xkTm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgJycpXG4gICAgfSBlbHNlIHtcbiAgICAgIG9sZE5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgfVxuICB9XG59XG4iLCJ2YXIgcmVnID0gLyhbXj89Jl0rKSg9KFteJl0qKSk/L2dcbnZhciBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHFzXG5cbmZ1bmN0aW9uIHFzICh1cmwpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiB1cmwsICdzdHJpbmcnLCAnbmFub3F1ZXJ5OiB1cmwgc2hvdWxkIGJlIHR5cGUgc3RyaW5nJylcblxuICB2YXIgb2JqID0ge31cbiAgdXJsLnJlcGxhY2UoL14uKlxcPy8sICcnKS5yZXBsYWNlKHJlZywgZnVuY3Rpb24gKGEwLCBhMSwgYTIsIGEzKSB7XG4gICAgdmFyIHZhbHVlID0gZGVjb2RlVVJJQ29tcG9uZW50KGEzKVxuICAgIHZhciBrZXkgPSBkZWNvZGVVUklDb21wb25lbnQoYTEpXG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmpba2V5XSkpIG9ialtrZXldLnB1c2godmFsdWUpXG4gICAgICBlbHNlIG9ialtrZXldID0gW29ialtrZXldLCB2YWx1ZV1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tleV0gPSB2YWx1ZVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gb2JqXG59XG4iLCIndXNlIHN0cmljdCdcblxudmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG5cbm1vZHVsZS5leHBvcnRzID0gbmFub3JhZlxuXG4vLyBPbmx5IGNhbGwgUkFGIHdoZW4gbmVlZGVkXG4vLyAoZm4sIGZuPykgLT4gZm5cbmZ1bmN0aW9uIG5hbm9yYWYgKHJlbmRlciwgcmFmKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgcmVuZGVyLCAnZnVuY3Rpb24nLCAnbmFub3JhZjogcmVuZGVyIHNob3VsZCBiZSBhIGZ1bmN0aW9uJylcbiAgYXNzZXJ0Lm9rKHR5cGVvZiByYWYgPT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHJhZiA9PT0gJ3VuZGVmaW5lZCcsICduYW5vcmFmOiByYWYgc2hvdWxkIGJlIGEgZnVuY3Rpb24gb3IgdW5kZWZpbmVkJylcblxuICBpZiAoIXJhZikgcmFmID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZVxuICB2YXIgcmVkcmF3U2NoZWR1bGVkID0gZmFsc2VcbiAgdmFyIGFyZ3MgPSBudWxsXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGZyYW1lICgpIHtcbiAgICBpZiAoYXJncyA9PT0gbnVsbCAmJiAhcmVkcmF3U2NoZWR1bGVkKSB7XG4gICAgICByZWRyYXdTY2hlZHVsZWQgPSB0cnVlXG5cbiAgICAgIHJhZihmdW5jdGlvbiByZWRyYXcgKCkge1xuICAgICAgICByZWRyYXdTY2hlZHVsZWQgPSBmYWxzZVxuXG4gICAgICAgIHZhciBsZW5ndGggPSBhcmdzLmxlbmd0aFxuICAgICAgICB2YXIgX2FyZ3MgPSBuZXcgQXJyYXkobGVuZ3RoKVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSBfYXJnc1tpXSA9IGFyZ3NbaV1cblxuICAgICAgICByZW5kZXIuYXBwbHkocmVuZGVyLCBfYXJncylcbiAgICAgICAgYXJncyA9IG51bGxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgYXJncyA9IGFyZ3VtZW50c1xuICB9XG59XG4iLCJ2YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcbnZhciB3YXlmYXJlciA9IHJlcXVpcmUoJ3dheWZhcmVyJylcblxuLy8gZWxlY3Ryb24gc3VwcG9ydFxudmFyIGlzTG9jYWxGaWxlID0gKC9maWxlOlxcL1xcLy8udGVzdChcbiAgdHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcgJiZcbiAgd2luZG93LmxvY2F0aW9uICYmXG4gIHdpbmRvdy5sb2NhdGlvbi5vcmlnaW5cbikpXG5cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVzZWxlc3MtZXNjYXBlICovXG52YXIgZWxlY3Ryb24gPSAnXihmaWxlOlxcL1xcL3xcXC8pKC4qXFwuaHRtbD9cXC8/KT8nXG52YXIgcHJvdG9jb2wgPSAnXihodHRwKHMpPyg6XFwvXFwvKSk/KHd3d1xcLik/J1xudmFyIGRvbWFpbiA9ICdbYS16QS1aMC05LV9cXC5dKyg6WzAtOV17MSw1fSk/KFxcL3sxfSk/J1xudmFyIHFzID0gJ1tcXD9dLiokJ1xuLyogZXNsaW50LWVuYWJsZSBuby11c2VsZXNzLWVzY2FwZSAqL1xuXG52YXIgc3RyaXBFbGVjdHJvbiA9IG5ldyBSZWdFeHAoZWxlY3Ryb24pXG52YXIgcHJlZml4ID0gbmV3IFJlZ0V4cChwcm90b2NvbCArIGRvbWFpbilcbnZhciBub3JtYWxpemUgPSBuZXcgUmVnRXhwKCcjJylcbnZhciBzdWZmaXggPSBuZXcgUmVnRXhwKHFzKVxuXG5tb2R1bGUuZXhwb3J0cyA9IE5hbm9yb3V0ZXJcblxuZnVuY3Rpb24gTmFub3JvdXRlciAob3B0cykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTmFub3JvdXRlcikpIHJldHVybiBuZXcgTmFub3JvdXRlcihvcHRzKVxuICBvcHRzID0gb3B0cyB8fCB7fVxuICB0aGlzLnJvdXRlciA9IHdheWZhcmVyKG9wdHMuZGVmYXVsdCB8fCAnLzQwNCcpXG59XG5cbk5hbm9yb3V0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKHJvdXRlbmFtZSwgbGlzdGVuZXIpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb3V0ZW5hbWUsICdzdHJpbmcnKVxuICByb3V0ZW5hbWUgPSByb3V0ZW5hbWUucmVwbGFjZSgvXlsjL10vLCAnJylcbiAgdGhpcy5yb3V0ZXIub24ocm91dGVuYW1lLCBsaXN0ZW5lcilcbn1cblxuTmFub3JvdXRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIChyb3V0ZW5hbWUpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb3V0ZW5hbWUsICdzdHJpbmcnKVxuICByb3V0ZW5hbWUgPSBwYXRobmFtZShyb3V0ZW5hbWUsIGlzTG9jYWxGaWxlKVxuICByZXR1cm4gdGhpcy5yb3V0ZXIuZW1pdChyb3V0ZW5hbWUpXG59XG5cbk5hbm9yb3V0ZXIucHJvdG90eXBlLm1hdGNoID0gZnVuY3Rpb24gKHJvdXRlbmFtZSkge1xuICBhc3NlcnQuZXF1YWwodHlwZW9mIHJvdXRlbmFtZSwgJ3N0cmluZycpXG4gIHJvdXRlbmFtZSA9IHBhdGhuYW1lKHJvdXRlbmFtZSwgaXNMb2NhbEZpbGUpXG4gIHJldHVybiB0aGlzLnJvdXRlci5tYXRjaChyb3V0ZW5hbWUpXG59XG5cbi8vIHJlcGxhY2UgZXZlcnl0aGluZyBpbiBhIHJvdXRlIGJ1dCB0aGUgcGF0aG5hbWUgYW5kIGhhc2hcbmZ1bmN0aW9uIHBhdGhuYW1lIChyb3V0ZW5hbWUsIGlzRWxlY3Ryb24pIHtcbiAgaWYgKGlzRWxlY3Ryb24pIHJvdXRlbmFtZSA9IHJvdXRlbmFtZS5yZXBsYWNlKHN0cmlwRWxlY3Ryb24sICcnKVxuICBlbHNlIHJvdXRlbmFtZSA9IHJvdXRlbmFtZS5yZXBsYWNlKHByZWZpeCwgJycpXG4gIHJldHVybiBkZWNvZGVVUkkocm91dGVuYW1lLnJlcGxhY2Uoc3VmZml4LCAnJykucmVwbGFjZShub3JtYWxpemUsICcvJykpXG59XG4iLCJ2YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcblxudmFyIGhhc1dpbmRvdyA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG5cbmZ1bmN0aW9uIGNyZWF0ZVNjaGVkdWxlciAoKSB7XG4gIHZhciBzY2hlZHVsZXJcbiAgaWYgKGhhc1dpbmRvdykge1xuICAgIGlmICghd2luZG93Ll9uYW5vU2NoZWR1bGVyKSB3aW5kb3cuX25hbm9TY2hlZHVsZXIgPSBuZXcgTmFub1NjaGVkdWxlcih0cnVlKVxuICAgIHNjaGVkdWxlciA9IHdpbmRvdy5fbmFub1NjaGVkdWxlclxuICB9IGVsc2Uge1xuICAgIHNjaGVkdWxlciA9IG5ldyBOYW5vU2NoZWR1bGVyKClcbiAgfVxuICByZXR1cm4gc2NoZWR1bGVyXG59XG5cbmZ1bmN0aW9uIE5hbm9TY2hlZHVsZXIgKGhhc1dpbmRvdykge1xuICB0aGlzLmhhc1dpbmRvdyA9IGhhc1dpbmRvd1xuICB0aGlzLmhhc0lkbGUgPSB0aGlzLmhhc1dpbmRvdyAmJiB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja1xuICB0aGlzLm1ldGhvZCA9IHRoaXMuaGFzSWRsZSA/IHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrLmJpbmQod2luZG93KSA6IHRoaXMuc2V0VGltZW91dFxuICB0aGlzLnNjaGVkdWxlZCA9IGZhbHNlXG4gIHRoaXMucXVldWUgPSBbXVxufVxuXG5OYW5vU2NoZWR1bGVyLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGNiKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgY2IsICdmdW5jdGlvbicsICduYW5vc2NoZWR1bGVyLnB1c2g6IGNiIHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcblxuICB0aGlzLnF1ZXVlLnB1c2goY2IpXG4gIHRoaXMuc2NoZWR1bGUoKVxufVxuXG5OYW5vU2NoZWR1bGVyLnByb3RvdHlwZS5zY2hlZHVsZSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuc2NoZWR1bGVkKSByZXR1cm5cblxuICB0aGlzLnNjaGVkdWxlZCA9IHRydWVcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHRoaXMubWV0aG9kKGZ1bmN0aW9uIChpZGxlRGVhZGxpbmUpIHtcbiAgICB2YXIgY2JcbiAgICB3aGlsZSAoc2VsZi5xdWV1ZS5sZW5ndGggJiYgaWRsZURlYWRsaW5lLnRpbWVSZW1haW5pbmcoKSA+IDApIHtcbiAgICAgIGNiID0gc2VsZi5xdWV1ZS5zaGlmdCgpXG4gICAgICBjYihpZGxlRGVhZGxpbmUpXG4gICAgfVxuICAgIHNlbGYuc2NoZWR1bGVkID0gZmFsc2VcbiAgICBpZiAoc2VsZi5xdWV1ZS5sZW5ndGgpIHNlbGYuc2NoZWR1bGUoKVxuICB9KVxufVxuXG5OYW5vU2NoZWR1bGVyLnByb3RvdHlwZS5zZXRUaW1lb3V0ID0gZnVuY3Rpb24gKGNiKSB7XG4gIHNldFRpbWVvdXQoY2IsIDAsIHtcbiAgICB0aW1lUmVtYWluaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gMVxuICAgIH1cbiAgfSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVTY2hlZHVsZXJcbiIsInZhciBzY2hlZHVsZXIgPSByZXF1aXJlKCduYW5vc2NoZWR1bGVyJykoKVxudmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG5cbnZhciBwZXJmXG5uYW5vdGltaW5nLmRpc2FibGVkID0gdHJ1ZVxudHJ5IHtcbiAgcGVyZiA9IHdpbmRvdy5wZXJmb3JtYW5jZVxuICBuYW5vdGltaW5nLmRpc2FibGVkID0gd2luZG93LmxvY2FsU3RvcmFnZS5ESVNBQkxFX05BTk9USU1JTkcgPT09ICd0cnVlJyB8fCAhcGVyZi5tYXJrXG59IGNhdGNoIChlKSB7IH1cblxubW9kdWxlLmV4cG9ydHMgPSBuYW5vdGltaW5nXG5cbmZ1bmN0aW9uIG5hbm90aW1pbmcgKG5hbWUpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBuYW1lLCAnc3RyaW5nJywgJ25hbm90aW1pbmc6IG5hbWUgc2hvdWxkIGJlIHR5cGUgc3RyaW5nJylcblxuICBpZiAobmFub3RpbWluZy5kaXNhYmxlZCkgcmV0dXJuIG5vb3BcblxuICB2YXIgdXVpZCA9IChwZXJmLm5vdygpICogMTAwMDApLnRvRml4ZWQoKSAlIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSXG4gIHZhciBzdGFydE5hbWUgPSAnc3RhcnQtJyArIHV1aWQgKyAnLScgKyBuYW1lXG4gIHBlcmYubWFyayhzdGFydE5hbWUpXG5cbiAgZnVuY3Rpb24gZW5kIChjYikge1xuICAgIHZhciBlbmROYW1lID0gJ2VuZC0nICsgdXVpZCArICctJyArIG5hbWVcbiAgICBwZXJmLm1hcmsoZW5kTmFtZSlcblxuICAgIHNjaGVkdWxlci5wdXNoKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBlcnIgPSBudWxsXG4gICAgICB0cnkge1xuICAgICAgICB2YXIgbWVhc3VyZU5hbWUgPSBuYW1lICsgJyBbJyArIHV1aWQgKyAnXSdcbiAgICAgICAgcGVyZi5tZWFzdXJlKG1lYXN1cmVOYW1lLCBzdGFydE5hbWUsIGVuZE5hbWUpXG4gICAgICAgIHBlcmYuY2xlYXJNYXJrcyhzdGFydE5hbWUpXG4gICAgICAgIHBlcmYuY2xlYXJNYXJrcyhlbmROYW1lKVxuICAgICAgfSBjYXRjaCAoZSkgeyBlcnIgPSBlIH1cbiAgICAgIGlmIChjYikgY2IoZXJyLCBuYW1lKVxuICAgIH0pXG4gIH1cblxuICBlbmQudXVpZCA9IHV1aWRcbiAgcmV0dXJuIGVuZFxufVxuXG5mdW5jdGlvbiBub29wIChjYikge1xuICBpZiAoY2IpIHtcbiAgICBzY2hlZHVsZXIucHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICBjYihuZXcgRXJyb3IoJ25hbm90aW1pbmc6IHBlcmZvcm1hbmNlIEFQSSB1bmF2YWlsYWJsZScpKVxuICAgIH0pXG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG4vKipcbiAqIFJlbW92ZSBhIHJhbmdlIG9mIGl0ZW1zIGZyb20gYW4gYXJyYXlcbiAqXG4gKiBAZnVuY3Rpb24gcmVtb3ZlSXRlbXNcbiAqIEBwYXJhbSB7QXJyYXk8Kj59IGFyciBUaGUgdGFyZ2V0IGFycmF5XG4gKiBAcGFyYW0ge251bWJlcn0gc3RhcnRJZHggVGhlIGluZGV4IHRvIGJlZ2luIHJlbW92aW5nIGZyb20gKGluY2x1c2l2ZSlcbiAqIEBwYXJhbSB7bnVtYmVyfSByZW1vdmVDb3VudCBIb3cgbWFueSBpdGVtcyB0byByZW1vdmVcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZW1vdmVJdGVtcyAoYXJyLCBzdGFydElkeCwgcmVtb3ZlQ291bnQpIHtcbiAgdmFyIGksIGxlbmd0aCA9IGFyci5sZW5ndGhcblxuICBpZiAoc3RhcnRJZHggPj0gbGVuZ3RoIHx8IHJlbW92ZUNvdW50ID09PSAwKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICByZW1vdmVDb3VudCA9IChzdGFydElkeCArIHJlbW92ZUNvdW50ID4gbGVuZ3RoID8gbGVuZ3RoIC0gc3RhcnRJZHggOiByZW1vdmVDb3VudClcblxuICB2YXIgbGVuID0gbGVuZ3RoIC0gcmVtb3ZlQ291bnRcblxuICBmb3IgKGkgPSBzdGFydElkeDsgaSA8IGxlbjsgKytpKSB7XG4gICAgYXJyW2ldID0gYXJyW2kgKyByZW1vdmVDb3VudF1cbiAgfVxuXG4gIGFyci5sZW5ndGggPSBsZW5cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gc2Nyb2xsVG9BbmNob3JcblxuZnVuY3Rpb24gc2Nyb2xsVG9BbmNob3IgKGFuY2hvciwgb3B0aW9ucykge1xuICBpZiAoYW5jaG9yKSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYW5jaG9yKVxuICAgICAgaWYgKGVsKSBlbC5zY3JvbGxJbnRvVmlldyhvcHRpb25zKVxuICAgIH0gY2F0Y2ggKGUpIHt9XG4gIH1cbn1cbiIsIi8qIGVzbGludC1kaXNhYmxlIG5vZGUvbm8tZGVwcmVjYXRlZC1hcGkgKi9cbnZhciBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKVxudmFyIHRyaWUgPSByZXF1aXJlKCcuL3RyaWUnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFdheWZhcmVyXG5cbi8vIGNyZWF0ZSBhIHJvdXRlclxuLy8gc3RyIC0+IG9ialxuZnVuY3Rpb24gV2F5ZmFyZXIgKGRmdCkge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgV2F5ZmFyZXIpKSByZXR1cm4gbmV3IFdheWZhcmVyKGRmdClcblxuICB2YXIgX2RlZmF1bHQgPSAoZGZ0IHx8ICcnKS5yZXBsYWNlKC9eXFwvLywgJycpXG4gIHZhciBfdHJpZSA9IHRyaWUoKVxuXG4gIGVtaXQuX3RyaWUgPSBfdHJpZVxuICBlbWl0Lm9uID0gb25cbiAgZW1pdC5lbWl0ID0gZW1pdFxuICBlbWl0Lm1hdGNoID0gbWF0Y2hcbiAgZW1pdC5fd2F5ZmFyZXIgPSB0cnVlXG5cbiAgcmV0dXJuIGVtaXRcblxuICAvLyBkZWZpbmUgYSByb3V0ZVxuICAvLyAoc3RyLCBmbikgLT4gb2JqXG4gIGZ1bmN0aW9uIG9uIChyb3V0ZSwgY2IpIHtcbiAgICBhc3NlcnQuZXF1YWwodHlwZW9mIHJvdXRlLCAnc3RyaW5nJylcbiAgICBhc3NlcnQuZXF1YWwodHlwZW9mIGNiLCAnZnVuY3Rpb24nKVxuXG4gICAgcm91dGUgPSByb3V0ZSB8fCAnLydcblxuICAgIGlmIChjYi5fd2F5ZmFyZXIgJiYgY2IuX3RyaWUpIHtcbiAgICAgIF90cmllLm1vdW50KHJvdXRlLCBjYi5fdHJpZS50cmllKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbm9kZSA9IF90cmllLmNyZWF0ZShyb3V0ZSlcbiAgICAgIG5vZGUuY2IgPSBjYlxuICAgICAgbm9kZS5yb3V0ZSA9IHJvdXRlXG4gICAgfVxuXG4gICAgcmV0dXJuIGVtaXRcbiAgfVxuXG4gIC8vIG1hdGNoIGFuZCBjYWxsIGEgcm91dGVcbiAgLy8gKHN0ciwgb2JqPykgLT4gbnVsbFxuICBmdW5jdGlvbiBlbWl0IChyb3V0ZSkge1xuICAgIHZhciBtYXRjaGVkID0gbWF0Y2gocm91dGUpXG5cbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKVxuICAgIGFyZ3NbMF0gPSBtYXRjaGVkLnBhcmFtc1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXVxuICAgIH1cblxuICAgIHJldHVybiBtYXRjaGVkLmNiLmFwcGx5KG1hdGNoZWQuY2IsIGFyZ3MpXG4gIH1cblxuICBmdW5jdGlvbiBtYXRjaCAocm91dGUpIHtcbiAgICBhc3NlcnQubm90RXF1YWwocm91dGUsIHVuZGVmaW5lZCwgXCIncm91dGUnIG11c3QgYmUgZGVmaW5lZFwiKVxuXG4gICAgdmFyIG1hdGNoZWQgPSBfdHJpZS5tYXRjaChyb3V0ZSlcbiAgICBpZiAobWF0Y2hlZCAmJiBtYXRjaGVkLmNiKSByZXR1cm4gbmV3IFJvdXRlKG1hdGNoZWQpXG5cbiAgICB2YXIgZGZ0ID0gX3RyaWUubWF0Y2goX2RlZmF1bHQpXG4gICAgaWYgKGRmdCAmJiBkZnQuY2IpIHJldHVybiBuZXcgUm91dGUoZGZ0KVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKFwicm91dGUgJ1wiICsgcm91dGUgKyBcIicgZGlkIG5vdCBtYXRjaFwiKVxuICB9XG5cbiAgZnVuY3Rpb24gUm91dGUgKG1hdGNoZWQpIHtcbiAgICB0aGlzLmNiID0gbWF0Y2hlZC5jYlxuICAgIHRoaXMucm91dGUgPSBtYXRjaGVkLnJvdXRlXG4gICAgdGhpcy5wYXJhbXMgPSBtYXRjaGVkLnBhcmFtc1xuICB9XG59XG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBub2RlL25vLWRlcHJlY2F0ZWQtYXBpICovXG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcblxubW9kdWxlLmV4cG9ydHMgPSBUcmllXG5cbi8vIGNyZWF0ZSBhIG5ldyB0cmllXG4vLyBudWxsIC0+IG9ialxuZnVuY3Rpb24gVHJpZSAoKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBUcmllKSkgcmV0dXJuIG5ldyBUcmllKClcbiAgdGhpcy50cmllID0geyBub2Rlczoge30gfVxufVxuXG4vLyBjcmVhdGUgYSBub2RlIG9uIHRoZSB0cmllIGF0IHJvdXRlXG4vLyBhbmQgcmV0dXJuIGEgbm9kZVxuLy8gc3RyIC0+IG9ialxuVHJpZS5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKHJvdXRlKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2Ygcm91dGUsICdzdHJpbmcnLCAncm91dGUgc2hvdWxkIGJlIGEgc3RyaW5nJylcbiAgLy8gc3RyaXAgbGVhZGluZyAnLycgYW5kIHNwbGl0IHJvdXRlc1xuICB2YXIgcm91dGVzID0gcm91dGUucmVwbGFjZSgvXlxcLy8sICcnKS5zcGxpdCgnLycpXG5cbiAgZnVuY3Rpb24gY3JlYXRlTm9kZSAoaW5kZXgsIHRyaWUpIHtcbiAgICB2YXIgdGhpc1JvdXRlID0gKGhhcyhyb3V0ZXMsIGluZGV4KSAmJiByb3V0ZXNbaW5kZXhdKVxuICAgIGlmICh0aGlzUm91dGUgPT09IGZhbHNlKSByZXR1cm4gdHJpZVxuXG4gICAgdmFyIG5vZGUgPSBudWxsXG4gICAgaWYgKC9eOnxeXFwqLy50ZXN0KHRoaXNSb3V0ZSkpIHtcbiAgICAgIC8vIGlmIG5vZGUgaXMgYSBuYW1lIG1hdGNoLCBzZXQgbmFtZSBhbmQgYXBwZW5kIHRvICc6JyBub2RlXG4gICAgICBpZiAoIWhhcyh0cmllLm5vZGVzLCAnJCQnKSkge1xuICAgICAgICBub2RlID0geyBub2Rlczoge30gfVxuICAgICAgICB0cmllLm5vZGVzLiQkID0gbm9kZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZSA9IHRyaWUubm9kZXMuJCRcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXNSb3V0ZVswXSA9PT0gJyonKSB7XG4gICAgICAgIHRyaWUud2lsZGNhcmQgPSB0cnVlXG4gICAgICB9XG5cbiAgICAgIHRyaWUubmFtZSA9IHRoaXNSb3V0ZS5yZXBsYWNlKC9eOnxeXFwqLywgJycpXG4gICAgfSBlbHNlIGlmICghaGFzKHRyaWUubm9kZXMsIHRoaXNSb3V0ZSkpIHtcbiAgICAgIG5vZGUgPSB7IG5vZGVzOiB7fSB9XG4gICAgICB0cmllLm5vZGVzW3RoaXNSb3V0ZV0gPSBub2RlXG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUgPSB0cmllLm5vZGVzW3RoaXNSb3V0ZV1cbiAgICB9XG5cbiAgICAvLyB3ZSBtdXN0IHJlY3Vyc2UgZGVlcGVyXG4gICAgcmV0dXJuIGNyZWF0ZU5vZGUoaW5kZXggKyAxLCBub2RlKVxuICB9XG5cbiAgcmV0dXJuIGNyZWF0ZU5vZGUoMCwgdGhpcy50cmllKVxufVxuXG4vLyBtYXRjaCBhIHJvdXRlIG9uIHRoZSB0cmllXG4vLyBhbmQgcmV0dXJuIHRoZSBub2RlXG4vLyBzdHIgLT4gb2JqXG5UcmllLnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uIChyb3V0ZSkge1xuICBhc3NlcnQuZXF1YWwodHlwZW9mIHJvdXRlLCAnc3RyaW5nJywgJ3JvdXRlIHNob3VsZCBiZSBhIHN0cmluZycpXG5cbiAgdmFyIHJvdXRlcyA9IHJvdXRlLnJlcGxhY2UoL15cXC8vLCAnJykuc3BsaXQoJy8nKVxuICB2YXIgcGFyYW1zID0ge31cblxuICBmdW5jdGlvbiBzZWFyY2ggKGluZGV4LCB0cmllKSB7XG4gICAgLy8gZWl0aGVyIHRoZXJlJ3Mgbm8gbWF0Y2gsIG9yIHdlJ3JlIGRvbmUgc2VhcmNoaW5nXG4gICAgaWYgKHRyaWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHZhciB0aGlzUm91dGUgPSByb3V0ZXNbaW5kZXhdXG4gICAgaWYgKHRoaXNSb3V0ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdHJpZVxuXG4gICAgaWYgKGhhcyh0cmllLm5vZGVzLCB0aGlzUm91dGUpKSB7XG4gICAgICAvLyBtYXRjaCByZWd1bGFyIHJvdXRlcyBmaXJzdFxuICAgICAgcmV0dXJuIHNlYXJjaChpbmRleCArIDEsIHRyaWUubm9kZXNbdGhpc1JvdXRlXSlcbiAgICB9IGVsc2UgaWYgKHRyaWUubmFtZSkge1xuICAgICAgLy8gbWF0Y2ggbmFtZWQgcm91dGVzXG4gICAgICB0cnkge1xuICAgICAgICBwYXJhbXNbdHJpZS5uYW1lXSA9IGRlY29kZVVSSUNvbXBvbmVudCh0aGlzUm91dGUpXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBzZWFyY2goaW5kZXgsIHVuZGVmaW5lZClcbiAgICAgIH1cbiAgICAgIHJldHVybiBzZWFyY2goaW5kZXggKyAxLCB0cmllLm5vZGVzLiQkKVxuICAgIH0gZWxzZSBpZiAodHJpZS53aWxkY2FyZCkge1xuICAgICAgLy8gbWF0Y2ggd2lsZGNhcmRzXG4gICAgICB0cnkge1xuICAgICAgICBwYXJhbXMud2lsZGNhcmQgPSBkZWNvZGVVUklDb21wb25lbnQocm91dGVzLnNsaWNlKGluZGV4KS5qb2luKCcvJykpXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBzZWFyY2goaW5kZXgsIHVuZGVmaW5lZClcbiAgICAgIH1cbiAgICAgIC8vIHJldHVybiBlYXJseSwgb3IgZWxzZSBzZWFyY2ggbWF5IGtlZXAgcmVjdXJzaW5nIHRocm91Z2ggdGhlIHdpbGRjYXJkXG4gICAgICByZXR1cm4gdHJpZS5ub2Rlcy4kJFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBubyBtYXRjaGVzIGZvdW5kXG4gICAgICByZXR1cm4gc2VhcmNoKGluZGV4ICsgMSlcbiAgICB9XG4gIH1cblxuICB2YXIgbm9kZSA9IHNlYXJjaCgwLCB0aGlzLnRyaWUpXG5cbiAgaWYgKCFub2RlKSByZXR1cm4gdW5kZWZpbmVkXG4gIG5vZGUgPSBPYmplY3QuYXNzaWduKHt9LCBub2RlKVxuICBub2RlLnBhcmFtcyA9IHBhcmFtc1xuICByZXR1cm4gbm9kZVxufVxuXG4vLyBtb3VudCBhIHRyaWUgb250byBhIG5vZGUgYXQgcm91dGVcbi8vIChzdHIsIG9iaikgLT4gbnVsbFxuVHJpZS5wcm90b3R5cGUubW91bnQgPSBmdW5jdGlvbiAocm91dGUsIHRyaWUpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb3V0ZSwgJ3N0cmluZycsICdyb3V0ZSBzaG91bGQgYmUgYSBzdHJpbmcnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIHRyaWUsICdvYmplY3QnLCAndHJpZSBzaG91bGQgYmUgYSBvYmplY3QnKVxuXG4gIHZhciBzcGxpdCA9IHJvdXRlLnJlcGxhY2UoL15cXC8vLCAnJykuc3BsaXQoJy8nKVxuICB2YXIgbm9kZSA9IG51bGxcbiAgdmFyIGtleSA9IG51bGxcblxuICBpZiAoc3BsaXQubGVuZ3RoID09PSAxKSB7XG4gICAga2V5ID0gc3BsaXRbMF1cbiAgICBub2RlID0gdGhpcy5jcmVhdGUoa2V5KVxuICB9IGVsc2Uge1xuICAgIHZhciBoZWFkID0gc3BsaXQuam9pbignLycpXG4gICAga2V5ID0gc3BsaXRbMF1cbiAgICBub2RlID0gdGhpcy5jcmVhdGUoaGVhZClcbiAgfVxuXG4gIE9iamVjdC5hc3NpZ24obm9kZS5ub2RlcywgdHJpZS5ub2RlcylcbiAgaWYgKHRyaWUubmFtZSkgbm9kZS5uYW1lID0gdHJpZS5uYW1lXG5cbiAgLy8gZGVsZWdhdGUgcHJvcGVydGllcyBmcm9tICcvJyB0byB0aGUgbmV3IG5vZGVcbiAgLy8gJy8nIGNhbm5vdCBiZSByZWFjaGVkIG9uY2UgbW91bnRlZFxuICBpZiAobm9kZS5ub2Rlc1snJ10pIHtcbiAgICBPYmplY3Qua2V5cyhub2RlLm5vZGVzWycnXSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBpZiAoa2V5ID09PSAnbm9kZXMnKSByZXR1cm5cbiAgICAgIG5vZGVba2V5XSA9IG5vZGUubm9kZXNbJyddW2tleV1cbiAgICB9KVxuICAgIE9iamVjdC5hc3NpZ24obm9kZS5ub2Rlcywgbm9kZS5ub2Rlc1snJ10ubm9kZXMpXG4gICAgZGVsZXRlIG5vZGUubm9kZXNbJyddLm5vZGVzXG4gIH1cbn1cblxuZnVuY3Rpb24gaGFzIChvYmplY3QsIHByb3BlcnR5KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSlcbn1cbiIsImNvbnN0IGh0bWwgPSByZXF1aXJlKCdjaG9vL2h0bWwnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHN0YXRlLCBhcHApe1xuXG5cbnJldHVybiBodG1sYFxuICA8ZGl2IGlkPVwiYXBwXCIgY2xhc3M9XCJqb2luIGNvbENlbnRlclwiPlxuICAgIDxoMSBjbGFzcz10aXRsZT5cbiAgICAgIEdhYnJcbiAgICA8L2gxPlxuICAgIDxoMiBjbGFzcz1cIm1vbm9ncmFwaCB1bFwiPlxuICAgICAgUG9kY2FzdCBsaXZlLXN0cmVhbWluZywgcmVjb3JkaW5nLCBhbmQgcmVhbC10aW1lIHRhbGsgd2l0aCBsaXN0ZW5lciBjYWxsLWluLlxuICAgIDwvaDI+XG4gICAgPGEgaHJlZj0vaG9zdCBjbGFzcz1kZW1vPlRyeSB0aGUgRGVtbzwvYT5cbiAgICA8ZGl2IGNsYXNzPVwiZmVhdHVyZXMgZmxleENvbCBjb2xDZW50ZXJcIj5cbiAgICAgIDxoMz5cbiAgICAgICAgVGVzdCAmIEZlYXR1cmVzIGFuZCBJZGVhc1xuICAgICAgPC9oMz5cbiAgICAgIDx1bD5cbiAgICAgICAgPGxpPkxpdmUtU3RyZWFtIGFuZCBSZWNvcmQgQXVkaW8gUG9kY2FzdHM8L2xpPlxuICAgICAgICA8bGk+SG9zdCBMaXN0ZW5lciBDYWxsLUlucywgVGFsayBTaG93cywgUHJlc2VudGF0aW9uczwvbGk+XG4gICAgICAgIDxsaT5DaGF0IGFuZCB0ZXh0PC9saT5cbiAgICAgICAgPGxpPkFjY2VwdCBwYXltZW50cyBhbmQgRG9uYXRpb25zPC9saT5cbiAgICAgICAgPGxpPkNoYXJnZSBmb3IgU3Vic2NyaXB0aW9ucywgTWVtYmVyc2hpcCwgb3IgQ2FsbC1pbnM8L2xpPlxuICAgICAgICA8bGk+UHVibGljIG9yIFByaXZhdGUgU3RyZWFtczwvbGk+XG4gICAgICAgIDxsaT5JbnRlZ3JhdGVkIFNwb25zb3IgUG9ydGFsPC9saT5cbiAgICAgICAgPGxpPlJ1bnMgaW4gdGhlIFdlYiBCcm93c2VyLCBubyBhcHBzIG9yIHBob25lIG51bWJlcnMgbmVlZGVkLCA8YnIgLz4gYnV0IGFsc28gd29ya3MgaW4gbW9iaWxlIGJyb3dzZXJzPC9saT5cbiAgICAgICAgPGxpPsK/QXN5bmNyb25vdXMgQXVkaW8gQ29udmVyc2F0aW9ucz88L2xpPlxuICAgICAgICA8bGk+wr9DYWxsICYgUmVzcG9uc2UgQ29udm9zPzwvbGk+XG4gICAgICAgIDxsaT5DYWxsIDEtOTAwLTU1NS0xMzM3ICQ0Ljk5IGZvciB0aGUgMXN0IG1pbnV0ZS4uLjwvbGk+XG5cbiAgICAgIDwvdWw+XG4gICAgPC9kaXY+XG4gICAgPGltZyBzcmM9R2FicmllbEhvcm4ucG5nIGNsYXNzPWxvZ28gLz5cbiAgPC9kaXY+XG5gXG59XG4iXX0=
