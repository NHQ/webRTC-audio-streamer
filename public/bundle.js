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
    <img src=GabrielHorn.png class=logo />
  </div>
`
}

},{"choo/html":3}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImFwcC5qcyIsIm5vZGVfbW9kdWxlcy9jaG9vL2NvbXBvbmVudC9jYWNoZS5qcyIsIm5vZGVfbW9kdWxlcy9jaG9vL2h0bWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2hvby9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kb2N1bWVudC1yZWFkeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9oeXBlcnNjcmlwdC1hdHRyaWJ1dGUtdG8tcHJvcGVydHkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaHlwZXJ4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL25hbm9hc3NlcnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmFub2J1cy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vaHJlZi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vaHRtbC9saWIvYXBwZW5kLWNoaWxkLmpzIiwibm9kZV9tb2R1bGVzL25hbm9odG1sL2xpYi9ib29sLXByb3BzLmpzIiwibm9kZV9tb2R1bGVzL25hbm9odG1sL2xpYi9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL25hbm9odG1sL2xpYi9kaXJlY3QtcHJvcHMuanMiLCJub2RlX21vZHVsZXMvbmFub2h0bWwvbGliL2RvbS5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vaHRtbC9saWIvc3ZnLXRhZ3MuanMiLCJub2RlX21vZHVsZXMvbmFub2xydS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vbW9ycGgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmFub21vcnBoL2xpYi9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvbmFub21vcnBoL2xpYi9tb3JwaC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vcXVlcnkvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vcmFmL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL25hbm9yb3V0ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmFub3NjaGVkdWxlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uYW5vdGltaW5nL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcmVtb3ZlLWFycmF5LWl0ZW1zL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Njcm9sbC10by1hbmNob3IvaW5kZXguanMiLCJub2RlX21vZHVsZXMvd2F5ZmFyZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvd2F5ZmFyZXIvdHJpZS5qcyIsInRlbXBsYXRlcy9ib2R5LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25LQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvL2ltcG9ydCBcIi4vc3R5bGVzaGVldHMvbWFpbi5jc3NcIjtcbi8vY29uc3QgIGZzID0gcmVxdWlyZSgnZnMnKVxudmFyIGNob28gPSByZXF1aXJlKCdjaG9vJylcbnZhciBodG1sID0gcmVxdWlyZSgnY2hvby9odG1sJylcblxudmFyIGluZGV4ID0gcmVxdWlyZSgnLi90ZW1wbGF0ZXMvYm9keS5qcycpXG5cbnZhciBhcHAgPSBjaG9vKClcbmFwcC5tb3VudChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYXBwJykpXG4vLyBXZSBjYW4gY29tbXVuaWNhdGUgd2l0aCBtYWluIHByb2Nlc3MgdGhyb3VnaCBtZXNzYWdlcy5cbnZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGZ1bmN0aW9uKG11dGF0aW9ucykge1xuLy8gIGNvbnNvbGUubG9nKG11dGF0aW9ucylcbiAgdmFyIG0gPSBtdXRhdGlvbnMucG9wKClcbiAgY29uc29sZS5sb2cobS50YXJnZXQuY2hpbGRyZW4pXG4gIGFwcC5lbWl0dGVyLmVtaXQobS50YXJnZXQuY2hpbGRyZW5bMF0uaWQsIG0udGFyZ2V0LmNoaWxkcmVuWzBdKVxuICBhcHAuZW1pdHRlci5lbWl0KCdsb2FkJykgLy9tLnRhcmdldC5jaGlsZHJlblswXS5pZCwgbS50YXJnZXQuY2hpbGRyZW5bMF0pXG59KTtcblxub2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudCwge2F0dHJpYnV0ZXM6IGZhbHNlLCBjaGlsZExpc3Q6IHRydWUsIGNoYXJhY3RlckRhdGE6IGZhbHNlLCBzdWJ0cmVlOnRydWV9KTtcbi8vb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuXG5hcHAudXNlKGZ1bmN0aW9uKHN0YXRlLCB1cGRhdGUpe1xuICAvL3N0YXRlLmRiID0gZGJcbiAgc3RhdGUudGl0bGUgPSAncDJwaG9uZSdcbiAgc3RhdGUudmlldyA9ICcvJ1xuICB1cGRhdGUub24oJ3ZpZXcnLCBlID0+IHN0YXRlLnZpZXcgPSBlKVxuICB1cGRhdGUub24oJ3Byb2Nlc3MnLCBlID0+IHtcbiAgICB1cGRhdGUucmVuZGVyKClcbiAgICB1cGRhdGUuZW1pdChlLmNhbGxlSWQpIC8vIGNhbGxiYWNrIHRvIHJ1biBKUyBmb3IgaHlwZXJ4IHRlbXBsYXRlc1xuICB9KVxufSlcblxuYXBwLnJvdXRlKCcvJywgc3RhdGUgPT4ge1xuICBhcHAuZW1pdHRlci5lbWl0KCd1bmxvYWQnLCcnKVxuICByZXR1cm4gaW5kZXgoc3RhdGUsIGFwcClcbn0pXG5cbmFwcC5yb3V0ZSgnL2hvc3QnLCBzdGF0ZSA9PiB7XG4gIGFwcC5lbWl0dGVyLmVtaXQoJ3VubG9hZCcsJycpXG4gIHJldHVybiBpbmRleChzdGF0ZSwgYXBwKVxufSlcblxuLy8gbGlzdGVuZXIgcm91dGVcbmFwcC5yb3V0ZSgnL3N0cmVhbS86cGFnZScsIHN0YXRlID0+IHtcbiAgY29uc29sZS5sb2coc3RhdGUpXG4gIGFwcC5lbWl0dGVyLmVtaXQoJ3VubG9hZCcsJycpXG4gIHJldHVybiBpbmRleChzdGF0ZSwgYXBwKVxufSlcbiIsInZhciBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKVxudmFyIExSVSA9IHJlcXVpcmUoJ25hbm9scnUnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENob29Db21wb25lbnRDYWNoZVxuXG5mdW5jdGlvbiBDaG9vQ29tcG9uZW50Q2FjaGUgKHN0YXRlLCBlbWl0LCBscnUpIHtcbiAgYXNzZXJ0Lm9rKHRoaXMgaW5zdGFuY2VvZiBDaG9vQ29tcG9uZW50Q2FjaGUsICdDaG9vQ29tcG9uZW50Q2FjaGUgc2hvdWxkIGJlIGNyZWF0ZWQgd2l0aCBgbmV3YCcpXG5cbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBzdGF0ZSwgJ29iamVjdCcsICdDaG9vQ29tcG9uZW50Q2FjaGU6IHN0YXRlIHNob3VsZCBiZSB0eXBlIG9iamVjdCcpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgZW1pdCwgJ2Z1bmN0aW9uJywgJ0Nob29Db21wb25lbnRDYWNoZTogZW1pdCBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG5cbiAgaWYgKHR5cGVvZiBscnUgPT09ICdudW1iZXInKSB0aGlzLmNhY2hlID0gbmV3IExSVShscnUpXG4gIGVsc2UgdGhpcy5jYWNoZSA9IGxydSB8fCBuZXcgTFJVKDEwMClcbiAgdGhpcy5zdGF0ZSA9IHN0YXRlXG4gIHRoaXMuZW1pdCA9IGVtaXRcbn1cblxuLy8gR2V0ICYgY3JlYXRlIGNvbXBvbmVudCBpbnN0YW5jZXMuXG5DaG9vQ29tcG9uZW50Q2FjaGUucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIChDb21wb25lbnQsIGlkKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgQ29tcG9uZW50LCAnZnVuY3Rpb24nLCAnQ2hvb0NvbXBvbmVudENhY2hlLnJlbmRlcjogQ29tcG9uZW50IHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcbiAgYXNzZXJ0Lm9rKHR5cGVvZiBpZCA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGlkID09PSAnbnVtYmVyJywgJ0Nob29Db21wb25lbnRDYWNoZS5yZW5kZXI6IGlkIHNob3VsZCBiZSB0eXBlIHN0cmluZyBvciB0eXBlIG51bWJlcicpXG5cbiAgdmFyIGVsID0gdGhpcy5jYWNoZS5nZXQoaWQpXG4gIGlmICghZWwpIHtcbiAgICB2YXIgYXJncyA9IFtdXG4gICAgZm9yICh2YXIgaSA9IDIsIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgYXJncy5wdXNoKGFyZ3VtZW50c1tpXSlcbiAgICB9XG4gICAgYXJncy51bnNoaWZ0KENvbXBvbmVudCwgaWQsIHRoaXMuc3RhdGUsIHRoaXMuZW1pdClcbiAgICBlbCA9IG5ld0NhbGwuYXBwbHkobmV3Q2FsbCwgYXJncylcbiAgICB0aGlzLmNhY2hlLnNldChpZCwgZWwpXG4gIH1cblxuICByZXR1cm4gZWxcbn1cblxuLy8gQmVjYXVzZSB5b3UgY2FuJ3QgY2FsbCBgbmV3YCBhbmQgYC5hcHBseSgpYCBhdCB0aGUgc2FtZSB0aW1lLiBUaGlzIGlzIGEgbWFkXG4vLyBoYWNrLCBidXQgaGV5IGl0IHdvcmtzIHNvIHdlIGdvbm5hIGdvIGZvciBpdC4gV2hvb3AuXG5mdW5jdGlvbiBuZXdDYWxsIChDbHMpIHtcbiAgcmV0dXJuIG5ldyAoQ2xzLmJpbmQuYXBwbHkoQ2xzLCBhcmd1bWVudHMpKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJ25hbm9odG1sJylcbiIsInZhciBzY3JvbGxUb0FuY2hvciA9IHJlcXVpcmUoJ3Njcm9sbC10by1hbmNob3InKVxudmFyIGRvY3VtZW50UmVhZHkgPSByZXF1aXJlKCdkb2N1bWVudC1yZWFkeScpXG52YXIgbmFub3RpbWluZyA9IHJlcXVpcmUoJ25hbm90aW1pbmcnKVxudmFyIG5hbm9yb3V0ZXIgPSByZXF1aXJlKCduYW5vcm91dGVyJylcbnZhciBuYW5vbW9ycGggPSByZXF1aXJlKCduYW5vbW9ycGgnKVxudmFyIG5hbm9xdWVyeSA9IHJlcXVpcmUoJ25hbm9xdWVyeScpXG52YXIgbmFub2hyZWYgPSByZXF1aXJlKCduYW5vaHJlZicpXG52YXIgbmFub3JhZiA9IHJlcXVpcmUoJ25hbm9yYWYnKVxudmFyIG5hbm9idXMgPSByZXF1aXJlKCduYW5vYnVzJylcbnZhciBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKVxuXG52YXIgQ2FjaGUgPSByZXF1aXJlKCcuL2NvbXBvbmVudC9jYWNoZScpXG5cbm1vZHVsZS5leHBvcnRzID0gQ2hvb1xuXG52YXIgSElTVE9SWV9PQkpFQ1QgPSB7fVxuXG5mdW5jdGlvbiBDaG9vIChvcHRzKSB7XG4gIHZhciB0aW1pbmcgPSBuYW5vdGltaW5nKCdjaG9vLmNvbnN0cnVjdG9yJylcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIENob28pKSByZXR1cm4gbmV3IENob28ob3B0cylcbiAgb3B0cyA9IG9wdHMgfHwge31cblxuICBhc3NlcnQuZXF1YWwodHlwZW9mIG9wdHMsICdvYmplY3QnLCAnY2hvbzogb3B0cyBzaG91bGQgYmUgdHlwZSBvYmplY3QnKVxuXG4gIHZhciBzZWxmID0gdGhpc1xuXG4gIC8vIGRlZmluZSBldmVudHMgdXNlZCBieSBjaG9vXG4gIHRoaXMuX2V2ZW50cyA9IHtcbiAgICBET01DT05URU5UTE9BREVEOiAnRE9NQ29udGVudExvYWRlZCcsXG4gICAgRE9NVElUTEVDSEFOR0U6ICdET01UaXRsZUNoYW5nZScsXG4gICAgUkVQTEFDRVNUQVRFOiAncmVwbGFjZVN0YXRlJyxcbiAgICBQVVNIU1RBVEU6ICdwdXNoU3RhdGUnLFxuICAgIE5BVklHQVRFOiAnbmF2aWdhdGUnLFxuICAgIFBPUFNUQVRFOiAncG9wU3RhdGUnLFxuICAgIFJFTkRFUjogJ3JlbmRlcidcbiAgfVxuXG4gIC8vIHByb3BlcnRpZXMgZm9yIGludGVybmFsIHVzZSBvbmx5XG4gIHRoaXMuX2hpc3RvcnlFbmFibGVkID0gb3B0cy5oaXN0b3J5ID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0cy5oaXN0b3J5XG4gIHRoaXMuX2hyZWZFbmFibGVkID0gb3B0cy5ocmVmID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0cy5ocmVmXG4gIHRoaXMuX2hhc2hFbmFibGVkID0gb3B0cy5oYXNoID09PSB1bmRlZmluZWQgPyBmYWxzZSA6IG9wdHMuaGFzaFxuICB0aGlzLl9oYXNXaW5kb3cgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICB0aGlzLl9jYWNoZSA9IG9wdHMuY2FjaGVcbiAgdGhpcy5fbG9hZGVkID0gZmFsc2VcbiAgdGhpcy5fc3RvcmVzID0gW29uZG9tdGl0bGVjaGFuZ2VdXG4gIHRoaXMuX3RyZWUgPSBudWxsXG5cbiAgLy8gc3RhdGVcbiAgdmFyIF9zdGF0ZSA9IHtcbiAgICBldmVudHM6IHRoaXMuX2V2ZW50cyxcbiAgICBjb21wb25lbnRzOiB7fVxuICB9XG4gIGlmICh0aGlzLl9oYXNXaW5kb3cpIHtcbiAgICB0aGlzLnN0YXRlID0gd2luZG93LmluaXRpYWxTdGF0ZVxuICAgICAgPyBPYmplY3QuYXNzaWduKHt9LCB3aW5kb3cuaW5pdGlhbFN0YXRlLCBfc3RhdGUpXG4gICAgICA6IF9zdGF0ZVxuICAgIGRlbGV0ZSB3aW5kb3cuaW5pdGlhbFN0YXRlXG4gIH0gZWxzZSB7XG4gICAgdGhpcy5zdGF0ZSA9IF9zdGF0ZVxuICB9XG5cbiAgLy8gcHJvcGVydGllcyB0aGF0IGFyZSBwYXJ0IG9mIHRoZSBBUElcbiAgdGhpcy5yb3V0ZXIgPSBuYW5vcm91dGVyKHsgY3Vycnk6IHRydWUgfSlcbiAgdGhpcy5lbWl0dGVyID0gbmFub2J1cygnY2hvby5lbWl0JylcbiAgdGhpcy5lbWl0ID0gdGhpcy5lbWl0dGVyLmVtaXQuYmluZCh0aGlzLmVtaXR0ZXIpXG5cbiAgLy8gbGlzdGVuIGZvciB0aXRsZSBjaGFuZ2VzOyBhdmFpbGFibGUgZXZlbiB3aGVuIGNhbGxpbmcgLnRvU3RyaW5nKClcbiAgaWYgKHRoaXMuX2hhc1dpbmRvdykgdGhpcy5zdGF0ZS50aXRsZSA9IGRvY3VtZW50LnRpdGxlXG4gIGZ1bmN0aW9uIG9uZG9tdGl0bGVjaGFuZ2UgKHN0YXRlKSB7XG4gICAgc2VsZi5lbWl0dGVyLnByZXBlbmRMaXN0ZW5lcihzZWxmLl9ldmVudHMuRE9NVElUTEVDSEFOR0UsIGZ1bmN0aW9uICh0aXRsZSkge1xuICAgICAgYXNzZXJ0LmVxdWFsKHR5cGVvZiB0aXRsZSwgJ3N0cmluZycsICdldmVudHMuRE9NVGl0bGVDaGFuZ2U6IHRpdGxlIHNob3VsZCBiZSB0eXBlIHN0cmluZycpXG4gICAgICBzdGF0ZS50aXRsZSA9IHRpdGxlXG4gICAgICBpZiAoc2VsZi5faGFzV2luZG93KSBkb2N1bWVudC50aXRsZSA9IHRpdGxlXG4gICAgfSlcbiAgfVxuICB0aW1pbmcoKVxufVxuXG5DaG9vLnByb3RvdHlwZS5yb3V0ZSA9IGZ1bmN0aW9uIChyb3V0ZSwgaGFuZGxlcikge1xuICB2YXIgcm91dGVUaW1pbmcgPSBuYW5vdGltaW5nKFwiY2hvby5yb3V0ZSgnXCIgKyByb3V0ZSArIFwiJylcIilcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb3V0ZSwgJ3N0cmluZycsICdjaG9vLnJvdXRlOiByb3V0ZSBzaG91bGQgYmUgdHlwZSBzdHJpbmcnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGhhbmRsZXIsICdmdW5jdGlvbicsICdjaG9vLmhhbmRsZXI6IHJvdXRlIHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcbiAgdGhpcy5yb3V0ZXIub24ocm91dGUsIGhhbmRsZXIpXG4gIHJvdXRlVGltaW5nKClcbn1cblxuQ2hvby5wcm90b3R5cGUudXNlID0gZnVuY3Rpb24gKGNiKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgY2IsICdmdW5jdGlvbicsICdjaG9vLnVzZTogY2Igc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuICB2YXIgc2VsZiA9IHRoaXNcbiAgdGhpcy5fc3RvcmVzLnB1c2goZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgdmFyIG1zZyA9ICdjaG9vLnVzZSdcbiAgICBtc2cgPSBjYi5zdG9yZU5hbWUgPyBtc2cgKyAnKCcgKyBjYi5zdG9yZU5hbWUgKyAnKScgOiBtc2dcbiAgICB2YXIgZW5kVGltaW5nID0gbmFub3RpbWluZyhtc2cpXG4gICAgY2Ioc3RhdGUsIHNlbGYuZW1pdHRlciwgc2VsZilcbiAgICBlbmRUaW1pbmcoKVxuICB9KVxufVxuXG5DaG9vLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uICgpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiB3aW5kb3csICdvYmplY3QnLCAnY2hvby5zdGFydDogd2luZG93IHdhcyBub3QgZm91bmQuIC5zdGFydCgpIG11c3QgYmUgY2FsbGVkIGluIGEgYnJvd3NlciwgdXNlIC50b1N0cmluZygpIGlmIHJ1bm5pbmcgaW4gTm9kZScpXG4gIHZhciBzdGFydFRpbWluZyA9IG5hbm90aW1pbmcoJ2Nob28uc3RhcnQnKVxuXG4gIHZhciBzZWxmID0gdGhpc1xuICBpZiAodGhpcy5faGlzdG9yeUVuYWJsZWQpIHtcbiAgICB0aGlzLmVtaXR0ZXIucHJlcGVuZExpc3RlbmVyKHRoaXMuX2V2ZW50cy5OQVZJR0FURSwgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fbWF0Y2hSb3V0ZShzZWxmLnN0YXRlKVxuICAgICAgaWYgKHNlbGYuX2xvYWRlZCkge1xuICAgICAgICBzZWxmLmVtaXR0ZXIuZW1pdChzZWxmLl9ldmVudHMuUkVOREVSKVxuICAgICAgICBzZXRUaW1lb3V0KHNjcm9sbFRvQW5jaG9yLmJpbmQobnVsbCwgd2luZG93LmxvY2F0aW9uLmhhc2gpLCAwKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICB0aGlzLmVtaXR0ZXIucHJlcGVuZExpc3RlbmVyKHRoaXMuX2V2ZW50cy5QT1BTVEFURSwgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5lbWl0dGVyLmVtaXQoc2VsZi5fZXZlbnRzLk5BVklHQVRFKVxuICAgIH0pXG5cbiAgICB0aGlzLmVtaXR0ZXIucHJlcGVuZExpc3RlbmVyKHRoaXMuX2V2ZW50cy5QVVNIU1RBVEUsIGZ1bmN0aW9uIChocmVmKSB7XG4gICAgICBhc3NlcnQuZXF1YWwodHlwZW9mIGhyZWYsICdzdHJpbmcnLCAnZXZlbnRzLnB1c2hTdGF0ZTogaHJlZiBzaG91bGQgYmUgdHlwZSBzdHJpbmcnKVxuICAgICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKEhJU1RPUllfT0JKRUNULCBudWxsLCBocmVmKVxuICAgICAgc2VsZi5lbWl0dGVyLmVtaXQoc2VsZi5fZXZlbnRzLk5BVklHQVRFKVxuICAgIH0pXG5cbiAgICB0aGlzLmVtaXR0ZXIucHJlcGVuZExpc3RlbmVyKHRoaXMuX2V2ZW50cy5SRVBMQUNFU1RBVEUsIGZ1bmN0aW9uIChocmVmKSB7XG4gICAgICBhc3NlcnQuZXF1YWwodHlwZW9mIGhyZWYsICdzdHJpbmcnLCAnZXZlbnRzLnJlcGxhY2VTdGF0ZTogaHJlZiBzaG91bGQgYmUgdHlwZSBzdHJpbmcnKVxuICAgICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKEhJU1RPUllfT0JKRUNULCBudWxsLCBocmVmKVxuICAgICAgc2VsZi5lbWl0dGVyLmVtaXQoc2VsZi5fZXZlbnRzLk5BVklHQVRFKVxuICAgIH0pXG5cbiAgICB3aW5kb3cub25wb3BzdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuZW1pdHRlci5lbWl0KHNlbGYuX2V2ZW50cy5QT1BTVEFURSlcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5faHJlZkVuYWJsZWQpIHtcbiAgICAgIG5hbm9ocmVmKGZ1bmN0aW9uIChsb2NhdGlvbikge1xuICAgICAgICB2YXIgaHJlZiA9IGxvY2F0aW9uLmhyZWZcbiAgICAgICAgdmFyIGhhc2ggPSBsb2NhdGlvbi5oYXNoXG4gICAgICAgIGlmIChocmVmID09PSB3aW5kb3cubG9jYXRpb24uaHJlZikge1xuICAgICAgICAgIGlmICghc2VsZi5faGFzaEVuYWJsZWQgJiYgaGFzaCkgc2Nyb2xsVG9BbmNob3IoaGFzaClcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBzZWxmLmVtaXR0ZXIuZW1pdChzZWxmLl9ldmVudHMuUFVTSFNUQVRFLCBocmVmKVxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICB0aGlzLl9zZXRDYWNoZSh0aGlzLnN0YXRlKVxuICB0aGlzLl9tYXRjaFJvdXRlKHRoaXMuc3RhdGUpXG4gIHRoaXMuX3N0b3Jlcy5mb3JFYWNoKGZ1bmN0aW9uIChpbml0U3RvcmUpIHtcbiAgICBpbml0U3RvcmUoc2VsZi5zdGF0ZSlcbiAgfSlcblxuICB0aGlzLl90cmVlID0gdGhpcy5fcHJlcmVuZGVyKHRoaXMuc3RhdGUpXG4gIGFzc2VydC5vayh0aGlzLl90cmVlLCAnY2hvby5zdGFydDogbm8gdmFsaWQgRE9NIG5vZGUgcmV0dXJuZWQgZm9yIGxvY2F0aW9uICcgKyB0aGlzLnN0YXRlLmhyZWYpXG5cbiAgdGhpcy5lbWl0dGVyLnByZXBlbmRMaXN0ZW5lcihzZWxmLl9ldmVudHMuUkVOREVSLCBuYW5vcmFmKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVuZGVyVGltaW5nID0gbmFub3RpbWluZygnY2hvby5yZW5kZXInKVxuICAgIHZhciBuZXdUcmVlID0gc2VsZi5fcHJlcmVuZGVyKHNlbGYuc3RhdGUpXG4gICAgYXNzZXJ0Lm9rKG5ld1RyZWUsICdjaG9vLnJlbmRlcjogbm8gdmFsaWQgRE9NIG5vZGUgcmV0dXJuZWQgZm9yIGxvY2F0aW9uICcgKyBzZWxmLnN0YXRlLmhyZWYpXG5cbiAgICBhc3NlcnQuZXF1YWwoc2VsZi5fdHJlZS5ub2RlTmFtZSwgbmV3VHJlZS5ub2RlTmFtZSwgJ2Nob28ucmVuZGVyOiBUaGUgdGFyZ2V0IG5vZGUgPCcgK1xuICAgICAgc2VsZi5fdHJlZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICsgJz4gaXMgbm90IHRoZSBzYW1lIHR5cGUgYXMgdGhlIG5ldyBub2RlIDwnICtcbiAgICAgIG5ld1RyZWUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSArICc+LicpXG5cbiAgICB2YXIgbW9ycGhUaW1pbmcgPSBuYW5vdGltaW5nKCdjaG9vLm1vcnBoJylcbiAgICBuYW5vbW9ycGgoc2VsZi5fdHJlZSwgbmV3VHJlZSlcbiAgICBtb3JwaFRpbWluZygpXG5cbiAgICByZW5kZXJUaW1pbmcoKVxuICB9KSlcblxuICBkb2N1bWVudFJlYWR5KGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLmVtaXR0ZXIuZW1pdChzZWxmLl9ldmVudHMuRE9NQ09OVEVOVExPQURFRClcbiAgICBzZWxmLl9sb2FkZWQgPSB0cnVlXG4gIH0pXG5cbiAgc3RhcnRUaW1pbmcoKVxuICByZXR1cm4gdGhpcy5fdHJlZVxufVxuXG5DaG9vLnByb3RvdHlwZS5tb3VudCA9IGZ1bmN0aW9uIG1vdW50IChzZWxlY3Rvcikge1xuICB2YXIgbW91bnRUaW1pbmcgPSBuYW5vdGltaW5nKFwiY2hvby5tb3VudCgnXCIgKyBzZWxlY3RvciArIFwiJylcIilcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICdvYmplY3QnKSB7XG4gICAgYXNzZXJ0Lm9rKHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycsICdjaG9vLm1vdW50OiBzZWxlY3RvciBzaG91bGQgYmUgdHlwZSBTdHJpbmcnKVxuICAgIHRoaXMuc2VsZWN0b3IgPSBzZWxlY3RvclxuICAgIG1vdW50VGltaW5nKClcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgYXNzZXJ0Lm9rKHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHNlbGVjdG9yID09PSAnb2JqZWN0JywgJ2Nob28ubW91bnQ6IHNlbGVjdG9yIHNob3VsZCBiZSB0eXBlIFN0cmluZyBvciBIVE1MRWxlbWVudCcpXG5cbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgZG9jdW1lbnRSZWFkeShmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlbmRlclRpbWluZyA9IG5hbm90aW1pbmcoJ2Nob28ucmVuZGVyJylcbiAgICB2YXIgbmV3VHJlZSA9IHNlbGYuc3RhcnQoKVxuICAgIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICBzZWxmLl90cmVlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcilcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fdHJlZSA9IHNlbGVjdG9yXG4gICAgfVxuXG4gICAgYXNzZXJ0Lm9rKHNlbGYuX3RyZWUsICdjaG9vLm1vdW50OiBjb3VsZCBub3QgcXVlcnkgc2VsZWN0b3I6ICcgKyBzZWxlY3RvcilcbiAgICBhc3NlcnQuZXF1YWwoc2VsZi5fdHJlZS5ub2RlTmFtZSwgbmV3VHJlZS5ub2RlTmFtZSwgJ2Nob28ubW91bnQ6IFRoZSB0YXJnZXQgbm9kZSA8JyArXG4gICAgICBzZWxmLl90cmVlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgKyAnPiBpcyBub3QgdGhlIHNhbWUgdHlwZSBhcyB0aGUgbmV3IG5vZGUgPCcgK1xuICAgICAgbmV3VHJlZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpICsgJz4uJylcblxuICAgIHZhciBtb3JwaFRpbWluZyA9IG5hbm90aW1pbmcoJ2Nob28ubW9ycGgnKVxuICAgIG5hbm9tb3JwaChzZWxmLl90cmVlLCBuZXdUcmVlKVxuICAgIG1vcnBoVGltaW5nKClcblxuICAgIHJlbmRlclRpbWluZygpXG4gIH0pXG4gIG1vdW50VGltaW5nKClcbn1cblxuQ2hvby5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiAobG9jYXRpb24sIHN0YXRlKSB7XG4gIHN0YXRlID0gc3RhdGUgfHwge31cbiAgc3RhdGUuY29tcG9uZW50cyA9IHN0YXRlLmNvbXBvbmVudHMgfHwge31cbiAgc3RhdGUuZXZlbnRzID0gT2JqZWN0LmFzc2lnbih7fSwgc3RhdGUuZXZlbnRzLCB0aGlzLl9ldmVudHMpXG5cbiAgYXNzZXJ0Lm5vdEVxdWFsKHR5cGVvZiB3aW5kb3csICdvYmplY3QnLCAnY2hvby5tb3VudDogd2luZG93IHdhcyBmb3VuZC4gLnRvU3RyaW5nKCkgbXVzdCBiZSBjYWxsZWQgaW4gTm9kZSwgdXNlIC5zdGFydCgpIG9yIC5tb3VudCgpIGlmIHJ1bm5pbmcgaW4gdGhlIGJyb3dzZXInKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGxvY2F0aW9uLCAnc3RyaW5nJywgJ2Nob28udG9TdHJpbmc6IGxvY2F0aW9uIHNob3VsZCBiZSB0eXBlIHN0cmluZycpXG4gIGFzc2VydC5lcXVhbCh0eXBlb2Ygc3RhdGUsICdvYmplY3QnLCAnY2hvby50b1N0cmluZzogc3RhdGUgc2hvdWxkIGJlIHR5cGUgb2JqZWN0JylcblxuICB0aGlzLl9zZXRDYWNoZShzdGF0ZSlcbiAgdGhpcy5fbWF0Y2hSb3V0ZShzdGF0ZSwgbG9jYXRpb24pXG4gIHRoaXMuZW1pdHRlci5yZW1vdmVBbGxMaXN0ZW5lcnMoKVxuICB0aGlzLl9zdG9yZXMuZm9yRWFjaChmdW5jdGlvbiAoaW5pdFN0b3JlKSB7XG4gICAgaW5pdFN0b3JlKHN0YXRlKVxuICB9KVxuXG4gIHZhciBodG1sID0gdGhpcy5fcHJlcmVuZGVyKHN0YXRlKVxuICBhc3NlcnQub2soaHRtbCwgJ2Nob28udG9TdHJpbmc6IG5vIHZhbGlkIHZhbHVlIHJldHVybmVkIGZvciB0aGUgcm91dGUgJyArIGxvY2F0aW9uKVxuICBhc3NlcnQoIUFycmF5LmlzQXJyYXkoaHRtbCksICdjaG9vLnRvU3RyaW5nOiByZXR1cm4gdmFsdWUgd2FzIGFuIGFycmF5IGZvciB0aGUgcm91dGUgJyArIGxvY2F0aW9uKVxuICByZXR1cm4gdHlwZW9mIGh0bWwub3V0ZXJIVE1MID09PSAnc3RyaW5nJyA/IGh0bWwub3V0ZXJIVE1MIDogaHRtbC50b1N0cmluZygpXG59XG5cbkNob28ucHJvdG90eXBlLl9tYXRjaFJvdXRlID0gZnVuY3Rpb24gKHN0YXRlLCBsb2NhdGlvbk92ZXJyaWRlKSB7XG4gIHZhciBsb2NhdGlvbiwgcXVlcnlTdHJpbmdcbiAgaWYgKGxvY2F0aW9uT3ZlcnJpZGUpIHtcbiAgICBsb2NhdGlvbiA9IGxvY2F0aW9uT3ZlcnJpZGUucmVwbGFjZSgvXFw/LiskLywgJycpLnJlcGxhY2UoL1xcLyQvLCAnJylcbiAgICBpZiAoIXRoaXMuX2hhc2hFbmFibGVkKSBsb2NhdGlvbiA9IGxvY2F0aW9uLnJlcGxhY2UoLyMuKyQvLCAnJylcbiAgICBxdWVyeVN0cmluZyA9IGxvY2F0aW9uT3ZlcnJpZGVcbiAgfSBlbHNlIHtcbiAgICBsb2NhdGlvbiA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9cXC8kLywgJycpXG4gICAgaWYgKHRoaXMuX2hhc2hFbmFibGVkKSBsb2NhdGlvbiArPSB3aW5kb3cubG9jYXRpb24uaGFzaC5yZXBsYWNlKC9eIy8sICcvJylcbiAgICBxdWVyeVN0cmluZyA9IHdpbmRvdy5sb2NhdGlvbi5zZWFyY2hcbiAgfVxuICB2YXIgbWF0Y2hlZCA9IHRoaXMucm91dGVyLm1hdGNoKGxvY2F0aW9uKVxuICB0aGlzLl9oYW5kbGVyID0gbWF0Y2hlZC5jYlxuICBzdGF0ZS5ocmVmID0gbG9jYXRpb25cbiAgc3RhdGUucXVlcnkgPSBuYW5vcXVlcnkocXVlcnlTdHJpbmcpXG4gIHN0YXRlLnJvdXRlID0gbWF0Y2hlZC5yb3V0ZVxuICBzdGF0ZS5wYXJhbXMgPSBtYXRjaGVkLnBhcmFtc1xufVxuXG5DaG9vLnByb3RvdHlwZS5fcHJlcmVuZGVyID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHZhciByb3V0ZVRpbWluZyA9IG5hbm90aW1pbmcoXCJjaG9vLnByZXJlbmRlcignXCIgKyBzdGF0ZS5yb3V0ZSArIFwiJylcIilcbiAgdmFyIHJlcyA9IHRoaXMuX2hhbmRsZXIoc3RhdGUsIHRoaXMuZW1pdClcbiAgcm91dGVUaW1pbmcoKVxuICByZXR1cm4gcmVzXG59XG5cbkNob28ucHJvdG90eXBlLl9zZXRDYWNoZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICB2YXIgY2FjaGUgPSBuZXcgQ2FjaGUoc3RhdGUsIHRoaXMuZW1pdHRlci5lbWl0LmJpbmQodGhpcy5lbWl0dGVyKSwgdGhpcy5fY2FjaGUpXG4gIHN0YXRlLmNhY2hlID0gcmVuZGVyQ29tcG9uZW50XG5cbiAgZnVuY3Rpb24gcmVuZGVyQ29tcG9uZW50IChDb21wb25lbnQsIGlkKSB7XG4gICAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBDb21wb25lbnQsICdmdW5jdGlvbicsICdjaG9vLnN0YXRlLmNhY2hlOiBDb21wb25lbnQgc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuICAgIHZhciBhcmdzID0gW11cbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBhcmdzLnB1c2goYXJndW1lbnRzW2ldKVxuICAgIH1cbiAgICByZXR1cm4gY2FjaGUucmVuZGVyLmFwcGx5KGNhY2hlLCBhcmdzKVxuICB9XG5cbiAgLy8gV2hlbiB0aGUgc3RhdGUgZ2V0cyBzdHJpbmdpZmllZCwgbWFrZSBzdXJlIGBzdGF0ZS5jYWNoZWAgaXNuJ3RcbiAgLy8gc3RyaW5naWZpZWQgdG9vLlxuICByZW5kZXJDb21wb25lbnQudG9KU09OID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlYWR5XG5cbmZ1bmN0aW9uIHJlYWR5IChjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykge1xuICAgIHRocm93IG5ldyBFcnJvcignZG9jdW1lbnQtcmVhZHkgb25seSBydW5zIGluIHRoZSBicm93c2VyJylcbiAgfVxuICB2YXIgc3RhdGUgPSBkb2N1bWVudC5yZWFkeVN0YXRlXG4gIGlmIChzdGF0ZSA9PT0gJ2NvbXBsZXRlJyB8fCBzdGF0ZSA9PT0gJ2ludGVyYWN0aXZlJykge1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKVxuICB9XG5cbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uIG9uTG9hZCAoKSB7XG4gICAgY2FsbGJhY2soKVxuICB9KVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBhdHRyaWJ1dGVUb1Byb3BlcnR5XG5cbnZhciB0cmFuc2Zvcm0gPSB7XG4gICdjbGFzcyc6ICdjbGFzc05hbWUnLFxuICAnZm9yJzogJ2h0bWxGb3InLFxuICAnaHR0cC1lcXVpdic6ICdodHRwRXF1aXYnXG59XG5cbmZ1bmN0aW9uIGF0dHJpYnV0ZVRvUHJvcGVydHkgKGgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh0YWdOYW1lLCBhdHRycywgY2hpbGRyZW4pIHtcbiAgICBmb3IgKHZhciBhdHRyIGluIGF0dHJzKSB7XG4gICAgICBpZiAoYXR0ciBpbiB0cmFuc2Zvcm0pIHtcbiAgICAgICAgYXR0cnNbdHJhbnNmb3JtW2F0dHJdXSA9IGF0dHJzW2F0dHJdXG4gICAgICAgIGRlbGV0ZSBhdHRyc1thdHRyXVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaCh0YWdOYW1lLCBhdHRycywgY2hpbGRyZW4pXG4gIH1cbn1cbiIsInZhciBhdHRyVG9Qcm9wID0gcmVxdWlyZSgnaHlwZXJzY3JpcHQtYXR0cmlidXRlLXRvLXByb3BlcnR5JylcblxudmFyIFZBUiA9IDAsIFRFWFQgPSAxLCBPUEVOID0gMiwgQ0xPU0UgPSAzLCBBVFRSID0gNFxudmFyIEFUVFJfS0VZID0gNSwgQVRUUl9LRVlfVyA9IDZcbnZhciBBVFRSX1ZBTFVFX1cgPSA3LCBBVFRSX1ZBTFVFID0gOFxudmFyIEFUVFJfVkFMVUVfU1EgPSA5LCBBVFRSX1ZBTFVFX0RRID0gMTBcbnZhciBBVFRSX0VRID0gMTEsIEFUVFJfQlJFQUsgPSAxMlxudmFyIENPTU1FTlQgPSAxM1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChoLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9XG4gIHZhciBjb25jYXQgPSBvcHRzLmNvbmNhdCB8fCBmdW5jdGlvbiAoYSwgYikge1xuICAgIHJldHVybiBTdHJpbmcoYSkgKyBTdHJpbmcoYilcbiAgfVxuICBpZiAob3B0cy5hdHRyVG9Qcm9wICE9PSBmYWxzZSkge1xuICAgIGggPSBhdHRyVG9Qcm9wKGgpXG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24gKHN0cmluZ3MpIHtcbiAgICB2YXIgc3RhdGUgPSBURVhULCByZWcgPSAnJ1xuICAgIHZhciBhcmdsZW4gPSBhcmd1bWVudHMubGVuZ3RoXG4gICAgdmFyIHBhcnRzID0gW11cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyaW5ncy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGkgPCBhcmdsZW4gLSAxKSB7XG4gICAgICAgIHZhciBhcmcgPSBhcmd1bWVudHNbaSsxXVxuICAgICAgICB2YXIgcCA9IHBhcnNlKHN0cmluZ3NbaV0pXG4gICAgICAgIHZhciB4c3RhdGUgPSBzdGF0ZVxuICAgICAgICBpZiAoeHN0YXRlID09PSBBVFRSX1ZBTFVFX0RRKSB4c3RhdGUgPSBBVFRSX1ZBTFVFXG4gICAgICAgIGlmICh4c3RhdGUgPT09IEFUVFJfVkFMVUVfU1EpIHhzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgaWYgKHhzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XKSB4c3RhdGUgPSBBVFRSX1ZBTFVFXG4gICAgICAgIGlmICh4c3RhdGUgPT09IEFUVFIpIHhzdGF0ZSA9IEFUVFJfS0VZXG4gICAgICAgIGlmICh4c3RhdGUgPT09IE9QRU4pIHtcbiAgICAgICAgICBpZiAocmVnID09PSAnLycpIHtcbiAgICAgICAgICAgIHAucHVzaChbIE9QRU4sICcvJywgYXJnIF0pXG4gICAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwLnB1c2goWyBPUEVOLCBhcmcgXSlcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoeHN0YXRlID09PSBDT01NRU5UICYmIG9wdHMuY29tbWVudHMpIHtcbiAgICAgICAgICByZWcgKz0gU3RyaW5nKGFyZylcbiAgICAgICAgfSBlbHNlIGlmICh4c3RhdGUgIT09IENPTU1FTlQpIHtcbiAgICAgICAgICBwLnB1c2goWyBWQVIsIHhzdGF0ZSwgYXJnIF0pXG4gICAgICAgIH1cbiAgICAgICAgcGFydHMucHVzaC5hcHBseShwYXJ0cywgcClcbiAgICAgIH0gZWxzZSBwYXJ0cy5wdXNoLmFwcGx5KHBhcnRzLCBwYXJzZShzdHJpbmdzW2ldKSlcbiAgICB9XG5cbiAgICB2YXIgdHJlZSA9IFtudWxsLHt9LFtdXVxuICAgIHZhciBzdGFjayA9IFtbdHJlZSwtMV1dXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGN1ciA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVswXVxuICAgICAgdmFyIHAgPSBwYXJ0c1tpXSwgcyA9IHBbMF1cbiAgICAgIGlmIChzID09PSBPUEVOICYmIC9eXFwvLy50ZXN0KHBbMV0pKSB7XG4gICAgICAgIHZhciBpeCA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXVsxXVxuICAgICAgICBpZiAoc3RhY2subGVuZ3RoID4gMSkge1xuICAgICAgICAgIHN0YWNrLnBvcCgpXG4gICAgICAgICAgc3RhY2tbc3RhY2subGVuZ3RoLTFdWzBdWzJdW2l4XSA9IGgoXG4gICAgICAgICAgICBjdXJbMF0sIGN1clsxXSwgY3VyWzJdLmxlbmd0aCA/IGN1clsyXSA6IHVuZGVmaW5lZFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzID09PSBPUEVOKSB7XG4gICAgICAgIHZhciBjID0gW3BbMV0se30sW11dXG4gICAgICAgIGN1clsyXS5wdXNoKGMpXG4gICAgICAgIHN0YWNrLnB1c2goW2MsY3VyWzJdLmxlbmd0aC0xXSlcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQVRUUl9LRVkgfHwgKHMgPT09IFZBUiAmJiBwWzFdID09PSBBVFRSX0tFWSkpIHtcbiAgICAgICAgdmFyIGtleSA9ICcnXG4gICAgICAgIHZhciBjb3B5S2V5XG4gICAgICAgIGZvciAoOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAocGFydHNbaV1bMF0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICBrZXkgPSBjb25jYXQoa2V5LCBwYXJ0c1tpXVsxXSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHBhcnRzW2ldWzBdID09PSBWQVIgJiYgcGFydHNbaV1bMV0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHBhcnRzW2ldWzJdID09PSAnb2JqZWN0JyAmJiAha2V5KSB7XG4gICAgICAgICAgICAgIGZvciAoY29weUtleSBpbiBwYXJ0c1tpXVsyXSkge1xuICAgICAgICAgICAgICAgIGlmIChwYXJ0c1tpXVsyXS5oYXNPd25Qcm9wZXJ0eShjb3B5S2V5KSAmJiAhY3VyWzFdW2NvcHlLZXldKSB7XG4gICAgICAgICAgICAgICAgICBjdXJbMV1bY29weUtleV0gPSBwYXJ0c1tpXVsyXVtjb3B5S2V5XVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAga2V5ID0gY29uY2F0KGtleSwgcGFydHNbaV1bMl0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcnRzW2ldWzBdID09PSBBVFRSX0VRKSBpKytcbiAgICAgICAgdmFyIGogPSBpXG4gICAgICAgIGZvciAoOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAocGFydHNbaV1bMF0gPT09IEFUVFJfVkFMVUUgfHwgcGFydHNbaV1bMF0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICBpZiAoIWN1clsxXVtrZXldKSBjdXJbMV1ba2V5XSA9IHN0cmZuKHBhcnRzW2ldWzFdKVxuICAgICAgICAgICAgZWxzZSBwYXJ0c1tpXVsxXT09PVwiXCIgfHwgKGN1clsxXVtrZXldID0gY29uY2F0KGN1clsxXVtrZXldLCBwYXJ0c1tpXVsxXSkpO1xuICAgICAgICAgIH0gZWxzZSBpZiAocGFydHNbaV1bMF0gPT09IFZBUlxuICAgICAgICAgICYmIChwYXJ0c1tpXVsxXSA9PT0gQVRUUl9WQUxVRSB8fCBwYXJ0c1tpXVsxXSA9PT0gQVRUUl9LRVkpKSB7XG4gICAgICAgICAgICBpZiAoIWN1clsxXVtrZXldKSBjdXJbMV1ba2V5XSA9IHN0cmZuKHBhcnRzW2ldWzJdKVxuICAgICAgICAgICAgZWxzZSBwYXJ0c1tpXVsyXT09PVwiXCIgfHwgKGN1clsxXVtrZXldID0gY29uY2F0KGN1clsxXVtrZXldLCBwYXJ0c1tpXVsyXSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoa2V5Lmxlbmd0aCAmJiAhY3VyWzFdW2tleV0gJiYgaSA9PT0galxuICAgICAgICAgICAgJiYgKHBhcnRzW2ldWzBdID09PSBDTE9TRSB8fCBwYXJ0c1tpXVswXSA9PT0gQVRUUl9CUkVBSykpIHtcbiAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9odG1sLnNwZWMud2hhdHdnLm9yZy9tdWx0aXBhZ2UvaW5mcmFzdHJ1Y3R1cmUuaHRtbCNib29sZWFuLWF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgLy8gZW1wdHkgc3RyaW5nIGlzIGZhbHN5LCBub3Qgd2VsbCBiZWhhdmVkIHZhbHVlIGluIGJyb3dzZXJcbiAgICAgICAgICAgICAgY3VyWzFdW2tleV0gPSBrZXkudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBhcnRzW2ldWzBdID09PSBDTE9TRSkge1xuICAgICAgICAgICAgICBpLS1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgIGN1clsxXVtwWzFdXSA9IHRydWVcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gVkFSICYmIHBbMV0gPT09IEFUVFJfS0VZKSB7XG4gICAgICAgIGN1clsxXVtwWzJdXSA9IHRydWVcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQ0xPU0UpIHtcbiAgICAgICAgaWYgKHNlbGZDbG9zaW5nKGN1clswXSkgJiYgc3RhY2subGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIGl4ID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdWzFdXG4gICAgICAgICAgc3RhY2sucG9wKClcbiAgICAgICAgICBzdGFja1tzdGFjay5sZW5ndGgtMV1bMF1bMl1baXhdID0gaChcbiAgICAgICAgICAgIGN1clswXSwgY3VyWzFdLCBjdXJbMl0ubGVuZ3RoID8gY3VyWzJdIDogdW5kZWZpbmVkXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IFZBUiAmJiBwWzFdID09PSBURVhUKSB7XG4gICAgICAgIGlmIChwWzJdID09PSB1bmRlZmluZWQgfHwgcFsyXSA9PT0gbnVsbCkgcFsyXSA9ICcnXG4gICAgICAgIGVsc2UgaWYgKCFwWzJdKSBwWzJdID0gY29uY2F0KCcnLCBwWzJdKVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwWzJdWzBdKSkge1xuICAgICAgICAgIGN1clsyXS5wdXNoLmFwcGx5KGN1clsyXSwgcFsyXSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJbMl0ucHVzaChwWzJdKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHMgPT09IFRFWFQpIHtcbiAgICAgICAgY3VyWzJdLnB1c2gocFsxXSlcbiAgICAgIH0gZWxzZSBpZiAocyA9PT0gQVRUUl9FUSB8fCBzID09PSBBVFRSX0JSRUFLKSB7XG4gICAgICAgIC8vIG5vLW9wXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaGFuZGxlZDogJyArIHMpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRyZWVbMl0ubGVuZ3RoID4gMSAmJiAvXlxccyokLy50ZXN0KHRyZWVbMl1bMF0pKSB7XG4gICAgICB0cmVlWzJdLnNoaWZ0KClcbiAgICB9XG5cbiAgICBpZiAodHJlZVsyXS5sZW5ndGggPiAyXG4gICAgfHwgKHRyZWVbMl0ubGVuZ3RoID09PSAyICYmIC9cXFMvLnRlc3QodHJlZVsyXVsxXSkpKSB7XG4gICAgICBpZiAob3B0cy5jcmVhdGVGcmFnbWVudCkgcmV0dXJuIG9wdHMuY3JlYXRlRnJhZ21lbnQodHJlZVsyXSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ211bHRpcGxlIHJvb3QgZWxlbWVudHMgbXVzdCBiZSB3cmFwcGVkIGluIGFuIGVuY2xvc2luZyB0YWcnXG4gICAgICApXG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHRyZWVbMl1bMF0pICYmIHR5cGVvZiB0cmVlWzJdWzBdWzBdID09PSAnc3RyaW5nJ1xuICAgICYmIEFycmF5LmlzQXJyYXkodHJlZVsyXVswXVsyXSkpIHtcbiAgICAgIHRyZWVbMl1bMF0gPSBoKHRyZWVbMl1bMF1bMF0sIHRyZWVbMl1bMF1bMV0sIHRyZWVbMl1bMF1bMl0pXG4gICAgfVxuICAgIHJldHVybiB0cmVlWzJdWzBdXG5cbiAgICBmdW5jdGlvbiBwYXJzZSAoc3RyKSB7XG4gICAgICB2YXIgcmVzID0gW11cbiAgICAgIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XKSBzdGF0ZSA9IEFUVFJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjID0gc3RyLmNoYXJBdChpKVxuICAgICAgICBpZiAoc3RhdGUgPT09IFRFWFQgJiYgYyA9PT0gJzwnKSB7XG4gICAgICAgICAgaWYgKHJlZy5sZW5ndGgpIHJlcy5wdXNoKFtURVhULCByZWddKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBPUEVOXG4gICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gJz4nICYmICFxdW90KHN0YXRlKSAmJiBzdGF0ZSAhPT0gQ09NTUVOVCkge1xuICAgICAgICAgIGlmIChzdGF0ZSA9PT0gT1BFTiAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXMucHVzaChbT1BFTixyZWddKVxuICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZKSB7XG4gICAgICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcy5wdXNoKFtDTE9TRV0pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IFRFWFRcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQ09NTUVOVCAmJiAvLSQvLnRlc3QocmVnKSAmJiBjID09PSAnLScpIHtcbiAgICAgICAgICBpZiAob3B0cy5jb21tZW50cykge1xuICAgICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnLnN1YnN0cigwLCByZWcubGVuZ3RoIC0gMSldKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gVEVYVFxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBPUEVOICYmIC9eIS0tJC8udGVzdChyZWcpKSB7XG4gICAgICAgICAgaWYgKG9wdHMuY29tbWVudHMpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKFtPUEVOLCByZWddLFtBVFRSX0tFWSwnY29tbWVudCddLFtBVFRSX0VRXSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVnID0gY1xuICAgICAgICAgIHN0YXRlID0gQ09NTUVOVFxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBURVhUIHx8IHN0YXRlID09PSBDT01NRU5UKSB7XG4gICAgICAgICAgcmVnICs9IGNcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gT1BFTiAmJiBjID09PSAnLycgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICAgIC8vIG5vLW9wLCBzZWxmIGNsb3NpbmcgdGFnIHdpdGhvdXQgYSBzcGFjZSA8YnIvPlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBPUEVOICYmIC9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICBpZiAocmVnLmxlbmd0aCkge1xuICAgICAgICAgICAgcmVzLnB1c2goW09QRU4sIHJlZ10pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IE9QRU4pIHtcbiAgICAgICAgICByZWcgKz0gY1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSICYmIC9bXlxcc1wiJz0vXS8udGVzdChjKSkge1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9LRVlcbiAgICAgICAgICByZWcgPSBjXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFIgJiYgL1xccy8udGVzdChjKSkge1xuICAgICAgICAgIGlmIChyZWcubGVuZ3RoKSByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9CUkVBS10pXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfS0VZICYmIC9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUl9LRVlfV1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSAmJiBjID09PSAnPScpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSxbQVRUUl9FUV0pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfV1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSkge1xuICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgIH0gZWxzZSBpZiAoKHN0YXRlID09PSBBVFRSX0tFWV9XIHx8IHN0YXRlID09PSBBVFRSKSAmJiBjID09PSAnPScpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9FUV0pXG4gICAgICAgICAgc3RhdGUgPSBBVFRSX1ZBTFVFX1dcbiAgICAgICAgfSBlbHNlIGlmICgoc3RhdGUgPT09IEFUVFJfS0VZX1cgfHwgc3RhdGUgPT09IEFUVFIpICYmICEvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfQlJFQUtdKVxuICAgICAgICAgIGlmICgvW1xcdy1dLy50ZXN0KGMpKSB7XG4gICAgICAgICAgICByZWcgKz0gY1xuICAgICAgICAgICAgc3RhdGUgPSBBVFRSX0tFWVxuICAgICAgICAgIH0gZWxzZSBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XICYmIGMgPT09ICdcIicpIHtcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVfRFFcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9XICYmIGMgPT09IFwiJ1wiKSB7XG4gICAgICAgICAgc3RhdGUgPSBBVFRSX1ZBTFVFX1NRXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfRFEgJiYgYyA9PT0gJ1wiJykge1xuICAgICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10sW0FUVFJfQlJFQUtdKVxuICAgICAgICAgIHJlZyA9ICcnXG4gICAgICAgICAgc3RhdGUgPSBBVFRSXG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfU1EgJiYgYyA9PT0gXCInXCIpIHtcbiAgICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddLFtBVFRSX0JSRUFLXSlcbiAgICAgICAgICByZWcgPSAnJ1xuICAgICAgICAgIHN0YXRlID0gQVRUUlxuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFX1cgJiYgIS9cXHMvLnRlc3QoYykpIHtcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJfVkFMVUVcbiAgICAgICAgICBpLS1cbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRSAmJiAvXFxzLy50ZXN0KGMpKSB7XG4gICAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSxbQVRUUl9CUkVBS10pXG4gICAgICAgICAgcmVnID0gJydcbiAgICAgICAgICBzdGF0ZSA9IEFUVFJcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRSB8fCBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUVxuICAgICAgICB8fCBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUSkge1xuICAgICAgICAgIHJlZyArPSBjXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzdGF0ZSA9PT0gVEVYVCAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgIHJlcy5wdXNoKFtURVhULHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX1ZBTFVFICYmIHJlZy5sZW5ndGgpIHtcbiAgICAgICAgcmVzLnB1c2goW0FUVFJfVkFMVUUscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT09IEFUVFJfVkFMVUVfRFEgJiYgcmVnLmxlbmd0aCkge1xuICAgICAgICByZXMucHVzaChbQVRUUl9WQUxVRSxyZWddKVxuICAgICAgICByZWcgPSAnJ1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSAmJiByZWcubGVuZ3RoKSB7XG4gICAgICAgIHJlcy5wdXNoKFtBVFRSX1ZBTFVFLHJlZ10pXG4gICAgICAgIHJlZyA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBBVFRSX0tFWSkge1xuICAgICAgICByZXMucHVzaChbQVRUUl9LRVkscmVnXSlcbiAgICAgICAgcmVnID0gJydcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXNcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzdHJmbiAoeCkge1xuICAgIGlmICh0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHhcbiAgICBlbHNlIGlmICh0eXBlb2YgeCA9PT0gJ3N0cmluZycpIHJldHVybiB4XG4gICAgZWxzZSBpZiAoeCAmJiB0eXBlb2YgeCA9PT0gJ29iamVjdCcpIHJldHVybiB4XG4gICAgZWxzZSBpZiAoeCA9PT0gbnVsbCB8fCB4ID09PSB1bmRlZmluZWQpIHJldHVybiB4XG4gICAgZWxzZSByZXR1cm4gY29uY2F0KCcnLCB4KVxuICB9XG59XG5cbmZ1bmN0aW9uIHF1b3QgKHN0YXRlKSB7XG4gIHJldHVybiBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9TUSB8fCBzdGF0ZSA9PT0gQVRUUl9WQUxVRV9EUVxufVxuXG52YXIgY2xvc2VSRSA9IFJlZ0V4cCgnXignICsgW1xuICAnYXJlYScsICdiYXNlJywgJ2Jhc2Vmb250JywgJ2Jnc291bmQnLCAnYnInLCAnY29sJywgJ2NvbW1hbmQnLCAnZW1iZWQnLFxuICAnZnJhbWUnLCAnaHInLCAnaW1nJywgJ2lucHV0JywgJ2lzaW5kZXgnLCAna2V5Z2VuJywgJ2xpbmsnLCAnbWV0YScsICdwYXJhbScsXG4gICdzb3VyY2UnLCAndHJhY2snLCAnd2JyJywgJyEtLScsXG4gIC8vIFNWRyBUQUdTXG4gICdhbmltYXRlJywgJ2FuaW1hdGVUcmFuc2Zvcm0nLCAnY2lyY2xlJywgJ2N1cnNvcicsICdkZXNjJywgJ2VsbGlwc2UnLFxuICAnZmVCbGVuZCcsICdmZUNvbG9yTWF0cml4JywgJ2ZlQ29tcG9zaXRlJyxcbiAgJ2ZlQ29udm9sdmVNYXRyaXgnLCAnZmVEaWZmdXNlTGlnaHRpbmcnLCAnZmVEaXNwbGFjZW1lbnRNYXAnLFxuICAnZmVEaXN0YW50TGlnaHQnLCAnZmVGbG9vZCcsICdmZUZ1bmNBJywgJ2ZlRnVuY0InLCAnZmVGdW5jRycsICdmZUZ1bmNSJyxcbiAgJ2ZlR2F1c3NpYW5CbHVyJywgJ2ZlSW1hZ2UnLCAnZmVNZXJnZU5vZGUnLCAnZmVNb3JwaG9sb2d5JyxcbiAgJ2ZlT2Zmc2V0JywgJ2ZlUG9pbnRMaWdodCcsICdmZVNwZWN1bGFyTGlnaHRpbmcnLCAnZmVTcG90TGlnaHQnLCAnZmVUaWxlJyxcbiAgJ2ZlVHVyYnVsZW5jZScsICdmb250LWZhY2UtZm9ybWF0JywgJ2ZvbnQtZmFjZS1uYW1lJywgJ2ZvbnQtZmFjZS11cmknLFxuICAnZ2x5cGgnLCAnZ2x5cGhSZWYnLCAnaGtlcm4nLCAnaW1hZ2UnLCAnbGluZScsICdtaXNzaW5nLWdseXBoJywgJ21wYXRoJyxcbiAgJ3BhdGgnLCAncG9seWdvbicsICdwb2x5bGluZScsICdyZWN0JywgJ3NldCcsICdzdG9wJywgJ3RyZWYnLCAndXNlJywgJ3ZpZXcnLFxuICAndmtlcm4nXG5dLmpvaW4oJ3wnKSArICcpKD86W1xcLiNdW2EtekEtWjAtOVxcdTAwN0YtXFx1RkZGRl86LV0rKSokJylcbmZ1bmN0aW9uIHNlbGZDbG9zaW5nICh0YWcpIHsgcmV0dXJuIGNsb3NlUkUudGVzdCh0YWcpIH1cbiIsImFzc2VydC5ub3RFcXVhbCA9IG5vdEVxdWFsXG5hc3NlcnQubm90T2sgPSBub3RPa1xuYXNzZXJ0LmVxdWFsID0gZXF1YWxcbmFzc2VydC5vayA9IGFzc2VydFxuXG5tb2R1bGUuZXhwb3J0cyA9IGFzc2VydFxuXG5mdW5jdGlvbiBlcXVhbCAoYSwgYiwgbSkge1xuICBhc3NlcnQoYSA9PSBiLCBtKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGVxZXFlcVxufVxuXG5mdW5jdGlvbiBub3RFcXVhbCAoYSwgYiwgbSkge1xuICBhc3NlcnQoYSAhPSBiLCBtKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGVxZXFlcVxufVxuXG5mdW5jdGlvbiBub3RPayAodCwgbSkge1xuICBhc3NlcnQoIXQsIG0pXG59XG5cbmZ1bmN0aW9uIGFzc2VydCAodCwgbSkge1xuICBpZiAoIXQpIHRocm93IG5ldyBFcnJvcihtIHx8ICdBc3NlcnRpb25FcnJvcicpXG59XG4iLCJ2YXIgc3BsaWNlID0gcmVxdWlyZSgncmVtb3ZlLWFycmF5LWl0ZW1zJylcbnZhciBuYW5vdGltaW5nID0gcmVxdWlyZSgnbmFub3RpbWluZycpXG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcblxubW9kdWxlLmV4cG9ydHMgPSBOYW5vYnVzXG5cbmZ1bmN0aW9uIE5hbm9idXMgKG5hbWUpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE5hbm9idXMpKSByZXR1cm4gbmV3IE5hbm9idXMobmFtZSlcblxuICB0aGlzLl9uYW1lID0gbmFtZSB8fCAnbmFub2J1cydcbiAgdGhpcy5fc3Rhckxpc3RlbmVycyA9IFtdXG4gIHRoaXMuX2xpc3RlbmVycyA9IHt9XG59XG5cbk5hbm9idXMucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiAoZXZlbnROYW1lKSB7XG4gIGFzc2VydC5vayh0eXBlb2YgZXZlbnROYW1lID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZXZlbnROYW1lID09PSAnc3ltYm9sJywgJ25hbm9idXMuZW1pdDogZXZlbnROYW1lIHNob3VsZCBiZSB0eXBlIHN0cmluZyBvciBzeW1ib2wnKVxuXG4gIHZhciBkYXRhID0gW11cbiAgZm9yICh2YXIgaSA9IDEsIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGRhdGEucHVzaChhcmd1bWVudHNbaV0pXG4gIH1cblxuICB2YXIgZW1pdFRpbWluZyA9IG5hbm90aW1pbmcodGhpcy5fbmFtZSArIFwiKCdcIiArIGV2ZW50TmFtZS50b1N0cmluZygpICsgXCInKVwiKVxuICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV1cbiAgaWYgKGxpc3RlbmVycyAmJiBsaXN0ZW5lcnMubGVuZ3RoID4gMCkge1xuICAgIHRoaXMuX2VtaXQodGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0sIGRhdGEpXG4gIH1cblxuICBpZiAodGhpcy5fc3Rhckxpc3RlbmVycy5sZW5ndGggPiAwKSB7XG4gICAgdGhpcy5fZW1pdCh0aGlzLl9zdGFyTGlzdGVuZXJzLCBldmVudE5hbWUsIGRhdGEsIGVtaXRUaW1pbmcudXVpZClcbiAgfVxuICBlbWl0VGltaW5nKClcblxuICByZXR1cm4gdGhpc1xufVxuXG5OYW5vYnVzLnByb3RvdHlwZS5vbiA9IE5hbm9idXMucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgYXNzZXJ0Lm9rKHR5cGVvZiBldmVudE5hbWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBldmVudE5hbWUgPT09ICdzeW1ib2wnLCAnbmFub2J1cy5vbjogZXZlbnROYW1lIHNob3VsZCBiZSB0eXBlIHN0cmluZyBvciBzeW1ib2wnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGxpc3RlbmVyLCAnZnVuY3Rpb24nLCAnbmFub2J1cy5vbjogbGlzdGVuZXIgc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuXG4gIGlmIChldmVudE5hbWUgPT09ICcqJykge1xuICAgIHRoaXMuX3N0YXJMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcilcbiAgfSBlbHNlIHtcbiAgICBpZiAoIXRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdKSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdXG4gICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0ucHVzaChsaXN0ZW5lcilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5OYW5vYnVzLnByb3RvdHlwZS5wcmVwZW5kTGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICBhc3NlcnQub2sodHlwZW9mIGV2ZW50TmFtZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGV2ZW50TmFtZSA9PT0gJ3N5bWJvbCcsICduYW5vYnVzLnByZXBlbmRMaXN0ZW5lcjogZXZlbnROYW1lIHNob3VsZCBiZSB0eXBlIHN0cmluZyBvciBzeW1ib2wnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGxpc3RlbmVyLCAnZnVuY3Rpb24nLCAnbmFub2J1cy5wcmVwZW5kTGlzdGVuZXI6IGxpc3RlbmVyIHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcblxuICBpZiAoZXZlbnROYW1lID09PSAnKicpIHtcbiAgICB0aGlzLl9zdGFyTGlzdGVuZXJzLnVuc2hpZnQobGlzdGVuZXIpXG4gIH0gZWxzZSB7XG4gICAgaWYgKCF0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSkgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXVxuICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLnVuc2hpZnQobGlzdGVuZXIpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuTmFub2J1cy5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uIChldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gIGFzc2VydC5vayh0eXBlb2YgZXZlbnROYW1lID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZXZlbnROYW1lID09PSAnc3ltYm9sJywgJ25hbm9idXMub25jZTogZXZlbnROYW1lIHNob3VsZCBiZSB0eXBlIHN0cmluZyBvciBzeW1ib2wnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGxpc3RlbmVyLCAnZnVuY3Rpb24nLCAnbmFub2J1cy5vbmNlOiBsaXN0ZW5lciBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG5cbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHRoaXMub24oZXZlbnROYW1lLCBvbmNlKVxuICBmdW5jdGlvbiBvbmNlICgpIHtcbiAgICBsaXN0ZW5lci5hcHBseShzZWxmLCBhcmd1bWVudHMpXG4gICAgc2VsZi5yZW1vdmVMaXN0ZW5lcihldmVudE5hbWUsIG9uY2UpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuTmFub2J1cy5wcm90b3R5cGUucHJlcGVuZE9uY2VMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gIGFzc2VydC5vayh0eXBlb2YgZXZlbnROYW1lID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgZXZlbnROYW1lID09PSAnc3ltYm9sJywgJ25hbm9idXMucHJlcGVuZE9uY2VMaXN0ZW5lcjogZXZlbnROYW1lIHNob3VsZCBiZSB0eXBlIHN0cmluZyBvciBzeW1ib2wnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGxpc3RlbmVyLCAnZnVuY3Rpb24nLCAnbmFub2J1cy5wcmVwZW5kT25jZUxpc3RlbmVyOiBsaXN0ZW5lciBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG5cbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHRoaXMucHJlcGVuZExpc3RlbmVyKGV2ZW50TmFtZSwgb25jZSlcbiAgZnVuY3Rpb24gb25jZSAoKSB7XG4gICAgbGlzdGVuZXIuYXBwbHkoc2VsZiwgYXJndW1lbnRzKVxuICAgIHNlbGYucmVtb3ZlTGlzdGVuZXIoZXZlbnROYW1lLCBvbmNlKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbk5hbm9idXMucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24gKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgYXNzZXJ0Lm9rKHR5cGVvZiBldmVudE5hbWUgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBldmVudE5hbWUgPT09ICdzeW1ib2wnLCAnbmFub2J1cy5yZW1vdmVMaXN0ZW5lcjogZXZlbnROYW1lIHNob3VsZCBiZSB0eXBlIHN0cmluZyBvciBzeW1ib2wnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGxpc3RlbmVyLCAnZnVuY3Rpb24nLCAnbmFub2J1cy5yZW1vdmVMaXN0ZW5lcjogbGlzdGVuZXIgc2hvdWxkIGJlIHR5cGUgZnVuY3Rpb24nKVxuXG4gIGlmIChldmVudE5hbWUgPT09ICcqJykge1xuICAgIHRoaXMuX3N0YXJMaXN0ZW5lcnMgPSB0aGlzLl9zdGFyTGlzdGVuZXJzLnNsaWNlKClcbiAgICByZXR1cm4gcmVtb3ZlKHRoaXMuX3N0YXJMaXN0ZW5lcnMsIGxpc3RlbmVyKVxuICB9IGVsc2Uge1xuICAgIGlmICh0eXBlb2YgdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLnNsaWNlKClcbiAgICB9XG5cbiAgICByZXR1cm4gcmVtb3ZlKHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLCBsaXN0ZW5lcilcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZSAoYXJyLCBsaXN0ZW5lcikge1xuICAgIGlmICghYXJyKSByZXR1cm5cbiAgICB2YXIgaW5kZXggPSBhcnIuaW5kZXhPZihsaXN0ZW5lcilcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBzcGxpY2UoYXJyLCBpbmRleCwgMSlcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9XG59XG5cbk5hbm9idXMucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uIChldmVudE5hbWUpIHtcbiAgaWYgKGV2ZW50TmFtZSkge1xuICAgIGlmIChldmVudE5hbWUgPT09ICcqJykge1xuICAgICAgdGhpcy5fc3Rhckxpc3RlbmVycyA9IFtdXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdID0gW11cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fc3Rhckxpc3RlbmVycyA9IFtdXG4gICAgdGhpcy5fbGlzdGVuZXJzID0ge31cbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5OYW5vYnVzLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbiAoZXZlbnROYW1lKSB7XG4gIHZhciBsaXN0ZW5lcnMgPSBldmVudE5hbWUgIT09ICcqJ1xuICAgID8gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV1cbiAgICA6IHRoaXMuX3N0YXJMaXN0ZW5lcnNcblxuICB2YXIgcmV0ID0gW11cbiAgaWYgKGxpc3RlbmVycykge1xuICAgIHZhciBpbGVuZ3RoID0gbGlzdGVuZXJzLmxlbmd0aFxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaWxlbmd0aDsgaSsrKSByZXQucHVzaChsaXN0ZW5lcnNbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5OYW5vYnVzLnByb3RvdHlwZS5fZW1pdCA9IGZ1bmN0aW9uIChhcnIsIGV2ZW50TmFtZSwgZGF0YSwgdXVpZCkge1xuICBpZiAodHlwZW9mIGFyciA9PT0gJ3VuZGVmaW5lZCcpIHJldHVyblxuICBpZiAoYXJyLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG4gIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHtcbiAgICBkYXRhID0gZXZlbnROYW1lXG4gICAgZXZlbnROYW1lID0gbnVsbFxuICB9XG5cbiAgaWYgKGV2ZW50TmFtZSkge1xuICAgIGlmICh1dWlkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGRhdGEgPSBbZXZlbnROYW1lXS5jb25jYXQoZGF0YSwgdXVpZClcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YSA9IFtldmVudE5hbWVdLmNvbmNhdChkYXRhKVxuICAgIH1cbiAgfVxuXG4gIHZhciBsZW5ndGggPSBhcnIubGVuZ3RoXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgbGlzdGVuZXIgPSBhcnJbaV1cbiAgICBsaXN0ZW5lci5hcHBseShsaXN0ZW5lciwgZGF0YSlcbiAgfVxufVxuIiwidmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG5cbnZhciBzYWZlRXh0ZXJuYWxMaW5rID0gLyhub29wZW5lcnxub3JlZmVycmVyKSAobm9vcGVuZXJ8bm9yZWZlcnJlcikvXG52YXIgcHJvdG9jb2xMaW5rID0gL15bXFx3LV9dKzovXG5cbm1vZHVsZS5leHBvcnRzID0gaHJlZlxuXG5mdW5jdGlvbiBocmVmIChjYiwgcm9vdCkge1xuICBhc3NlcnQubm90RXF1YWwodHlwZW9mIHdpbmRvdywgJ3VuZGVmaW5lZCcsICduYW5vaHJlZjogZXhwZWN0ZWQgd2luZG93IHRvIGV4aXN0JylcblxuICByb290ID0gcm9vdCB8fCB3aW5kb3cuZG9jdW1lbnRcblxuICBhc3NlcnQuZXF1YWwodHlwZW9mIGNiLCAnZnVuY3Rpb24nLCAnbmFub2hyZWY6IGNiIHNob3VsZCBiZSB0eXBlIGZ1bmN0aW9uJylcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb290LCAnb2JqZWN0JywgJ25hbm9ocmVmOiByb290IHNob3VsZCBiZSB0eXBlIG9iamVjdCcpXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoKGUuYnV0dG9uICYmIGUuYnV0dG9uICE9PSAwKSB8fFxuICAgICAgZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLmFsdEtleSB8fCBlLnNoaWZ0S2V5IHx8XG4gICAgICBlLmRlZmF1bHRQcmV2ZW50ZWQpIHJldHVyblxuXG4gICAgdmFyIGFuY2hvciA9IChmdW5jdGlvbiB0cmF2ZXJzZSAobm9kZSkge1xuICAgICAgaWYgKCFub2RlIHx8IG5vZGUgPT09IHJvb3QpIHJldHVyblxuICAgICAgaWYgKG5vZGUubG9jYWxOYW1lICE9PSAnYScgfHwgbm9kZS5ocmVmID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHRyYXZlcnNlKG5vZGUucGFyZW50Tm9kZSlcbiAgICAgIH1cbiAgICAgIHJldHVybiBub2RlXG4gICAgfSkoZS50YXJnZXQpXG5cbiAgICBpZiAoIWFuY2hvcikgcmV0dXJuXG5cbiAgICBpZiAod2luZG93LmxvY2F0aW9uLnByb3RvY29sICE9PSBhbmNob3IucHJvdG9jb2wgfHxcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lICE9PSBhbmNob3IuaG9zdG5hbWUgfHxcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLnBvcnQgIT09IGFuY2hvci5wb3J0IHx8XG4gICAgICBhbmNob3IuaGFzQXR0cmlidXRlKCdkYXRhLW5hbm9ocmVmLWlnbm9yZScpIHx8XG4gICAgICBhbmNob3IuaGFzQXR0cmlidXRlKCdkb3dubG9hZCcpIHx8XG4gICAgICAoYW5jaG9yLmdldEF0dHJpYnV0ZSgndGFyZ2V0JykgPT09ICdfYmxhbmsnICYmXG4gICAgICAgIHNhZmVFeHRlcm5hbExpbmsudGVzdChhbmNob3IuZ2V0QXR0cmlidXRlKCdyZWwnKSkpIHx8XG4gICAgICBwcm90b2NvbExpbmsudGVzdChhbmNob3IuZ2V0QXR0cmlidXRlKCdocmVmJykpKSByZXR1cm5cblxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNiKGFuY2hvcilcbiAgfSlcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgdHJhaWxpbmdOZXdsaW5lUmVnZXggPSAvXFxuW1xcc10rJC9cbnZhciBsZWFkaW5nTmV3bGluZVJlZ2V4ID0gL15cXG5bXFxzXSsvXG52YXIgdHJhaWxpbmdTcGFjZVJlZ2V4ID0gL1tcXHNdKyQvXG52YXIgbGVhZGluZ1NwYWNlUmVnZXggPSAvXltcXHNdKy9cbnZhciBtdWx0aVNwYWNlUmVnZXggPSAvW1xcblxcc10rL2dcblxudmFyIFRFWFRfVEFHUyA9IFtcbiAgJ2EnLCAnYWJicicsICdiJywgJ2JkaScsICdiZG8nLCAnYnInLCAnY2l0ZScsICdkYXRhJywgJ2RmbicsICdlbScsICdpJyxcbiAgJ2tiZCcsICdtYXJrJywgJ3EnLCAncnAnLCAncnQnLCAncnRjJywgJ3J1YnknLCAncycsICdhbXAnLCAnc21hbGwnLCAnc3BhbicsXG4gICdzdHJvbmcnLCAnc3ViJywgJ3N1cCcsICd0aW1lJywgJ3UnLCAndmFyJywgJ3dicidcbl1cblxudmFyIFZFUkJBVElNX1RBR1MgPSBbXG4gICdjb2RlJywgJ3ByZScsICd0ZXh0YXJlYSdcbl1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhcHBlbmRDaGlsZCAoZWwsIGNoaWxkcykge1xuICBpZiAoIUFycmF5LmlzQXJyYXkoY2hpbGRzKSkgcmV0dXJuXG5cbiAgdmFyIG5vZGVOYW1lID0gZWwubm9kZU5hbWUudG9Mb3dlckNhc2UoKVxuXG4gIHZhciBoYWRUZXh0ID0gZmFsc2VcbiAgdmFyIHZhbHVlLCBsZWFkZXJcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2hpbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIG5vZGUgPSBjaGlsZHNbaV1cbiAgICBpZiAoQXJyYXkuaXNBcnJheShub2RlKSkge1xuICAgICAgYXBwZW5kQ2hpbGQoZWwsIG5vZGUpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygbm9kZSA9PT0gJ251bWJlcicgfHxcbiAgICAgIHR5cGVvZiBub2RlID09PSAnYm9vbGVhbicgfHxcbiAgICAgIHR5cGVvZiBub2RlID09PSAnZnVuY3Rpb24nIHx8XG4gICAgICBub2RlIGluc3RhbmNlb2YgRGF0ZSB8fFxuICAgICAgbm9kZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgbm9kZSA9IG5vZGUudG9TdHJpbmcoKVxuICAgIH1cblxuICAgIHZhciBsYXN0Q2hpbGQgPSBlbC5jaGlsZE5vZGVzW2VsLmNoaWxkTm9kZXMubGVuZ3RoIC0gMV1cblxuICAgIC8vIEl0ZXJhdGUgb3ZlciB0ZXh0IG5vZGVzXG4gICAgaWYgKHR5cGVvZiBub2RlID09PSAnc3RyaW5nJykge1xuICAgICAgaGFkVGV4dCA9IHRydWVcblxuICAgICAgLy8gSWYgd2UgYWxyZWFkeSBoYWQgdGV4dCwgYXBwZW5kIHRvIHRoZSBleGlzdGluZyB0ZXh0XG4gICAgICBpZiAobGFzdENoaWxkICYmIGxhc3RDaGlsZC5ub2RlTmFtZSA9PT0gJyN0ZXh0Jykge1xuICAgICAgICBsYXN0Q2hpbGQubm9kZVZhbHVlICs9IG5vZGVcblxuICAgICAgLy8gV2UgZGlkbid0IGhhdmUgYSB0ZXh0IG5vZGUgeWV0LCBjcmVhdGUgb25lXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub2RlID0gZWwub3duZXJEb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShub2RlKVxuICAgICAgICBlbC5hcHBlbmRDaGlsZChub2RlKVxuICAgICAgICBsYXN0Q2hpbGQgPSBub2RlXG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoaXMgaXMgdGhlIGxhc3Qgb2YgdGhlIGNoaWxkIG5vZGVzLCBtYWtlIHN1cmUgd2UgY2xvc2UgaXQgb3V0XG4gICAgICAvLyByaWdodFxuICAgICAgaWYgKGkgPT09IGxlbiAtIDEpIHtcbiAgICAgICAgaGFkVGV4dCA9IGZhbHNlXG4gICAgICAgIC8vIFRyaW0gdGhlIGNoaWxkIHRleHQgbm9kZXMgaWYgdGhlIGN1cnJlbnQgbm9kZSBpc24ndCBhXG4gICAgICAgIC8vIG5vZGUgd2hlcmUgd2hpdGVzcGFjZSBtYXR0ZXJzLlxuICAgICAgICBpZiAoVEVYVF9UQUdTLmluZGV4T2Yobm9kZU5hbWUpID09PSAtMSAmJlxuICAgICAgICAgIFZFUkJBVElNX1RBR1MuaW5kZXhPZihub2RlTmFtZSkgPT09IC0xKSB7XG4gICAgICAgICAgdmFsdWUgPSBsYXN0Q2hpbGQubm9kZVZhbHVlXG4gICAgICAgICAgICAucmVwbGFjZShsZWFkaW5nTmV3bGluZVJlZ2V4LCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKHRyYWlsaW5nU3BhY2VSZWdleCwgJycpXG4gICAgICAgICAgICAucmVwbGFjZSh0cmFpbGluZ05ld2xpbmVSZWdleCwgJycpXG4gICAgICAgICAgICAucmVwbGFjZShtdWx0aVNwYWNlUmVnZXgsICcgJylcbiAgICAgICAgICBpZiAodmFsdWUgPT09ICcnKSB7XG4gICAgICAgICAgICBlbC5yZW1vdmVDaGlsZChsYXN0Q2hpbGQpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxhc3RDaGlsZC5ub2RlVmFsdWUgPSB2YWx1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChWRVJCQVRJTV9UQUdTLmluZGV4T2Yobm9kZU5hbWUpID09PSAtMSkge1xuICAgICAgICAgIC8vIFRoZSB2ZXJ5IGZpcnN0IG5vZGUgaW4gdGhlIGxpc3Qgc2hvdWxkIG5vdCBoYXZlIGxlYWRpbmdcbiAgICAgICAgICAvLyB3aGl0ZXNwYWNlLiBTaWJsaW5nIHRleHQgbm9kZXMgc2hvdWxkIGhhdmUgd2hpdGVzcGFjZSBpZiB0aGVyZVxuICAgICAgICAgIC8vIHdhcyBhbnkuXG4gICAgICAgICAgbGVhZGVyID0gaSA9PT0gMCA/ICcnIDogJyAnXG4gICAgICAgICAgdmFsdWUgPSBsYXN0Q2hpbGQubm9kZVZhbHVlXG4gICAgICAgICAgICAucmVwbGFjZShsZWFkaW5nTmV3bGluZVJlZ2V4LCBsZWFkZXIpXG4gICAgICAgICAgICAucmVwbGFjZShsZWFkaW5nU3BhY2VSZWdleCwgJyAnKVxuICAgICAgICAgICAgLnJlcGxhY2UodHJhaWxpbmdTcGFjZVJlZ2V4LCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKHRyYWlsaW5nTmV3bGluZVJlZ2V4LCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKG11bHRpU3BhY2VSZWdleCwgJyAnKVxuICAgICAgICAgIGxhc3RDaGlsZC5ub2RlVmFsdWUgPSB2YWx1ZVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAvLyBJdGVyYXRlIG92ZXIgRE9NIG5vZGVzXG4gICAgfSBlbHNlIGlmIChub2RlICYmIG5vZGUubm9kZVR5cGUpIHtcbiAgICAgIC8vIElmIHRoZSBsYXN0IG5vZGUgd2FzIGEgdGV4dCBub2RlLCBtYWtlIHN1cmUgaXQgaXMgcHJvcGVybHkgY2xvc2VkIG91dFxuICAgICAgaWYgKGhhZFRleHQpIHtcbiAgICAgICAgaGFkVGV4dCA9IGZhbHNlXG5cbiAgICAgICAgLy8gVHJpbSB0aGUgY2hpbGQgdGV4dCBub2RlcyBpZiB0aGUgY3VycmVudCBub2RlIGlzbid0IGFcbiAgICAgICAgLy8gdGV4dCBub2RlIG9yIGEgY29kZSBub2RlXG4gICAgICAgIGlmIChURVhUX1RBR1MuaW5kZXhPZihub2RlTmFtZSkgPT09IC0xICYmXG4gICAgICAgICAgVkVSQkFUSU1fVEFHUy5pbmRleE9mKG5vZGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgICB2YWx1ZSA9IGxhc3RDaGlsZC5ub2RlVmFsdWVcbiAgICAgICAgICAgIC5yZXBsYWNlKGxlYWRpbmdOZXdsaW5lUmVnZXgsICcnKVxuICAgICAgICAgICAgLnJlcGxhY2UodHJhaWxpbmdOZXdsaW5lUmVnZXgsICcgJylcbiAgICAgICAgICAgIC5yZXBsYWNlKG11bHRpU3BhY2VSZWdleCwgJyAnKVxuXG4gICAgICAgICAgLy8gUmVtb3ZlIGVtcHR5IHRleHQgbm9kZXMsIGFwcGVuZCBvdGhlcndpc2VcbiAgICAgICAgICBpZiAodmFsdWUgPT09ICcnKSB7XG4gICAgICAgICAgICBlbC5yZW1vdmVDaGlsZChsYXN0Q2hpbGQpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxhc3RDaGlsZC5ub2RlVmFsdWUgPSB2YWx1ZVxuICAgICAgICAgIH1cbiAgICAgICAgLy8gVHJpbSB0aGUgY2hpbGQgbm9kZXMgYnV0IHByZXNlcnZlIHRoZSBhcHByb3ByaWF0ZSB3aGl0ZXNwYWNlXG4gICAgICAgIH0gZWxzZSBpZiAoVkVSQkFUSU1fVEFHUy5pbmRleE9mKG5vZGVOYW1lKSA9PT0gLTEpIHtcbiAgICAgICAgICB2YWx1ZSA9IGxhc3RDaGlsZC5ub2RlVmFsdWVcbiAgICAgICAgICAgIC5yZXBsYWNlKGxlYWRpbmdTcGFjZVJlZ2V4LCAnICcpXG4gICAgICAgICAgICAucmVwbGFjZShsZWFkaW5nTmV3bGluZVJlZ2V4LCAnJylcbiAgICAgICAgICAgIC5yZXBsYWNlKHRyYWlsaW5nTmV3bGluZVJlZ2V4LCAnICcpXG4gICAgICAgICAgICAucmVwbGFjZShtdWx0aVNwYWNlUmVnZXgsICcgJylcbiAgICAgICAgICBsYXN0Q2hpbGQubm9kZVZhbHVlID0gdmFsdWVcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBTdG9yZSB0aGUgbGFzdCBub2RlbmFtZVxuICAgICAgdmFyIF9ub2RlTmFtZSA9IG5vZGUubm9kZU5hbWVcbiAgICAgIGlmIChfbm9kZU5hbWUpIG5vZGVOYW1lID0gX25vZGVOYW1lLnRvTG93ZXJDYXNlKClcblxuICAgICAgLy8gQXBwZW5kIHRoZSBub2RlIHRvIHRoZSBET01cbiAgICAgIGVsLmFwcGVuZENoaWxkKG5vZGUpXG4gICAgfVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxubW9kdWxlLmV4cG9ydHMgPSBbXG4gICdhc3luYycsICdhdXRvZm9jdXMnLCAnYXV0b3BsYXknLCAnY2hlY2tlZCcsICdjb250cm9scycsICdkZWZhdWx0JyxcbiAgJ2RlZmF1bHRjaGVja2VkJywgJ2RlZmVyJywgJ2Rpc2FibGVkJywgJ2Zvcm1ub3ZhbGlkYXRlJywgJ2hpZGRlbicsXG4gICdpc21hcCcsICdsb29wJywgJ211bHRpcGxlJywgJ211dGVkJywgJ25vdmFsaWRhdGUnLCAnb3BlbicsICdwbGF5c2lubGluZScsXG4gICdyZWFkb25seScsICdyZXF1aXJlZCcsICdyZXZlcnNlZCcsICdzZWxlY3RlZCdcbl1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kb20nKShkb2N1bWVudClcbiIsIid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IFtcbiAgJ2luZGV0ZXJtaW5hdGUnXG5dXG4iLCIndXNlIHN0cmljdCdcblxudmFyIGh5cGVyeCA9IHJlcXVpcmUoJ2h5cGVyeCcpXG52YXIgYXBwZW5kQ2hpbGQgPSByZXF1aXJlKCcuL2FwcGVuZC1jaGlsZCcpXG52YXIgU1ZHX1RBR1MgPSByZXF1aXJlKCcuL3N2Zy10YWdzJylcbnZhciBCT09MX1BST1BTID0gcmVxdWlyZSgnLi9ib29sLXByb3BzJylcbi8vIFByb3BzIHRoYXQgbmVlZCB0byBiZSBzZXQgZGlyZWN0bHkgcmF0aGVyIHRoYW4gd2l0aCBlbC5zZXRBdHRyaWJ1dGUoKVxudmFyIERJUkVDVF9QUk9QUyA9IHJlcXVpcmUoJy4vZGlyZWN0LXByb3BzJylcblxudmFyIFNWR05TID0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJ1xudmFyIFhMSU5LTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaydcblxudmFyIENPTU1FTlRfVEFHID0gJyEtLSdcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZG9jdW1lbnQpIHtcbiAgZnVuY3Rpb24gbmFub0h0bWxDcmVhdGVFbGVtZW50ICh0YWcsIHByb3BzLCBjaGlsZHJlbikge1xuICAgIHZhciBlbFxuXG4gICAgLy8gSWYgYW4gc3ZnIHRhZywgaXQgbmVlZHMgYSBuYW1lc3BhY2VcbiAgICBpZiAoU1ZHX1RBR1MuaW5kZXhPZih0YWcpICE9PSAtMSkge1xuICAgICAgcHJvcHMubmFtZXNwYWNlID0gU1ZHTlNcbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBhcmUgdXNpbmcgYSBuYW1lc3BhY2VcbiAgICB2YXIgbnMgPSBmYWxzZVxuICAgIGlmIChwcm9wcy5uYW1lc3BhY2UpIHtcbiAgICAgIG5zID0gcHJvcHMubmFtZXNwYWNlXG4gICAgICBkZWxldGUgcHJvcHMubmFtZXNwYWNlXG4gICAgfVxuXG4gICAgLy8gSWYgd2UgYXJlIGV4dGVuZGluZyBhIGJ1aWx0aW4gZWxlbWVudFxuICAgIHZhciBpc0N1c3RvbUVsZW1lbnQgPSBmYWxzZVxuICAgIGlmIChwcm9wcy5pcykge1xuICAgICAgaXNDdXN0b21FbGVtZW50ID0gcHJvcHMuaXNcbiAgICAgIGRlbGV0ZSBwcm9wcy5pc1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgZWxlbWVudFxuICAgIGlmIChucykge1xuICAgICAgaWYgKGlzQ3VzdG9tRWxlbWVudCkge1xuICAgICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhucywgdGFnLCB7IGlzOiBpc0N1c3RvbUVsZW1lbnQgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5zLCB0YWcpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0YWcgPT09IENPTU1FTlRfVEFHKSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlQ29tbWVudChwcm9wcy5jb21tZW50KVxuICAgIH0gZWxzZSBpZiAoaXNDdXN0b21FbGVtZW50KSB7XG4gICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnLCB7IGlzOiBpc0N1c3RvbUVsZW1lbnQgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZylcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdGhlIHByb3BlcnRpZXNcbiAgICBmb3IgKHZhciBwIGluIHByb3BzKSB7XG4gICAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkocCkpIHtcbiAgICAgICAgdmFyIGtleSA9IHAudG9Mb3dlckNhc2UoKVxuICAgICAgICB2YXIgdmFsID0gcHJvcHNbcF1cbiAgICAgICAgLy8gTm9ybWFsaXplIGNsYXNzTmFtZVxuICAgICAgICBpZiAoa2V5ID09PSAnY2xhc3NuYW1lJykge1xuICAgICAgICAgIGtleSA9ICdjbGFzcydcbiAgICAgICAgICBwID0gJ2NsYXNzJ1xuICAgICAgICB9XG4gICAgICAgIC8vIFRoZSBmb3IgYXR0cmlidXRlIGdldHMgdHJhbnNmb3JtZWQgdG8gaHRtbEZvciwgYnV0IHdlIGp1c3Qgc2V0IGFzIGZvclxuICAgICAgICBpZiAocCA9PT0gJ2h0bWxGb3InKSB7XG4gICAgICAgICAgcCA9ICdmb3InXG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgYSBwcm9wZXJ0eSBpcyBib29sZWFuLCBzZXQgaXRzZWxmIHRvIHRoZSBrZXlcbiAgICAgICAgaWYgKEJPT0xfUFJPUFMuaW5kZXhPZihrZXkpICE9PSAtMSkge1xuICAgICAgICAgIGlmIChTdHJpbmcodmFsKSA9PT0gJ3RydWUnKSB2YWwgPSBrZXlcbiAgICAgICAgICBlbHNlIGlmIChTdHJpbmcodmFsKSA9PT0gJ2ZhbHNlJykgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiBhIHByb3BlcnR5IHByZWZlcnMgYmVpbmcgc2V0IGRpcmVjdGx5IHZzIHNldEF0dHJpYnV0ZVxuICAgICAgICBpZiAoa2V5LnNsaWNlKDAsIDIpID09PSAnb24nIHx8IERJUkVDVF9QUk9QUy5pbmRleE9mKGtleSkgIT09IC0xKSB7XG4gICAgICAgICAgZWxbcF0gPSB2YWxcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAobnMpIHtcbiAgICAgICAgICAgIGlmIChwID09PSAneGxpbms6aHJlZicpIHtcbiAgICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlTlMoWExJTktOUywgcCwgdmFsKVxuICAgICAgICAgICAgfSBlbHNlIGlmICgvXnhtbG5zKCR8OikvaS50ZXN0KHApKSB7XG4gICAgICAgICAgICAgIC8vIHNraXAgeG1sbnMgZGVmaW5pdGlvbnNcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGVsLnNldEF0dHJpYnV0ZU5TKG51bGwsIHAsIHZhbClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWwuc2V0QXR0cmlidXRlKHAsIHZhbClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBhcHBlbmRDaGlsZChlbCwgY2hpbGRyZW4pXG4gICAgcmV0dXJuIGVsXG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVGcmFnbWVudCAobm9kZXMpIHtcbiAgICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAobm9kZXNbaV0gPT0gbnVsbCkgY29udGludWVcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG5vZGVzW2ldKSkge1xuICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChjcmVhdGVGcmFnbWVudChub2Rlc1tpXSkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIG5vZGVzW2ldID09PSAnc3RyaW5nJykgbm9kZXNbaV0gPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShub2Rlc1tpXSlcbiAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobm9kZXNbaV0pXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmcmFnbWVudFxuICB9XG5cbiAgdmFyIGV4cG9ydHMgPSBoeXBlcngobmFub0h0bWxDcmVhdGVFbGVtZW50LCB7XG4gICAgY29tbWVudHM6IHRydWUsXG4gICAgY3JlYXRlRnJhZ21lbnQ6IGNyZWF0ZUZyYWdtZW50XG4gIH0pXG4gIGV4cG9ydHMuZGVmYXVsdCA9IGV4cG9ydHNcbiAgZXhwb3J0cy5jcmVhdGVDb21tZW50ID0gbmFub0h0bWxDcmVhdGVFbGVtZW50XG4gIHJldHVybiBleHBvcnRzXG59XG4iLCIndXNlIHN0cmljdCdcblxubW9kdWxlLmV4cG9ydHMgPSBbXG4gICdzdmcnLCAnYWx0R2x5cGgnLCAnYWx0R2x5cGhEZWYnLCAnYWx0R2x5cGhJdGVtJywgJ2FuaW1hdGUnLCAnYW5pbWF0ZUNvbG9yJyxcbiAgJ2FuaW1hdGVNb3Rpb24nLCAnYW5pbWF0ZVRyYW5zZm9ybScsICdjaXJjbGUnLCAnY2xpcFBhdGgnLCAnY29sb3ItcHJvZmlsZScsXG4gICdjdXJzb3InLCAnZGVmcycsICdkZXNjJywgJ2VsbGlwc2UnLCAnZmVCbGVuZCcsICdmZUNvbG9yTWF0cml4JyxcbiAgJ2ZlQ29tcG9uZW50VHJhbnNmZXInLCAnZmVDb21wb3NpdGUnLCAnZmVDb252b2x2ZU1hdHJpeCcsXG4gICdmZURpZmZ1c2VMaWdodGluZycsICdmZURpc3BsYWNlbWVudE1hcCcsICdmZURpc3RhbnRMaWdodCcsICdmZUZsb29kJyxcbiAgJ2ZlRnVuY0EnLCAnZmVGdW5jQicsICdmZUZ1bmNHJywgJ2ZlRnVuY1InLCAnZmVHYXVzc2lhbkJsdXInLCAnZmVJbWFnZScsXG4gICdmZU1lcmdlJywgJ2ZlTWVyZ2VOb2RlJywgJ2ZlTW9ycGhvbG9neScsICdmZU9mZnNldCcsICdmZVBvaW50TGlnaHQnLFxuICAnZmVTcGVjdWxhckxpZ2h0aW5nJywgJ2ZlU3BvdExpZ2h0JywgJ2ZlVGlsZScsICdmZVR1cmJ1bGVuY2UnLCAnZmlsdGVyJyxcbiAgJ2ZvbnQnLCAnZm9udC1mYWNlJywgJ2ZvbnQtZmFjZS1mb3JtYXQnLCAnZm9udC1mYWNlLW5hbWUnLCAnZm9udC1mYWNlLXNyYycsXG4gICdmb250LWZhY2UtdXJpJywgJ2ZvcmVpZ25PYmplY3QnLCAnZycsICdnbHlwaCcsICdnbHlwaFJlZicsICdoa2VybicsICdpbWFnZScsXG4gICdsaW5lJywgJ2xpbmVhckdyYWRpZW50JywgJ21hcmtlcicsICdtYXNrJywgJ21ldGFkYXRhJywgJ21pc3NpbmctZ2x5cGgnLFxuICAnbXBhdGgnLCAncGF0aCcsICdwYXR0ZXJuJywgJ3BvbHlnb24nLCAncG9seWxpbmUnLCAncmFkaWFsR3JhZGllbnQnLCAncmVjdCcsXG4gICdzZXQnLCAnc3RvcCcsICdzd2l0Y2gnLCAnc3ltYm9sJywgJ3RleHQnLCAndGV4dFBhdGgnLCAndGl0bGUnLCAndHJlZicsXG4gICd0c3BhbicsICd1c2UnLCAndmlldycsICd2a2Vybidcbl1cbiIsIm1vZHVsZS5leHBvcnRzID0gTFJVXG5cbmZ1bmN0aW9uIExSVSAob3B0cykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTFJVKSkgcmV0dXJuIG5ldyBMUlUob3B0cylcbiAgaWYgKHR5cGVvZiBvcHRzID09PSAnbnVtYmVyJykgb3B0cyA9IHttYXg6IG9wdHN9XG4gIGlmICghb3B0cykgb3B0cyA9IHt9XG4gIHRoaXMuY2FjaGUgPSB7fVxuICB0aGlzLmhlYWQgPSB0aGlzLnRhaWwgPSBudWxsXG4gIHRoaXMubGVuZ3RoID0gMFxuICB0aGlzLm1heCA9IG9wdHMubWF4IHx8IDEwMDBcbiAgdGhpcy5tYXhBZ2UgPSBvcHRzLm1heEFnZSB8fCAwXG59XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShMUlUucHJvdG90eXBlLCAna2V5cycsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmNhY2hlKSB9XG59KVxuXG5MUlUucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmNhY2hlID0ge31cbiAgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gbnVsbFxuICB0aGlzLmxlbmd0aCA9IDBcbn1cblxuTFJVLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoa2V5KSB7XG4gIGlmICh0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykga2V5ID0gJycgKyBrZXlcbiAgaWYgKCF0aGlzLmNhY2hlLmhhc093blByb3BlcnR5KGtleSkpIHJldHVyblxuXG4gIHZhciBlbGVtZW50ID0gdGhpcy5jYWNoZVtrZXldXG4gIGRlbGV0ZSB0aGlzLmNhY2hlW2tleV1cbiAgdGhpcy5fdW5saW5rKGtleSwgZWxlbWVudC5wcmV2LCBlbGVtZW50Lm5leHQpXG4gIHJldHVybiBlbGVtZW50LnZhbHVlXG59XG5cbkxSVS5wcm90b3R5cGUuX3VubGluayA9IGZ1bmN0aW9uIChrZXksIHByZXYsIG5leHQpIHtcbiAgdGhpcy5sZW5ndGgtLVxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IG51bGxcbiAgfSBlbHNlIHtcbiAgICBpZiAodGhpcy5oZWFkID09PSBrZXkpIHtcbiAgICAgIHRoaXMuaGVhZCA9IHByZXZcbiAgICAgIHRoaXMuY2FjaGVbdGhpcy5oZWFkXS5uZXh0ID0gbnVsbFxuICAgIH0gZWxzZSBpZiAodGhpcy50YWlsID09PSBrZXkpIHtcbiAgICAgIHRoaXMudGFpbCA9IG5leHRcbiAgICAgIHRoaXMuY2FjaGVbdGhpcy50YWlsXS5wcmV2ID0gbnVsbFxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNhY2hlW3ByZXZdLm5leHQgPSBuZXh0XG4gICAgICB0aGlzLmNhY2hlW25leHRdLnByZXYgPSBwcmV2XG4gICAgfVxuICB9XG59XG5cbkxSVS5wcm90b3R5cGUucGVlayA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgaWYgKCF0aGlzLmNhY2hlLmhhc093blByb3BlcnR5KGtleSkpIHJldHVyblxuXG4gIHZhciBlbGVtZW50ID0gdGhpcy5jYWNoZVtrZXldXG5cbiAgaWYgKCF0aGlzLl9jaGVja0FnZShrZXksIGVsZW1lbnQpKSByZXR1cm5cbiAgcmV0dXJuIGVsZW1lbnQudmFsdWVcbn1cblxuTFJVLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICBpZiAodHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIGtleSA9ICcnICsga2V5XG5cbiAgdmFyIGVsZW1lbnRcblxuICBpZiAodGhpcy5jYWNoZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgZWxlbWVudCA9IHRoaXMuY2FjaGVba2V5XVxuICAgIGVsZW1lbnQudmFsdWUgPSB2YWx1ZVxuICAgIGlmICh0aGlzLm1heEFnZSkgZWxlbWVudC5tb2RpZmllZCA9IERhdGUubm93KClcblxuICAgIC8vIElmIGl0J3MgYWxyZWFkeSB0aGUgaGVhZCwgdGhlcmUncyBub3RoaW5nIG1vcmUgdG8gZG86XG4gICAgaWYgKGtleSA9PT0gdGhpcy5oZWFkKSByZXR1cm4gdmFsdWVcbiAgICB0aGlzLl91bmxpbmsoa2V5LCBlbGVtZW50LnByZXYsIGVsZW1lbnQubmV4dClcbiAgfSBlbHNlIHtcbiAgICBlbGVtZW50ID0ge3ZhbHVlOiB2YWx1ZSwgbW9kaWZpZWQ6IDAsIG5leHQ6IG51bGwsIHByZXY6IG51bGx9XG4gICAgaWYgKHRoaXMubWF4QWdlKSBlbGVtZW50Lm1vZGlmaWVkID0gRGF0ZS5ub3coKVxuICAgIHRoaXMuY2FjaGVba2V5XSA9IGVsZW1lbnRcblxuICAgIC8vIEV2aWN0aW9uIGlzIG9ubHkgcG9zc2libGUgaWYgdGhlIGtleSBkaWRuJ3QgYWxyZWFkeSBleGlzdDpcbiAgICBpZiAodGhpcy5sZW5ndGggPT09IHRoaXMubWF4KSB0aGlzLmV2aWN0KClcbiAgfVxuXG4gIHRoaXMubGVuZ3RoKytcbiAgZWxlbWVudC5uZXh0ID0gbnVsbFxuICBlbGVtZW50LnByZXYgPSB0aGlzLmhlYWRcblxuICBpZiAodGhpcy5oZWFkKSB0aGlzLmNhY2hlW3RoaXMuaGVhZF0ubmV4dCA9IGtleVxuICB0aGlzLmhlYWQgPSBrZXlcblxuICBpZiAoIXRoaXMudGFpbCkgdGhpcy50YWlsID0ga2V5XG4gIHJldHVybiB2YWx1ZVxufVxuXG5MUlUucHJvdG90eXBlLl9jaGVja0FnZSA9IGZ1bmN0aW9uIChrZXksIGVsZW1lbnQpIHtcbiAgaWYgKHRoaXMubWF4QWdlICYmIChEYXRlLm5vdygpIC0gZWxlbWVudC5tb2RpZmllZCkgPiB0aGlzLm1heEFnZSkge1xuICAgIHRoaXMucmVtb3ZlKGtleSlcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICByZXR1cm4gdHJ1ZVxufVxuXG5MUlUucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSBrZXkgPSAnJyArIGtleVxuICBpZiAoIXRoaXMuY2FjaGUuaGFzT3duUHJvcGVydHkoa2V5KSkgcmV0dXJuXG5cbiAgdmFyIGVsZW1lbnQgPSB0aGlzLmNhY2hlW2tleV1cblxuICBpZiAoIXRoaXMuX2NoZWNrQWdlKGtleSwgZWxlbWVudCkpIHJldHVyblxuXG4gIGlmICh0aGlzLmhlYWQgIT09IGtleSkge1xuICAgIGlmIChrZXkgPT09IHRoaXMudGFpbCkge1xuICAgICAgdGhpcy50YWlsID0gZWxlbWVudC5uZXh0XG4gICAgICB0aGlzLmNhY2hlW3RoaXMudGFpbF0ucHJldiA9IG51bGxcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU2V0IHByZXYubmV4dCAtPiBlbGVtZW50Lm5leHQ6XG4gICAgICB0aGlzLmNhY2hlW2VsZW1lbnQucHJldl0ubmV4dCA9IGVsZW1lbnQubmV4dFxuICAgIH1cblxuICAgIC8vIFNldCBlbGVtZW50Lm5leHQucHJldiAtPiBlbGVtZW50LnByZXY6XG4gICAgdGhpcy5jYWNoZVtlbGVtZW50Lm5leHRdLnByZXYgPSBlbGVtZW50LnByZXZcblxuICAgIC8vIEVsZW1lbnQgaXMgdGhlIG5ldyBoZWFkXG4gICAgdGhpcy5jYWNoZVt0aGlzLmhlYWRdLm5leHQgPSBrZXlcbiAgICBlbGVtZW50LnByZXYgPSB0aGlzLmhlYWRcbiAgICBlbGVtZW50Lm5leHQgPSBudWxsXG4gICAgdGhpcy5oZWFkID0ga2V5XG4gIH1cblxuICByZXR1cm4gZWxlbWVudC52YWx1ZVxufVxuXG5MUlUucHJvdG90eXBlLmV2aWN0ID0gZnVuY3Rpb24gKCkge1xuICBpZiAoIXRoaXMudGFpbCkgcmV0dXJuXG4gIHRoaXMucmVtb3ZlKHRoaXMudGFpbClcbn1cbiIsInZhciBhc3NlcnQgPSByZXF1aXJlKCduYW5vYXNzZXJ0JylcbnZhciBtb3JwaCA9IHJlcXVpcmUoJy4vbGliL21vcnBoJylcblxudmFyIFRFWFRfTk9ERSA9IDNcbi8vIHZhciBERUJVRyA9IGZhbHNlXG5cbm1vZHVsZS5leHBvcnRzID0gbmFub21vcnBoXG5cbi8vIE1vcnBoIG9uZSB0cmVlIGludG8gYW5vdGhlciB0cmVlXG4vL1xuLy8gbm8gcGFyZW50XG4vLyAgIC0+IHNhbWU6IGRpZmYgYW5kIHdhbGsgY2hpbGRyZW5cbi8vICAgLT4gbm90IHNhbWU6IHJlcGxhY2UgYW5kIHJldHVyblxuLy8gb2xkIG5vZGUgZG9lc24ndCBleGlzdFxuLy8gICAtPiBpbnNlcnQgbmV3IG5vZGVcbi8vIG5ldyBub2RlIGRvZXNuJ3QgZXhpc3Rcbi8vICAgLT4gZGVsZXRlIG9sZCBub2RlXG4vLyBub2RlcyBhcmUgbm90IHRoZSBzYW1lXG4vLyAgIC0+IGRpZmYgbm9kZXMgYW5kIGFwcGx5IHBhdGNoIHRvIG9sZCBub2RlXG4vLyBub2RlcyBhcmUgdGhlIHNhbWVcbi8vICAgLT4gd2FsayBhbGwgY2hpbGQgbm9kZXMgYW5kIGFwcGVuZCB0byBvbGQgbm9kZVxuZnVuY3Rpb24gbmFub21vcnBoIChvbGRUcmVlLCBuZXdUcmVlLCBvcHRpb25zKSB7XG4gIC8vIGlmIChERUJVRykge1xuICAvLyAgIGNvbnNvbGUubG9nKFxuICAvLyAgICduYW5vbW9ycGhcXG5vbGRcXG4gICVzXFxubmV3XFxuICAlcycsXG4gIC8vICAgb2xkVHJlZSAmJiBvbGRUcmVlLm91dGVySFRNTCxcbiAgLy8gICBuZXdUcmVlICYmIG5ld1RyZWUub3V0ZXJIVE1MXG4gIC8vIClcbiAgLy8gfVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIG9sZFRyZWUsICdvYmplY3QnLCAnbmFub21vcnBoOiBvbGRUcmVlIHNob3VsZCBiZSBhbiBvYmplY3QnKVxuICBhc3NlcnQuZXF1YWwodHlwZW9mIG5ld1RyZWUsICdvYmplY3QnLCAnbmFub21vcnBoOiBuZXdUcmVlIHNob3VsZCBiZSBhbiBvYmplY3QnKVxuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuY2hpbGRyZW5Pbmx5KSB7XG4gICAgdXBkYXRlQ2hpbGRyZW4obmV3VHJlZSwgb2xkVHJlZSlcbiAgICByZXR1cm4gb2xkVHJlZVxuICB9XG5cbiAgYXNzZXJ0Lm5vdEVxdWFsKFxuICAgIG5ld1RyZWUubm9kZVR5cGUsXG4gICAgMTEsXG4gICAgJ25hbm9tb3JwaDogbmV3VHJlZSBzaG91bGQgaGF2ZSBvbmUgcm9vdCBub2RlICh3aGljaCBpcyBub3QgYSBEb2N1bWVudEZyYWdtZW50KSdcbiAgKVxuXG4gIHJldHVybiB3YWxrKG5ld1RyZWUsIG9sZFRyZWUpXG59XG5cbi8vIFdhbGsgYW5kIG1vcnBoIGEgZG9tIHRyZWVcbmZ1bmN0aW9uIHdhbGsgKG5ld05vZGUsIG9sZE5vZGUpIHtcbiAgLy8gaWYgKERFQlVHKSB7XG4gIC8vICAgY29uc29sZS5sb2coXG4gIC8vICAgJ3dhbGtcXG5vbGRcXG4gICVzXFxubmV3XFxuICAlcycsXG4gIC8vICAgb2xkTm9kZSAmJiBvbGROb2RlLm91dGVySFRNTCxcbiAgLy8gICBuZXdOb2RlICYmIG5ld05vZGUub3V0ZXJIVE1MXG4gIC8vIClcbiAgLy8gfVxuICBpZiAoIW9sZE5vZGUpIHtcbiAgICByZXR1cm4gbmV3Tm9kZVxuICB9IGVsc2UgaWYgKCFuZXdOb2RlKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfSBlbHNlIGlmIChuZXdOb2RlLmlzU2FtZU5vZGUgJiYgbmV3Tm9kZS5pc1NhbWVOb2RlKG9sZE5vZGUpKSB7XG4gICAgcmV0dXJuIG9sZE5vZGVcbiAgfSBlbHNlIGlmIChuZXdOb2RlLnRhZ05hbWUgIT09IG9sZE5vZGUudGFnTmFtZSB8fCBnZXRDb21wb25lbnRJZChuZXdOb2RlKSAhPT0gZ2V0Q29tcG9uZW50SWQob2xkTm9kZSkpIHtcbiAgICByZXR1cm4gbmV3Tm9kZVxuICB9IGVsc2Uge1xuICAgIG1vcnBoKG5ld05vZGUsIG9sZE5vZGUpXG4gICAgdXBkYXRlQ2hpbGRyZW4obmV3Tm9kZSwgb2xkTm9kZSlcbiAgICByZXR1cm4gb2xkTm9kZVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudElkIChub2RlKSB7XG4gIHJldHVybiBub2RlLmRhdGFzZXQgPyBub2RlLmRhdGFzZXQubmFub21vcnBoQ29tcG9uZW50SWQgOiB1bmRlZmluZWRcbn1cblxuLy8gVXBkYXRlIHRoZSBjaGlsZHJlbiBvZiBlbGVtZW50c1xuLy8gKG9iaiwgb2JqKSAtPiBudWxsXG5mdW5jdGlvbiB1cGRhdGVDaGlsZHJlbiAobmV3Tm9kZSwgb2xkTm9kZSkge1xuICAvLyBpZiAoREVCVUcpIHtcbiAgLy8gICBjb25zb2xlLmxvZyhcbiAgLy8gICAndXBkYXRlQ2hpbGRyZW5cXG5vbGRcXG4gICVzXFxubmV3XFxuICAlcycsXG4gIC8vICAgb2xkTm9kZSAmJiBvbGROb2RlLm91dGVySFRNTCxcbiAgLy8gICBuZXdOb2RlICYmIG5ld05vZGUub3V0ZXJIVE1MXG4gIC8vIClcbiAgLy8gfVxuICB2YXIgb2xkQ2hpbGQsIG5ld0NoaWxkLCBtb3JwaGVkLCBvbGRNYXRjaFxuXG4gIC8vIFRoZSBvZmZzZXQgaXMgb25seSBldmVyIGluY3JlYXNlZCwgYW5kIHVzZWQgZm9yIFtpIC0gb2Zmc2V0XSBpbiB0aGUgbG9vcFxuICB2YXIgb2Zmc2V0ID0gMFxuXG4gIGZvciAodmFyIGkgPSAwOyA7IGkrKykge1xuICAgIG9sZENoaWxkID0gb2xkTm9kZS5jaGlsZE5vZGVzW2ldXG4gICAgbmV3Q2hpbGQgPSBuZXdOb2RlLmNoaWxkTm9kZXNbaSAtIG9mZnNldF1cbiAgICAvLyBpZiAoREVCVUcpIHtcbiAgICAvLyAgIGNvbnNvbGUubG9nKFxuICAgIC8vICAgJz09PVxcbi0gb2xkXFxuICAlc1xcbi0gbmV3XFxuICAlcycsXG4gICAgLy8gICBvbGRDaGlsZCAmJiBvbGRDaGlsZC5vdXRlckhUTUwsXG4gICAgLy8gICBuZXdDaGlsZCAmJiBuZXdDaGlsZC5vdXRlckhUTUxcbiAgICAvLyApXG4gICAgLy8gfVxuICAgIC8vIEJvdGggbm9kZXMgYXJlIGVtcHR5LCBkbyBub3RoaW5nXG4gICAgaWYgKCFvbGRDaGlsZCAmJiAhbmV3Q2hpbGQpIHtcbiAgICAgIGJyZWFrXG5cbiAgICAvLyBUaGVyZSBpcyBubyBuZXcgY2hpbGQsIHJlbW92ZSBvbGRcbiAgICB9IGVsc2UgaWYgKCFuZXdDaGlsZCkge1xuICAgICAgb2xkTm9kZS5yZW1vdmVDaGlsZChvbGRDaGlsZClcbiAgICAgIGktLVxuXG4gICAgLy8gVGhlcmUgaXMgbm8gb2xkIGNoaWxkLCBhZGQgbmV3XG4gICAgfSBlbHNlIGlmICghb2xkQ2hpbGQpIHtcbiAgICAgIG9sZE5vZGUuYXBwZW5kQ2hpbGQobmV3Q2hpbGQpXG4gICAgICBvZmZzZXQrK1xuXG4gICAgLy8gQm90aCBub2RlcyBhcmUgdGhlIHNhbWUsIG1vcnBoXG4gICAgfSBlbHNlIGlmIChzYW1lKG5ld0NoaWxkLCBvbGRDaGlsZCkpIHtcbiAgICAgIG1vcnBoZWQgPSB3YWxrKG5ld0NoaWxkLCBvbGRDaGlsZClcbiAgICAgIGlmIChtb3JwaGVkICE9PSBvbGRDaGlsZCkge1xuICAgICAgICBvbGROb2RlLnJlcGxhY2VDaGlsZChtb3JwaGVkLCBvbGRDaGlsZClcbiAgICAgICAgb2Zmc2V0KytcbiAgICAgIH1cblxuICAgIC8vIEJvdGggbm9kZXMgZG8gbm90IHNoYXJlIGFuIElEIG9yIGEgcGxhY2Vob2xkZXIsIHRyeSByZW9yZGVyXG4gICAgfSBlbHNlIHtcbiAgICAgIG9sZE1hdGNoID0gbnVsbFxuXG4gICAgICAvLyBUcnkgYW5kIGZpbmQgYSBzaW1pbGFyIG5vZGUgc29tZXdoZXJlIGluIHRoZSB0cmVlXG4gICAgICBmb3IgKHZhciBqID0gaTsgaiA8IG9sZE5vZGUuY2hpbGROb2Rlcy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoc2FtZShvbGROb2RlLmNoaWxkTm9kZXNbal0sIG5ld0NoaWxkKSkge1xuICAgICAgICAgIG9sZE1hdGNoID0gb2xkTm9kZS5jaGlsZE5vZGVzW2pdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSB3YXMgYSBub2RlIHdpdGggdGhlIHNhbWUgSUQgb3IgcGxhY2Vob2xkZXIgaW4gdGhlIG9sZCBsaXN0XG4gICAgICBpZiAob2xkTWF0Y2gpIHtcbiAgICAgICAgbW9ycGhlZCA9IHdhbGsobmV3Q2hpbGQsIG9sZE1hdGNoKVxuICAgICAgICBpZiAobW9ycGhlZCAhPT0gb2xkTWF0Y2gpIG9mZnNldCsrXG4gICAgICAgIG9sZE5vZGUuaW5zZXJ0QmVmb3JlKG1vcnBoZWQsIG9sZENoaWxkKVxuXG4gICAgICAvLyBJdCdzIHNhZmUgdG8gbW9ycGggdHdvIG5vZGVzIGluLXBsYWNlIGlmIG5laXRoZXIgaGFzIGFuIElEXG4gICAgICB9IGVsc2UgaWYgKCFuZXdDaGlsZC5pZCAmJiAhb2xkQ2hpbGQuaWQpIHtcbiAgICAgICAgbW9ycGhlZCA9IHdhbGsobmV3Q2hpbGQsIG9sZENoaWxkKVxuICAgICAgICBpZiAobW9ycGhlZCAhPT0gb2xkQ2hpbGQpIHtcbiAgICAgICAgICBvbGROb2RlLnJlcGxhY2VDaGlsZChtb3JwaGVkLCBvbGRDaGlsZClcbiAgICAgICAgICBvZmZzZXQrK1xuICAgICAgICB9XG5cbiAgICAgIC8vIEluc2VydCB0aGUgbm9kZSBhdCB0aGUgaW5kZXggaWYgd2UgY291bGRuJ3QgbW9ycGggb3IgZmluZCBhIG1hdGNoaW5nIG5vZGVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9sZE5vZGUuaW5zZXJ0QmVmb3JlKG5ld0NoaWxkLCBvbGRDaGlsZClcbiAgICAgICAgb2Zmc2V0KytcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2FtZSAoYSwgYikge1xuICBpZiAoYS5pZCkgcmV0dXJuIGEuaWQgPT09IGIuaWRcbiAgaWYgKGEuaXNTYW1lTm9kZSkgcmV0dXJuIGEuaXNTYW1lTm9kZShiKVxuICBpZiAoYS50YWdOYW1lICE9PSBiLnRhZ05hbWUpIHJldHVybiBmYWxzZVxuICBpZiAoYS50eXBlID09PSBURVhUX05PREUpIHJldHVybiBhLm5vZGVWYWx1ZSA9PT0gYi5ub2RlVmFsdWVcbiAgcmV0dXJuIGZhbHNlXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgLy8gYXR0cmlidXRlIGV2ZW50cyAoY2FuIGJlIHNldCB3aXRoIGF0dHJpYnV0ZXMpXG4gICdvbmNsaWNrJyxcbiAgJ29uZGJsY2xpY2snLFxuICAnb25tb3VzZWRvd24nLFxuICAnb25tb3VzZXVwJyxcbiAgJ29ubW91c2VvdmVyJyxcbiAgJ29ubW91c2Vtb3ZlJyxcbiAgJ29ubW91c2VvdXQnLFxuICAnb25tb3VzZWVudGVyJyxcbiAgJ29ubW91c2VsZWF2ZScsXG4gICdvbnRvdWNoY2FuY2VsJyxcbiAgJ29udG91Y2hlbmQnLFxuICAnb250b3VjaG1vdmUnLFxuICAnb250b3VjaHN0YXJ0JyxcbiAgJ29uZHJhZ3N0YXJ0JyxcbiAgJ29uZHJhZycsXG4gICdvbmRyYWdlbnRlcicsXG4gICdvbmRyYWdsZWF2ZScsXG4gICdvbmRyYWdvdmVyJyxcbiAgJ29uZHJvcCcsXG4gICdvbmRyYWdlbmQnLFxuICAnb25rZXlkb3duJyxcbiAgJ29ua2V5cHJlc3MnLFxuICAnb25rZXl1cCcsXG4gICdvbnVubG9hZCcsXG4gICdvbmFib3J0JyxcbiAgJ29uZXJyb3InLFxuICAnb25yZXNpemUnLFxuICAnb25zY3JvbGwnLFxuICAnb25zZWxlY3QnLFxuICAnb25jaGFuZ2UnLFxuICAnb25zdWJtaXQnLFxuICAnb25yZXNldCcsXG4gICdvbmZvY3VzJyxcbiAgJ29uYmx1cicsXG4gICdvbmlucHV0JyxcbiAgJ29uYW5pbWF0aW9uZW5kJyxcbiAgJ29uYW5pbWF0aW9uaXRlcmF0aW9uJyxcbiAgJ29uYW5pbWF0aW9uc3RhcnQnLFxuICAvLyBvdGhlciBjb21tb24gZXZlbnRzXG4gICdvbmNvbnRleHRtZW51JyxcbiAgJ29uZm9jdXNpbicsXG4gICdvbmZvY3Vzb3V0J1xuXVxuIiwidmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJylcbnZhciBldmVudHNMZW5ndGggPSBldmVudHMubGVuZ3RoXG5cbnZhciBFTEVNRU5UX05PREUgPSAxXG52YXIgVEVYVF9OT0RFID0gM1xudmFyIENPTU1FTlRfTk9ERSA9IDhcblxubW9kdWxlLmV4cG9ydHMgPSBtb3JwaFxuXG4vLyBkaWZmIGVsZW1lbnRzIGFuZCBhcHBseSB0aGUgcmVzdWx0aW5nIHBhdGNoIHRvIHRoZSBvbGQgbm9kZVxuLy8gKG9iaiwgb2JqKSAtPiBudWxsXG5mdW5jdGlvbiBtb3JwaCAobmV3Tm9kZSwgb2xkTm9kZSkge1xuICB2YXIgbm9kZVR5cGUgPSBuZXdOb2RlLm5vZGVUeXBlXG4gIHZhciBub2RlTmFtZSA9IG5ld05vZGUubm9kZU5hbWVcblxuICBpZiAobm9kZVR5cGUgPT09IEVMRU1FTlRfTk9ERSkge1xuICAgIGNvcHlBdHRycyhuZXdOb2RlLCBvbGROb2RlKVxuICB9XG5cbiAgaWYgKG5vZGVUeXBlID09PSBURVhUX05PREUgfHwgbm9kZVR5cGUgPT09IENPTU1FTlRfTk9ERSkge1xuICAgIGlmIChvbGROb2RlLm5vZGVWYWx1ZSAhPT0gbmV3Tm9kZS5ub2RlVmFsdWUpIHtcbiAgICAgIG9sZE5vZGUubm9kZVZhbHVlID0gbmV3Tm9kZS5ub2RlVmFsdWVcbiAgICB9XG4gIH1cblxuICAvLyBTb21lIERPTSBub2RlcyBhcmUgd2VpcmRcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BhdHJpY2stc3RlZWxlLWlkZW0vbW9ycGhkb20vYmxvYi9tYXN0ZXIvc3JjL3NwZWNpYWxFbEhhbmRsZXJzLmpzXG4gIGlmIChub2RlTmFtZSA9PT0gJ0lOUFVUJykgdXBkYXRlSW5wdXQobmV3Tm9kZSwgb2xkTm9kZSlcbiAgZWxzZSBpZiAobm9kZU5hbWUgPT09ICdPUFRJT04nKSB1cGRhdGVPcHRpb24obmV3Tm9kZSwgb2xkTm9kZSlcbiAgZWxzZSBpZiAobm9kZU5hbWUgPT09ICdURVhUQVJFQScpIHVwZGF0ZVRleHRhcmVhKG5ld05vZGUsIG9sZE5vZGUpXG5cbiAgY29weUV2ZW50cyhuZXdOb2RlLCBvbGROb2RlKVxufVxuXG5mdW5jdGlvbiBjb3B5QXR0cnMgKG5ld05vZGUsIG9sZE5vZGUpIHtcbiAgdmFyIG9sZEF0dHJzID0gb2xkTm9kZS5hdHRyaWJ1dGVzXG4gIHZhciBuZXdBdHRycyA9IG5ld05vZGUuYXR0cmlidXRlc1xuICB2YXIgYXR0ck5hbWVzcGFjZVVSSSA9IG51bGxcbiAgdmFyIGF0dHJWYWx1ZSA9IG51bGxcbiAgdmFyIGZyb21WYWx1ZSA9IG51bGxcbiAgdmFyIGF0dHJOYW1lID0gbnVsbFxuICB2YXIgYXR0ciA9IG51bGxcblxuICBmb3IgKHZhciBpID0gbmV3QXR0cnMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICBhdHRyID0gbmV3QXR0cnNbaV1cbiAgICBhdHRyTmFtZSA9IGF0dHIubmFtZVxuICAgIGF0dHJOYW1lc3BhY2VVUkkgPSBhdHRyLm5hbWVzcGFjZVVSSVxuICAgIGF0dHJWYWx1ZSA9IGF0dHIudmFsdWVcbiAgICBpZiAoYXR0ck5hbWVzcGFjZVVSSSkge1xuICAgICAgYXR0ck5hbWUgPSBhdHRyLmxvY2FsTmFtZSB8fCBhdHRyTmFtZVxuICAgICAgZnJvbVZhbHVlID0gb2xkTm9kZS5nZXRBdHRyaWJ1dGVOUyhhdHRyTmFtZXNwYWNlVVJJLCBhdHRyTmFtZSlcbiAgICAgIGlmIChmcm9tVmFsdWUgIT09IGF0dHJWYWx1ZSkge1xuICAgICAgICBvbGROb2RlLnNldEF0dHJpYnV0ZU5TKGF0dHJOYW1lc3BhY2VVUkksIGF0dHJOYW1lLCBhdHRyVmFsdWUpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghb2xkTm9kZS5oYXNBdHRyaWJ1dGUoYXR0ck5hbWUpKSB7XG4gICAgICAgIG9sZE5vZGUuc2V0QXR0cmlidXRlKGF0dHJOYW1lLCBhdHRyVmFsdWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcm9tVmFsdWUgPSBvbGROb2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgaWYgKGZyb21WYWx1ZSAhPT0gYXR0clZhbHVlKSB7XG4gICAgICAgICAgLy8gYXBwYXJlbnRseSB2YWx1ZXMgYXJlIGFsd2F5cyBjYXN0IHRvIHN0cmluZ3MsIGFoIHdlbGxcbiAgICAgICAgICBpZiAoYXR0clZhbHVlID09PSAnbnVsbCcgfHwgYXR0clZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb2xkTm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0ck5hbWUpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9sZE5vZGUuc2V0QXR0cmlidXRlKGF0dHJOYW1lLCBhdHRyVmFsdWUpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIGFueSBleHRyYSBhdHRyaWJ1dGVzIGZvdW5kIG9uIHRoZSBvcmlnaW5hbCBET00gZWxlbWVudCB0aGF0XG4gIC8vIHdlcmVuJ3QgZm91bmQgb24gdGhlIHRhcmdldCBlbGVtZW50LlxuICBmb3IgKHZhciBqID0gb2xkQXR0cnMubGVuZ3RoIC0gMTsgaiA+PSAwOyAtLWopIHtcbiAgICBhdHRyID0gb2xkQXR0cnNbal1cbiAgICBpZiAoYXR0ci5zcGVjaWZpZWQgIT09IGZhbHNlKSB7XG4gICAgICBhdHRyTmFtZSA9IGF0dHIubmFtZVxuICAgICAgYXR0ck5hbWVzcGFjZVVSSSA9IGF0dHIubmFtZXNwYWNlVVJJXG5cbiAgICAgIGlmIChhdHRyTmFtZXNwYWNlVVJJKSB7XG4gICAgICAgIGF0dHJOYW1lID0gYXR0ci5sb2NhbE5hbWUgfHwgYXR0ck5hbWVcbiAgICAgICAgaWYgKCFuZXdOb2RlLmhhc0F0dHJpYnV0ZU5TKGF0dHJOYW1lc3BhY2VVUkksIGF0dHJOYW1lKSkge1xuICAgICAgICAgIG9sZE5vZGUucmVtb3ZlQXR0cmlidXRlTlMoYXR0ck5hbWVzcGFjZVVSSSwgYXR0ck5hbWUpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghbmV3Tm9kZS5oYXNBdHRyaWJ1dGVOUyhudWxsLCBhdHRyTmFtZSkpIHtcbiAgICAgICAgICBvbGROb2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjb3B5RXZlbnRzIChuZXdOb2RlLCBvbGROb2RlKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZXZlbnRzTGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgZXYgPSBldmVudHNbaV1cbiAgICBpZiAobmV3Tm9kZVtldl0pIHsgICAgICAgICAgIC8vIGlmIG5ldyBlbGVtZW50IGhhcyBhIHdoaXRlbGlzdGVkIGF0dHJpYnV0ZVxuICAgICAgb2xkTm9kZVtldl0gPSBuZXdOb2RlW2V2XSAgLy8gdXBkYXRlIGV4aXN0aW5nIGVsZW1lbnRcbiAgICB9IGVsc2UgaWYgKG9sZE5vZGVbZXZdKSB7ICAgIC8vIGlmIGV4aXN0aW5nIGVsZW1lbnQgaGFzIGl0IGFuZCBuZXcgb25lIGRvZXNudFxuICAgICAgb2xkTm9kZVtldl0gPSB1bmRlZmluZWQgICAgLy8gcmVtb3ZlIGl0IGZyb20gZXhpc3RpbmcgZWxlbWVudFxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVPcHRpb24gKG5ld05vZGUsIG9sZE5vZGUpIHtcbiAgdXBkYXRlQXR0cmlidXRlKG5ld05vZGUsIG9sZE5vZGUsICdzZWxlY3RlZCcpXG59XG5cbi8vIFRoZSBcInZhbHVlXCIgYXR0cmlidXRlIGlzIHNwZWNpYWwgZm9yIHRoZSA8aW5wdXQ+IGVsZW1lbnQgc2luY2UgaXQgc2V0cyB0aGVcbi8vIGluaXRpYWwgdmFsdWUuIENoYW5naW5nIHRoZSBcInZhbHVlXCIgYXR0cmlidXRlIHdpdGhvdXQgY2hhbmdpbmcgdGhlIFwidmFsdWVcIlxuLy8gcHJvcGVydHkgd2lsbCBoYXZlIG5vIGVmZmVjdCBzaW5jZSBpdCBpcyBvbmx5IHVzZWQgdG8gdGhlIHNldCB0aGUgaW5pdGlhbFxuLy8gdmFsdWUuIFNpbWlsYXIgZm9yIHRoZSBcImNoZWNrZWRcIiBhdHRyaWJ1dGUsIGFuZCBcImRpc2FibGVkXCIuXG5mdW5jdGlvbiB1cGRhdGVJbnB1dCAobmV3Tm9kZSwgb2xkTm9kZSkge1xuICB2YXIgbmV3VmFsdWUgPSBuZXdOb2RlLnZhbHVlXG4gIHZhciBvbGRWYWx1ZSA9IG9sZE5vZGUudmFsdWVcblxuICB1cGRhdGVBdHRyaWJ1dGUobmV3Tm9kZSwgb2xkTm9kZSwgJ2NoZWNrZWQnKVxuICB1cGRhdGVBdHRyaWJ1dGUobmV3Tm9kZSwgb2xkTm9kZSwgJ2Rpc2FibGVkJylcblxuICAvLyBUaGUgXCJpbmRldGVybWluYXRlXCIgcHJvcGVydHkgY2FuIG5vdCBiZSBzZXQgdXNpbmcgYW4gSFRNTCBhdHRyaWJ1dGUuXG4gIC8vIFNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9IVE1ML0VsZW1lbnQvaW5wdXQvY2hlY2tib3hcbiAgaWYgKG5ld05vZGUuaW5kZXRlcm1pbmF0ZSAhPT0gb2xkTm9kZS5pbmRldGVybWluYXRlKSB7XG4gICAgb2xkTm9kZS5pbmRldGVybWluYXRlID0gbmV3Tm9kZS5pbmRldGVybWluYXRlXG4gIH1cblxuICAvLyBQZXJzaXN0IGZpbGUgdmFsdWUgc2luY2UgZmlsZSBpbnB1dHMgY2FuJ3QgYmUgY2hhbmdlZCBwcm9ncmFtYXRpY2FsbHlcbiAgaWYgKG9sZE5vZGUudHlwZSA9PT0gJ2ZpbGUnKSByZXR1cm5cblxuICBpZiAobmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XG4gICAgb2xkTm9kZS5zZXRBdHRyaWJ1dGUoJ3ZhbHVlJywgbmV3VmFsdWUpXG4gICAgb2xkTm9kZS52YWx1ZSA9IG5ld1ZhbHVlXG4gIH1cblxuICBpZiAobmV3VmFsdWUgPT09ICdudWxsJykge1xuICAgIG9sZE5vZGUudmFsdWUgPSAnJ1xuICAgIG9sZE5vZGUucmVtb3ZlQXR0cmlidXRlKCd2YWx1ZScpXG4gIH1cblxuICBpZiAoIW5ld05vZGUuaGFzQXR0cmlidXRlTlMobnVsbCwgJ3ZhbHVlJykpIHtcbiAgICBvbGROb2RlLnJlbW92ZUF0dHJpYnV0ZSgndmFsdWUnKVxuICB9IGVsc2UgaWYgKG9sZE5vZGUudHlwZSA9PT0gJ3JhbmdlJykge1xuICAgIC8vIHRoaXMgaXMgc28gZWxlbWVudHMgbGlrZSBzbGlkZXIgbW92ZSB0aGVpciBVSSB0aGluZ3lcbiAgICBvbGROb2RlLnZhbHVlID0gbmV3VmFsdWVcbiAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGVUZXh0YXJlYSAobmV3Tm9kZSwgb2xkTm9kZSkge1xuICB2YXIgbmV3VmFsdWUgPSBuZXdOb2RlLnZhbHVlXG4gIGlmIChuZXdWYWx1ZSAhPT0gb2xkTm9kZS52YWx1ZSkge1xuICAgIG9sZE5vZGUudmFsdWUgPSBuZXdWYWx1ZVxuICB9XG5cbiAgaWYgKG9sZE5vZGUuZmlyc3RDaGlsZCAmJiBvbGROb2RlLmZpcnN0Q2hpbGQubm9kZVZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgIC8vIE5lZWRlZCBmb3IgSUUuIEFwcGFyZW50bHkgSUUgc2V0cyB0aGUgcGxhY2Vob2xkZXIgYXMgdGhlXG4gICAgLy8gbm9kZSB2YWx1ZSBhbmQgdmlzZSB2ZXJzYS4gVGhpcyBpZ25vcmVzIGFuIGVtcHR5IHVwZGF0ZS5cbiAgICBpZiAobmV3VmFsdWUgPT09ICcnICYmIG9sZE5vZGUuZmlyc3RDaGlsZC5ub2RlVmFsdWUgPT09IG9sZE5vZGUucGxhY2Vob2xkZXIpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIG9sZE5vZGUuZmlyc3RDaGlsZC5ub2RlVmFsdWUgPSBuZXdWYWx1ZVxuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHJpYnV0ZSAobmV3Tm9kZSwgb2xkTm9kZSwgbmFtZSkge1xuICBpZiAobmV3Tm9kZVtuYW1lXSAhPT0gb2xkTm9kZVtuYW1lXSkge1xuICAgIG9sZE5vZGVbbmFtZV0gPSBuZXdOb2RlW25hbWVdXG4gICAgaWYgKG5ld05vZGVbbmFtZV0pIHtcbiAgICAgIG9sZE5vZGUuc2V0QXR0cmlidXRlKG5hbWUsICcnKVxuICAgIH0gZWxzZSB7XG4gICAgICBvbGROb2RlLnJlbW92ZUF0dHJpYnV0ZShuYW1lKVxuICAgIH1cbiAgfVxufVxuIiwidmFyIHJlZyA9IC8oW14/PSZdKykoPShbXiZdKikpPy9nXG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcblxubW9kdWxlLmV4cG9ydHMgPSBxc1xuXG5mdW5jdGlvbiBxcyAodXJsKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgdXJsLCAnc3RyaW5nJywgJ25hbm9xdWVyeTogdXJsIHNob3VsZCBiZSB0eXBlIHN0cmluZycpXG5cbiAgdmFyIG9iaiA9IHt9XG4gIHVybC5yZXBsYWNlKC9eLipcXD8vLCAnJykucmVwbGFjZShyZWcsIGZ1bmN0aW9uIChhMCwgYTEsIGEyLCBhMykge1xuICAgIHZhciB2YWx1ZSA9IGRlY29kZVVSSUNvbXBvbmVudChhMylcbiAgICB2YXIga2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGExKVxuICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqW2tleV0pKSBvYmpba2V5XS5wdXNoKHZhbHVlKVxuICAgICAgZWxzZSBvYmpba2V5XSA9IFtvYmpba2V5XSwgdmFsdWVdXG4gICAgfSBlbHNlIHtcbiAgICAgIG9ialtrZXldID0gdmFsdWVcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIG9ialxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5hbm9yYWZcblxuLy8gT25seSBjYWxsIFJBRiB3aGVuIG5lZWRlZFxuLy8gKGZuLCBmbj8pIC0+IGZuXG5mdW5jdGlvbiBuYW5vcmFmIChyZW5kZXIsIHJhZikge1xuICBhc3NlcnQuZXF1YWwodHlwZW9mIHJlbmRlciwgJ2Z1bmN0aW9uJywgJ25hbm9yYWY6IHJlbmRlciBzaG91bGQgYmUgYSBmdW5jdGlvbicpXG4gIGFzc2VydC5vayh0eXBlb2YgcmFmID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiByYWYgPT09ICd1bmRlZmluZWQnLCAnbmFub3JhZjogcmFmIHNob3VsZCBiZSBhIGZ1bmN0aW9uIG9yIHVuZGVmaW5lZCcpXG5cbiAgaWYgKCFyYWYpIHJhZiA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVcbiAgdmFyIHJlZHJhd1NjaGVkdWxlZCA9IGZhbHNlXG4gIHZhciBhcmdzID0gbnVsbFxuXG4gIHJldHVybiBmdW5jdGlvbiBmcmFtZSAoKSB7XG4gICAgaWYgKGFyZ3MgPT09IG51bGwgJiYgIXJlZHJhd1NjaGVkdWxlZCkge1xuICAgICAgcmVkcmF3U2NoZWR1bGVkID0gdHJ1ZVxuXG4gICAgICByYWYoZnVuY3Rpb24gcmVkcmF3ICgpIHtcbiAgICAgICAgcmVkcmF3U2NoZWR1bGVkID0gZmFsc2VcblxuICAgICAgICB2YXIgbGVuZ3RoID0gYXJncy5sZW5ndGhcbiAgICAgICAgdmFyIF9hcmdzID0gbmV3IEFycmF5KGxlbmd0aClcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykgX2FyZ3NbaV0gPSBhcmdzW2ldXG5cbiAgICAgICAgcmVuZGVyLmFwcGx5KHJlbmRlciwgX2FyZ3MpXG4gICAgICAgIGFyZ3MgPSBudWxsXG4gICAgICB9KVxuICAgIH1cblxuICAgIGFyZ3MgPSBhcmd1bWVudHNcbiAgfVxufVxuIiwidmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG52YXIgd2F5ZmFyZXIgPSByZXF1aXJlKCd3YXlmYXJlcicpXG5cbi8vIGVsZWN0cm9uIHN1cHBvcnRcbnZhciBpc0xvY2FsRmlsZSA9ICgvZmlsZTpcXC9cXC8vLnRlc3QoXG4gIHR5cGVvZiB3aW5kb3cgPT09ICdvYmplY3QnICYmXG4gIHdpbmRvdy5sb2NhdGlvbiAmJlxuICB3aW5kb3cubG9jYXRpb24ub3JpZ2luXG4pKVxuXG4vKiBlc2xpbnQtZGlzYWJsZSBuby11c2VsZXNzLWVzY2FwZSAqL1xudmFyIGVsZWN0cm9uID0gJ14oZmlsZTpcXC9cXC98XFwvKSguKlxcLmh0bWw/XFwvPyk/J1xudmFyIHByb3RvY29sID0gJ14oaHR0cChzKT8oOlxcL1xcLykpPyh3d3dcXC4pPydcbnZhciBkb21haW4gPSAnW2EtekEtWjAtOS1fXFwuXSsoOlswLTldezEsNX0pPyhcXC97MX0pPydcbnZhciBxcyA9ICdbXFw/XS4qJCdcbi8qIGVzbGludC1lbmFibGUgbm8tdXNlbGVzcy1lc2NhcGUgKi9cblxudmFyIHN0cmlwRWxlY3Ryb24gPSBuZXcgUmVnRXhwKGVsZWN0cm9uKVxudmFyIHByZWZpeCA9IG5ldyBSZWdFeHAocHJvdG9jb2wgKyBkb21haW4pXG52YXIgbm9ybWFsaXplID0gbmV3IFJlZ0V4cCgnIycpXG52YXIgc3VmZml4ID0gbmV3IFJlZ0V4cChxcylcblxubW9kdWxlLmV4cG9ydHMgPSBOYW5vcm91dGVyXG5cbmZ1bmN0aW9uIE5hbm9yb3V0ZXIgKG9wdHMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE5hbm9yb3V0ZXIpKSByZXR1cm4gbmV3IE5hbm9yb3V0ZXIob3B0cylcbiAgb3B0cyA9IG9wdHMgfHwge31cbiAgdGhpcy5yb3V0ZXIgPSB3YXlmYXJlcihvcHRzLmRlZmF1bHQgfHwgJy80MDQnKVxufVxuXG5OYW5vcm91dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uIChyb3V0ZW5hbWUsIGxpc3RlbmVyKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2Ygcm91dGVuYW1lLCAnc3RyaW5nJylcbiAgcm91dGVuYW1lID0gcm91dGVuYW1lLnJlcGxhY2UoL15bIy9dLywgJycpXG4gIHRoaXMucm91dGVyLm9uKHJvdXRlbmFtZSwgbGlzdGVuZXIpXG59XG5cbk5hbm9yb3V0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiAocm91dGVuYW1lKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2Ygcm91dGVuYW1lLCAnc3RyaW5nJylcbiAgcm91dGVuYW1lID0gcGF0aG5hbWUocm91dGVuYW1lLCBpc0xvY2FsRmlsZSlcbiAgcmV0dXJuIHRoaXMucm91dGVyLmVtaXQocm91dGVuYW1lKVxufVxuXG5OYW5vcm91dGVyLnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uIChyb3V0ZW5hbWUpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb3V0ZW5hbWUsICdzdHJpbmcnKVxuICByb3V0ZW5hbWUgPSBwYXRobmFtZShyb3V0ZW5hbWUsIGlzTG9jYWxGaWxlKVxuICByZXR1cm4gdGhpcy5yb3V0ZXIubWF0Y2gocm91dGVuYW1lKVxufVxuXG4vLyByZXBsYWNlIGV2ZXJ5dGhpbmcgaW4gYSByb3V0ZSBidXQgdGhlIHBhdGhuYW1lIGFuZCBoYXNoXG5mdW5jdGlvbiBwYXRobmFtZSAocm91dGVuYW1lLCBpc0VsZWN0cm9uKSB7XG4gIGlmIChpc0VsZWN0cm9uKSByb3V0ZW5hbWUgPSByb3V0ZW5hbWUucmVwbGFjZShzdHJpcEVsZWN0cm9uLCAnJylcbiAgZWxzZSByb3V0ZW5hbWUgPSByb3V0ZW5hbWUucmVwbGFjZShwcmVmaXgsICcnKVxuICByZXR1cm4gZGVjb2RlVVJJKHJvdXRlbmFtZS5yZXBsYWNlKHN1ZmZpeCwgJycpLnJlcGxhY2Uobm9ybWFsaXplLCAnLycpKVxufVxuIiwidmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG5cbnZhciBoYXNXaW5kb3cgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuXG5mdW5jdGlvbiBjcmVhdGVTY2hlZHVsZXIgKCkge1xuICB2YXIgc2NoZWR1bGVyXG4gIGlmIChoYXNXaW5kb3cpIHtcbiAgICBpZiAoIXdpbmRvdy5fbmFub1NjaGVkdWxlcikgd2luZG93Ll9uYW5vU2NoZWR1bGVyID0gbmV3IE5hbm9TY2hlZHVsZXIodHJ1ZSlcbiAgICBzY2hlZHVsZXIgPSB3aW5kb3cuX25hbm9TY2hlZHVsZXJcbiAgfSBlbHNlIHtcbiAgICBzY2hlZHVsZXIgPSBuZXcgTmFub1NjaGVkdWxlcigpXG4gIH1cbiAgcmV0dXJuIHNjaGVkdWxlclxufVxuXG5mdW5jdGlvbiBOYW5vU2NoZWR1bGVyIChoYXNXaW5kb3cpIHtcbiAgdGhpcy5oYXNXaW5kb3cgPSBoYXNXaW5kb3dcbiAgdGhpcy5oYXNJZGxlID0gdGhpcy5oYXNXaW5kb3cgJiYgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tcbiAgdGhpcy5tZXRob2QgPSB0aGlzLmhhc0lkbGUgPyB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFjay5iaW5kKHdpbmRvdykgOiB0aGlzLnNldFRpbWVvdXRcbiAgdGhpcy5zY2hlZHVsZWQgPSBmYWxzZVxuICB0aGlzLnF1ZXVlID0gW11cbn1cblxuTmFub1NjaGVkdWxlci5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjYikge1xuICBhc3NlcnQuZXF1YWwodHlwZW9mIGNiLCAnZnVuY3Rpb24nLCAnbmFub3NjaGVkdWxlci5wdXNoOiBjYiBzaG91bGQgYmUgdHlwZSBmdW5jdGlvbicpXG5cbiAgdGhpcy5xdWV1ZS5wdXNoKGNiKVxuICB0aGlzLnNjaGVkdWxlKClcbn1cblxuTmFub1NjaGVkdWxlci5wcm90b3R5cGUuc2NoZWR1bGUgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLnNjaGVkdWxlZCkgcmV0dXJuXG5cbiAgdGhpcy5zY2hlZHVsZWQgPSB0cnVlXG4gIHZhciBzZWxmID0gdGhpc1xuICB0aGlzLm1ldGhvZChmdW5jdGlvbiAoaWRsZURlYWRsaW5lKSB7XG4gICAgdmFyIGNiXG4gICAgd2hpbGUgKHNlbGYucXVldWUubGVuZ3RoICYmIGlkbGVEZWFkbGluZS50aW1lUmVtYWluaW5nKCkgPiAwKSB7XG4gICAgICBjYiA9IHNlbGYucXVldWUuc2hpZnQoKVxuICAgICAgY2IoaWRsZURlYWRsaW5lKVxuICAgIH1cbiAgICBzZWxmLnNjaGVkdWxlZCA9IGZhbHNlXG4gICAgaWYgKHNlbGYucXVldWUubGVuZ3RoKSBzZWxmLnNjaGVkdWxlKClcbiAgfSlcbn1cblxuTmFub1NjaGVkdWxlci5wcm90b3R5cGUuc2V0VGltZW91dCA9IGZ1bmN0aW9uIChjYikge1xuICBzZXRUaW1lb3V0KGNiLCAwLCB7XG4gICAgdGltZVJlbWFpbmluZzogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIDFcbiAgICB9XG4gIH0pXG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlU2NoZWR1bGVyXG4iLCJ2YXIgc2NoZWR1bGVyID0gcmVxdWlyZSgnbmFub3NjaGVkdWxlcicpKClcbnZhciBhc3NlcnQgPSByZXF1aXJlKCdhc3NlcnQnKVxuXG52YXIgcGVyZlxubmFub3RpbWluZy5kaXNhYmxlZCA9IHRydWVcbnRyeSB7XG4gIHBlcmYgPSB3aW5kb3cucGVyZm9ybWFuY2VcbiAgbmFub3RpbWluZy5kaXNhYmxlZCA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuRElTQUJMRV9OQU5PVElNSU5HID09PSAndHJ1ZScgfHwgIXBlcmYubWFya1xufSBjYXRjaCAoZSkgeyB9XG5cbm1vZHVsZS5leHBvcnRzID0gbmFub3RpbWluZ1xuXG5mdW5jdGlvbiBuYW5vdGltaW5nIChuYW1lKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2YgbmFtZSwgJ3N0cmluZycsICduYW5vdGltaW5nOiBuYW1lIHNob3VsZCBiZSB0eXBlIHN0cmluZycpXG5cbiAgaWYgKG5hbm90aW1pbmcuZGlzYWJsZWQpIHJldHVybiBub29wXG5cbiAgdmFyIHV1aWQgPSAocGVyZi5ub3coKSAqIDEwMDAwKS50b0ZpeGVkKCkgJSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUlxuICB2YXIgc3RhcnROYW1lID0gJ3N0YXJ0LScgKyB1dWlkICsgJy0nICsgbmFtZVxuICBwZXJmLm1hcmsoc3RhcnROYW1lKVxuXG4gIGZ1bmN0aW9uIGVuZCAoY2IpIHtcbiAgICB2YXIgZW5kTmFtZSA9ICdlbmQtJyArIHV1aWQgKyAnLScgKyBuYW1lXG4gICAgcGVyZi5tYXJrKGVuZE5hbWUpXG5cbiAgICBzY2hlZHVsZXIucHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgZXJyID0gbnVsbFxuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIG1lYXN1cmVOYW1lID0gbmFtZSArICcgWycgKyB1dWlkICsgJ10nXG4gICAgICAgIHBlcmYubWVhc3VyZShtZWFzdXJlTmFtZSwgc3RhcnROYW1lLCBlbmROYW1lKVxuICAgICAgICBwZXJmLmNsZWFyTWFya3Moc3RhcnROYW1lKVxuICAgICAgICBwZXJmLmNsZWFyTWFya3MoZW5kTmFtZSlcbiAgICAgIH0gY2F0Y2ggKGUpIHsgZXJyID0gZSB9XG4gICAgICBpZiAoY2IpIGNiKGVyciwgbmFtZSlcbiAgICB9KVxuICB9XG5cbiAgZW5kLnV1aWQgPSB1dWlkXG4gIHJldHVybiBlbmRcbn1cblxuZnVuY3Rpb24gbm9vcCAoY2IpIHtcbiAgaWYgKGNiKSB7XG4gICAgc2NoZWR1bGVyLnB1c2goZnVuY3Rpb24gKCkge1xuICAgICAgY2IobmV3IEVycm9yKCduYW5vdGltaW5nOiBwZXJmb3JtYW5jZSBBUEkgdW5hdmFpbGFibGUnKSlcbiAgICB9KVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxuLyoqXG4gKiBSZW1vdmUgYSByYW5nZSBvZiBpdGVtcyBmcm9tIGFuIGFycmF5XG4gKlxuICogQGZ1bmN0aW9uIHJlbW92ZUl0ZW1zXG4gKiBAcGFyYW0ge0FycmF5PCo+fSBhcnIgVGhlIHRhcmdldCBhcnJheVxuICogQHBhcmFtIHtudW1iZXJ9IHN0YXJ0SWR4IFRoZSBpbmRleCB0byBiZWdpbiByZW1vdmluZyBmcm9tIChpbmNsdXNpdmUpXG4gKiBAcGFyYW0ge251bWJlcn0gcmVtb3ZlQ291bnQgSG93IG1hbnkgaXRlbXMgdG8gcmVtb3ZlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcmVtb3ZlSXRlbXMgKGFyciwgc3RhcnRJZHgsIHJlbW92ZUNvdW50KSB7XG4gIHZhciBpLCBsZW5ndGggPSBhcnIubGVuZ3RoXG5cbiAgaWYgKHN0YXJ0SWR4ID49IGxlbmd0aCB8fCByZW1vdmVDb3VudCA9PT0gMCkge1xuICAgIHJldHVyblxuICB9XG5cbiAgcmVtb3ZlQ291bnQgPSAoc3RhcnRJZHggKyByZW1vdmVDb3VudCA+IGxlbmd0aCA/IGxlbmd0aCAtIHN0YXJ0SWR4IDogcmVtb3ZlQ291bnQpXG5cbiAgdmFyIGxlbiA9IGxlbmd0aCAtIHJlbW92ZUNvdW50XG5cbiAgZm9yIChpID0gc3RhcnRJZHg7IGkgPCBsZW47ICsraSkge1xuICAgIGFycltpXSA9IGFycltpICsgcmVtb3ZlQ291bnRdXG4gIH1cblxuICBhcnIubGVuZ3RoID0gbGVuXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHNjcm9sbFRvQW5jaG9yXG5cbmZ1bmN0aW9uIHNjcm9sbFRvQW5jaG9yIChhbmNob3IsIG9wdGlvbnMpIHtcbiAgaWYgKGFuY2hvcikge1xuICAgIHRyeSB7XG4gICAgICB2YXIgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFuY2hvcilcbiAgICAgIGlmIChlbCkgZWwuc2Nyb2xsSW50b1ZpZXcob3B0aW9ucylcbiAgICB9IGNhdGNoIChlKSB7fVxuICB9XG59XG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBub2RlL25vLWRlcHJlY2F0ZWQtYXBpICovXG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcbnZhciB0cmllID0gcmVxdWlyZSgnLi90cmllJylcblxubW9kdWxlLmV4cG9ydHMgPSBXYXlmYXJlclxuXG4vLyBjcmVhdGUgYSByb3V0ZXJcbi8vIHN0ciAtPiBvYmpcbmZ1bmN0aW9uIFdheWZhcmVyIChkZnQpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFdheWZhcmVyKSkgcmV0dXJuIG5ldyBXYXlmYXJlcihkZnQpXG5cbiAgdmFyIF9kZWZhdWx0ID0gKGRmdCB8fCAnJykucmVwbGFjZSgvXlxcLy8sICcnKVxuICB2YXIgX3RyaWUgPSB0cmllKClcblxuICBlbWl0Ll90cmllID0gX3RyaWVcbiAgZW1pdC5vbiA9IG9uXG4gIGVtaXQuZW1pdCA9IGVtaXRcbiAgZW1pdC5tYXRjaCA9IG1hdGNoXG4gIGVtaXQuX3dheWZhcmVyID0gdHJ1ZVxuXG4gIHJldHVybiBlbWl0XG5cbiAgLy8gZGVmaW5lIGEgcm91dGVcbiAgLy8gKHN0ciwgZm4pIC0+IG9ialxuICBmdW5jdGlvbiBvbiAocm91dGUsIGNiKSB7XG4gICAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb3V0ZSwgJ3N0cmluZycpXG4gICAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBjYiwgJ2Z1bmN0aW9uJylcblxuICAgIHJvdXRlID0gcm91dGUgfHwgJy8nXG5cbiAgICBpZiAoY2IuX3dheWZhcmVyICYmIGNiLl90cmllKSB7XG4gICAgICBfdHJpZS5tb3VudChyb3V0ZSwgY2IuX3RyaWUudHJpZSlcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG5vZGUgPSBfdHJpZS5jcmVhdGUocm91dGUpXG4gICAgICBub2RlLmNiID0gY2JcbiAgICAgIG5vZGUucm91dGUgPSByb3V0ZVxuICAgIH1cblxuICAgIHJldHVybiBlbWl0XG4gIH1cblxuICAvLyBtYXRjaCBhbmQgY2FsbCBhIHJvdXRlXG4gIC8vIChzdHIsIG9iaj8pIC0+IG51bGxcbiAgZnVuY3Rpb24gZW1pdCAocm91dGUpIHtcbiAgICB2YXIgbWF0Y2hlZCA9IG1hdGNoKHJvdXRlKVxuXG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aClcbiAgICBhcmdzWzBdID0gbWF0Y2hlZC5wYXJhbXNcbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV1cbiAgICB9XG5cbiAgICByZXR1cm4gbWF0Y2hlZC5jYi5hcHBseShtYXRjaGVkLmNiLCBhcmdzKVxuICB9XG5cbiAgZnVuY3Rpb24gbWF0Y2ggKHJvdXRlKSB7XG4gICAgYXNzZXJ0Lm5vdEVxdWFsKHJvdXRlLCB1bmRlZmluZWQsIFwiJ3JvdXRlJyBtdXN0IGJlIGRlZmluZWRcIilcblxuICAgIHZhciBtYXRjaGVkID0gX3RyaWUubWF0Y2gocm91dGUpXG4gICAgaWYgKG1hdGNoZWQgJiYgbWF0Y2hlZC5jYikgcmV0dXJuIG5ldyBSb3V0ZShtYXRjaGVkKVxuXG4gICAgdmFyIGRmdCA9IF90cmllLm1hdGNoKF9kZWZhdWx0KVxuICAgIGlmIChkZnQgJiYgZGZ0LmNiKSByZXR1cm4gbmV3IFJvdXRlKGRmdClcblxuICAgIHRocm93IG5ldyBFcnJvcihcInJvdXRlICdcIiArIHJvdXRlICsgXCInIGRpZCBub3QgbWF0Y2hcIilcbiAgfVxuXG4gIGZ1bmN0aW9uIFJvdXRlIChtYXRjaGVkKSB7XG4gICAgdGhpcy5jYiA9IG1hdGNoZWQuY2JcbiAgICB0aGlzLnJvdXRlID0gbWF0Y2hlZC5yb3V0ZVxuICAgIHRoaXMucGFyYW1zID0gbWF0Y2hlZC5wYXJhbXNcbiAgfVxufVxuIiwiLyogZXNsaW50LWRpc2FibGUgbm9kZS9uby1kZXByZWNhdGVkLWFwaSAqL1xudmFyIGFzc2VydCA9IHJlcXVpcmUoJ2Fzc2VydCcpXG5cbm1vZHVsZS5leHBvcnRzID0gVHJpZVxuXG4vLyBjcmVhdGUgYSBuZXcgdHJpZVxuLy8gbnVsbCAtPiBvYmpcbmZ1bmN0aW9uIFRyaWUgKCkge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgVHJpZSkpIHJldHVybiBuZXcgVHJpZSgpXG4gIHRoaXMudHJpZSA9IHsgbm9kZXM6IHt9IH1cbn1cblxuLy8gY3JlYXRlIGEgbm9kZSBvbiB0aGUgdHJpZSBhdCByb3V0ZVxuLy8gYW5kIHJldHVybiBhIG5vZGVcbi8vIHN0ciAtPiBvYmpcblRyaWUucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIChyb3V0ZSkge1xuICBhc3NlcnQuZXF1YWwodHlwZW9mIHJvdXRlLCAnc3RyaW5nJywgJ3JvdXRlIHNob3VsZCBiZSBhIHN0cmluZycpXG4gIC8vIHN0cmlwIGxlYWRpbmcgJy8nIGFuZCBzcGxpdCByb3V0ZXNcbiAgdmFyIHJvdXRlcyA9IHJvdXRlLnJlcGxhY2UoL15cXC8vLCAnJykuc3BsaXQoJy8nKVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZU5vZGUgKGluZGV4LCB0cmllKSB7XG4gICAgdmFyIHRoaXNSb3V0ZSA9IChoYXMocm91dGVzLCBpbmRleCkgJiYgcm91dGVzW2luZGV4XSlcbiAgICBpZiAodGhpc1JvdXRlID09PSBmYWxzZSkgcmV0dXJuIHRyaWVcblxuICAgIHZhciBub2RlID0gbnVsbFxuICAgIGlmICgvXjp8XlxcKi8udGVzdCh0aGlzUm91dGUpKSB7XG4gICAgICAvLyBpZiBub2RlIGlzIGEgbmFtZSBtYXRjaCwgc2V0IG5hbWUgYW5kIGFwcGVuZCB0byAnOicgbm9kZVxuICAgICAgaWYgKCFoYXModHJpZS5ub2RlcywgJyQkJykpIHtcbiAgICAgICAgbm9kZSA9IHsgbm9kZXM6IHt9IH1cbiAgICAgICAgdHJpZS5ub2Rlcy4kJCA9IG5vZGVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUgPSB0cmllLm5vZGVzLiQkXG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzUm91dGVbMF0gPT09ICcqJykge1xuICAgICAgICB0cmllLndpbGRjYXJkID0gdHJ1ZVxuICAgICAgfVxuXG4gICAgICB0cmllLm5hbWUgPSB0aGlzUm91dGUucmVwbGFjZSgvXjp8XlxcKi8sICcnKVxuICAgIH0gZWxzZSBpZiAoIWhhcyh0cmllLm5vZGVzLCB0aGlzUm91dGUpKSB7XG4gICAgICBub2RlID0geyBub2Rlczoge30gfVxuICAgICAgdHJpZS5ub2Rlc1t0aGlzUm91dGVdID0gbm9kZVxuICAgIH0gZWxzZSB7XG4gICAgICBub2RlID0gdHJpZS5ub2Rlc1t0aGlzUm91dGVdXG4gICAgfVxuXG4gICAgLy8gd2UgbXVzdCByZWN1cnNlIGRlZXBlclxuICAgIHJldHVybiBjcmVhdGVOb2RlKGluZGV4ICsgMSwgbm9kZSlcbiAgfVxuXG4gIHJldHVybiBjcmVhdGVOb2RlKDAsIHRoaXMudHJpZSlcbn1cblxuLy8gbWF0Y2ggYSByb3V0ZSBvbiB0aGUgdHJpZVxuLy8gYW5kIHJldHVybiB0aGUgbm9kZVxuLy8gc3RyIC0+IG9ialxuVHJpZS5wcm90b3R5cGUubWF0Y2ggPSBmdW5jdGlvbiAocm91dGUpIHtcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiByb3V0ZSwgJ3N0cmluZycsICdyb3V0ZSBzaG91bGQgYmUgYSBzdHJpbmcnKVxuXG4gIHZhciByb3V0ZXMgPSByb3V0ZS5yZXBsYWNlKC9eXFwvLywgJycpLnNwbGl0KCcvJylcbiAgdmFyIHBhcmFtcyA9IHt9XG5cbiAgZnVuY3Rpb24gc2VhcmNoIChpbmRleCwgdHJpZSkge1xuICAgIC8vIGVpdGhlciB0aGVyZSdzIG5vIG1hdGNoLCBvciB3ZSdyZSBkb25lIHNlYXJjaGluZ1xuICAgIGlmICh0cmllID09PSB1bmRlZmluZWQpIHJldHVybiB1bmRlZmluZWRcbiAgICB2YXIgdGhpc1JvdXRlID0gcm91dGVzW2luZGV4XVxuICAgIGlmICh0aGlzUm91dGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHRyaWVcblxuICAgIGlmIChoYXModHJpZS5ub2RlcywgdGhpc1JvdXRlKSkge1xuICAgICAgLy8gbWF0Y2ggcmVndWxhciByb3V0ZXMgZmlyc3RcbiAgICAgIHJldHVybiBzZWFyY2goaW5kZXggKyAxLCB0cmllLm5vZGVzW3RoaXNSb3V0ZV0pXG4gICAgfSBlbHNlIGlmICh0cmllLm5hbWUpIHtcbiAgICAgIC8vIG1hdGNoIG5hbWVkIHJvdXRlc1xuICAgICAgdHJ5IHtcbiAgICAgICAgcGFyYW1zW3RyaWUubmFtZV0gPSBkZWNvZGVVUklDb21wb25lbnQodGhpc1JvdXRlKVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gc2VhcmNoKGluZGV4LCB1bmRlZmluZWQpXG4gICAgICB9XG4gICAgICByZXR1cm4gc2VhcmNoKGluZGV4ICsgMSwgdHJpZS5ub2Rlcy4kJClcbiAgICB9IGVsc2UgaWYgKHRyaWUud2lsZGNhcmQpIHtcbiAgICAgIC8vIG1hdGNoIHdpbGRjYXJkc1xuICAgICAgdHJ5IHtcbiAgICAgICAgcGFyYW1zLndpbGRjYXJkID0gZGVjb2RlVVJJQ29tcG9uZW50KHJvdXRlcy5zbGljZShpbmRleCkuam9pbignLycpKVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gc2VhcmNoKGluZGV4LCB1bmRlZmluZWQpXG4gICAgICB9XG4gICAgICAvLyByZXR1cm4gZWFybHksIG9yIGVsc2Ugc2VhcmNoIG1heSBrZWVwIHJlY3Vyc2luZyB0aHJvdWdoIHRoZSB3aWxkY2FyZFxuICAgICAgcmV0dXJuIHRyaWUubm9kZXMuJCRcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbm8gbWF0Y2hlcyBmb3VuZFxuICAgICAgcmV0dXJuIHNlYXJjaChpbmRleCArIDEpXG4gICAgfVxuICB9XG5cbiAgdmFyIG5vZGUgPSBzZWFyY2goMCwgdGhpcy50cmllKVxuXG4gIGlmICghbm9kZSkgcmV0dXJuIHVuZGVmaW5lZFxuICBub2RlID0gT2JqZWN0LmFzc2lnbih7fSwgbm9kZSlcbiAgbm9kZS5wYXJhbXMgPSBwYXJhbXNcbiAgcmV0dXJuIG5vZGVcbn1cblxuLy8gbW91bnQgYSB0cmllIG9udG8gYSBub2RlIGF0IHJvdXRlXG4vLyAoc3RyLCBvYmopIC0+IG51bGxcblRyaWUucHJvdG90eXBlLm1vdW50ID0gZnVuY3Rpb24gKHJvdXRlLCB0cmllKSB7XG4gIGFzc2VydC5lcXVhbCh0eXBlb2Ygcm91dGUsICdzdHJpbmcnLCAncm91dGUgc2hvdWxkIGJlIGEgc3RyaW5nJylcbiAgYXNzZXJ0LmVxdWFsKHR5cGVvZiB0cmllLCAnb2JqZWN0JywgJ3RyaWUgc2hvdWxkIGJlIGEgb2JqZWN0JylcblxuICB2YXIgc3BsaXQgPSByb3V0ZS5yZXBsYWNlKC9eXFwvLywgJycpLnNwbGl0KCcvJylcbiAgdmFyIG5vZGUgPSBudWxsXG4gIHZhciBrZXkgPSBudWxsXG5cbiAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgIGtleSA9IHNwbGl0WzBdXG4gICAgbm9kZSA9IHRoaXMuY3JlYXRlKGtleSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgaGVhZCA9IHNwbGl0LmpvaW4oJy8nKVxuICAgIGtleSA9IHNwbGl0WzBdXG4gICAgbm9kZSA9IHRoaXMuY3JlYXRlKGhlYWQpXG4gIH1cblxuICBPYmplY3QuYXNzaWduKG5vZGUubm9kZXMsIHRyaWUubm9kZXMpXG4gIGlmICh0cmllLm5hbWUpIG5vZGUubmFtZSA9IHRyaWUubmFtZVxuXG4gIC8vIGRlbGVnYXRlIHByb3BlcnRpZXMgZnJvbSAnLycgdG8gdGhlIG5ldyBub2RlXG4gIC8vICcvJyBjYW5ub3QgYmUgcmVhY2hlZCBvbmNlIG1vdW50ZWRcbiAgaWYgKG5vZGUubm9kZXNbJyddKSB7XG4gICAgT2JqZWN0LmtleXMobm9kZS5ub2Rlc1snJ10pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgaWYgKGtleSA9PT0gJ25vZGVzJykgcmV0dXJuXG4gICAgICBub2RlW2tleV0gPSBub2RlLm5vZGVzWycnXVtrZXldXG4gICAgfSlcbiAgICBPYmplY3QuYXNzaWduKG5vZGUubm9kZXMsIG5vZGUubm9kZXNbJyddLm5vZGVzKVxuICAgIGRlbGV0ZSBub2RlLm5vZGVzWycnXS5ub2Rlc1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhcyAob2JqZWN0LCBwcm9wZXJ0eSkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHkpXG59XG4iLCJjb25zdCBodG1sID0gcmVxdWlyZSgnY2hvby9odG1sJylcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzdGF0ZSwgYXBwKXtcblxuXG5yZXR1cm4gaHRtbGBcbiAgPGRpdiBpZD1cImFwcFwiIGNsYXNzPVwiam9pbiBjb2xDZW50ZXJcIj5cbiAgICA8aDEgY2xhc3M9dGl0bGU+XG4gICAgICBHYWJyXG4gICAgPC9oMT5cbiAgICA8aDIgY2xhc3M9XCJtb25vZ3JhcGggdWxcIj5cbiAgICAgIFBvZGNhc3QgbGl2ZS1zdHJlYW1pbmcsIHJlY29yZGluZywgYW5kIDxiciAvPnJlYWwtdGltZSB0YWxrIHdpdGggbGlzdGVuZXIgY2FsbC1pbi5cbiAgICA8L2gyPlxuICAgIDxhIGhyZWY9LyBjbGFzcz1kZW1vPkRlbW8gQ29taW5nIFNvb248L2E+XG4gICAgPGRpdiBjbGFzcz1cImZlYXR1cmVzIGZsZXhDb2wgY29sQ2VudGVyXCI+XG4gICAgICA8aDM+XG4gICAgICAgIEZlYXR1cmVzIGFuZCBJZGVhc1xuICAgICAgPC9oMz5cbiAgICAgIDx1bCBjbGFzcz1cImZsZXhDb2xcIj5cbiAgICAgICAgPGxpPkxpdmUtU3RyZWFtIGFuZCBSZWNvcmQgQXVkaW8gUG9kY2FzdHM8L2xpPlxuICAgICAgICA8bGk+SG9zdCBMaXN0ZW5lciBDYWxsLUlucywgVGFsayBTaG93cywgUHJlc2VudGF0aW9uczwvbGk+XG4gICAgICAgIDxsaT5BY2NlcHQgcGF5bWVudHMgYW5kIERvbmF0aW9uczwvbGk+XG4gICAgICAgIDxsaT5DaGFyZ2UgZm9yIFN1YnNjcmlwdGlvbnMsIE1lbWJlcnNoaXAsIG9yIENhbGwtaW5zPC9saT5cbiAgICAgICAgPGxpPlB1YmxpYyBvciBQcml2YXRlIFN0cmVhbXM8L2xpPlxuICAgICAgICA8bGk+SW50ZWdyYXRlZCBTcG9uc29yIFBvcnRhbDwvbGk+XG4gICAgICAgIDxsaT5SdW5zIGluIHRoZSBXZWIgQnJvd3Nlciwgbm8gYXBwcyBvciBwaG9uZSBudW1iZXJzIG5lZWRlZCwgPGJyIC8+IGJ1dCBhbHNvIHdvcmtzIGluIG1vYmlsZSBicm93c2VyczwvbGk+XG4gICAgICAgIDxsaT7Cv0FzeW5jcm9ub3VzIEF1ZGlvIENvbnZlcnNhdGlvbnM/PC9saT5cbiAgICAgICAgPGxpPsK/Q2FsbCAmIFJlc3BvbnNlIENvbnZvcz88L2xpPlxuICAgICAgICA8bGk+Q2FsbCAxLTkwMC01NTUtMTMzNyAkNC45OSBmb3IgdGhlIDFzdCBtaW51dGUuLi48L2xpPlxuXG4gICAgICA8L3VsPlxuICAgIDwvZGl2PlxuICAgIDxpbWcgc3JjPUdhYnJpZWxIb3JuLnBuZyBjbGFzcz1sb2dvIC8+XG4gIDwvZGl2PlxuYFxufVxuIl19
