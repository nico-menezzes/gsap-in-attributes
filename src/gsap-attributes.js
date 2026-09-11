/*!
 * GSAP in Attributes — v1.2.0
 * Declarative GSAP animations for Webflow (and any HTML) driven by data-attributes.
 *
 * Drop this file on your page (after GSAP loads, or let it auto-load GSAP),
 * then add attributes to your elements:
 *
 *   <h1 data-gsap="text-up">Hello</h1>
 *   <div data-gsap="fade-up" data-gsap-duration="1" data-gsap-ease="power3.out"></div>
 *
 * Author: Nico Menezes
 * License: MIT
 */
(function (window, document) {
  'use strict';

  /* --------------------------------------------------------------------------
   * 0. Configuration
   * User can override defaults BEFORE loading this script:
   *   <script>window.GSAPAttr = { defaults: { ease: 'expo.out' } }</script>
   * ------------------------------------------------------------------------ */
  var USER = window.GSAPAttr || {};

  var CONFIG = {
    // The attribute that names the animation. Everything else is `${attr}-*`.
    attr: USER.attr || 'data-gsap',
    // Auto-inject GSAP + plugins from CDN if they aren't already on the page.
    autoload: USER.autoload !== false,
    gsapVersion: USER.gsapVersion || '3.13.0',
    // Hide animated elements until the library is ready (prevents flash / FOUC).
    hideUntilReady: USER.hideUntilReady !== false,
    // Respect the user's OS "reduce motion" setting.
    respectReducedMotion: USER.respectReducedMotion !== false,
    // Print helpful warnings to the console.
    debug: USER.debug || false,
    // Animation defaults — overridable per-element via attributes.
    defaults: Object.assign({
      duration: 0.8,
      delay: 0,
      ease: 'smooth',      // strong ease-out curve (see NAMED_EASES)
      distance: 40,        // px, used by fade/slide directions
      stagger: 0.06,       // seconds between staggered items
      rotation: 8,         // deg, used by rotate/flip
      start: 'top 85%',    // ScrollTrigger start
      once: true,          // play only the first time it enters
      scrub: false         // tie progress to scroll instead of playing once
    }, USER.defaults || {})
  };

  var A = CONFIG.attr;              // e.g. "data-gsap"
  var READY_CLASS = 'gsap-attr-ready';

  function log() {
    if (CONFIG.debug && window.console) {
      console.log.apply(console, ['[gsap-attr]'].concat([].slice.call(arguments)));
    }
  }
  function warn() {
    if (window.console) {
      console.warn.apply(console, ['[gsap-attr]'].concat([].slice.call(arguments)));
    }
  }

  /* --------------------------------------------------------------------------
   * 1. Small helpers
   * ------------------------------------------------------------------------ */

  // Read `${attr}-${name}` and coerce to the given type.
  function readAttr(el, name, type, fallback) {
    var raw = el.getAttribute(A + '-' + name);
    if (raw === null || raw === '') return fallback;
    if (type === 'number') {
      var n = parseFloat(raw);
      return isNaN(n) ? fallback : n;
    }
    if (type === 'bool') {
      return raw === 'true' || raw === '1' || raw === '';
    }
    return raw; // string
  }

  // Build the per-element options object from attributes, falling back to defaults.
  function readOptions(el) {
    var d = CONFIG.defaults;
    return {
      name:      (el.getAttribute(A) || '').trim(),
      duration:  readAttr(el, 'duration', 'number', d.duration),
      delay:     readAttr(el, 'delay', 'number', d.delay),
      ease:      resolveEase(readAttr(el, 'ease', 'string', d.ease)),
      distance:  readAttr(el, 'distance', 'number', d.distance),
      stagger:   readAttr(el, 'stagger', 'number', d.stagger),
      rotation:  readAttr(el, 'rotation', 'number', d.rotation),
      start:     readAttr(el, 'start', 'string', d.start),
      end:       readAttr(el, 'end', 'string', null),
      once:      readAttr(el, 'once', 'bool', d.once),
      scrub:     readAttr(el, 'scrub', 'string', d.scrub ? 'true' : null),
      markers:   readAttr(el, 'markers', 'bool', false),
      trigger:   readAttr(el, 'trigger', 'string', 'scroll'), // "scroll" | "load"
      split:     readAttr(el, 'split', 'string', null),        // override split type
      target:    readAttr(el, 'target', 'string', null),       // selector for stagger children
      staggerFrom: readAttr(el, 'stagger-from', 'string', null), // start|center|end|edges|random
      toggle:    readAttr(el, 'toggle', 'string', null),         // full ScrollTrigger toggleActions
      triggerEl: readAttr(el, 'trigger-element', 'string', null),// scroll-trigger on another element
      scroller:  readAttr(el, 'scroller', 'string', null),       // custom scroll container (selector)
      // Per-property overrides — fine-tune any preset, or build a fully custom entrance.
      xFrom:       readAttr(el, 'x', 'string', null),   // px or % (e.g. "60" or "10%")
      yFrom:       readAttr(el, 'y', 'string', null),
      opacityFrom: readAttr(el, 'opacity', 'number', null),
      scaleFrom:   readAttr(el, 'scale', 'number', null),
      rotateFrom:  readAttr(el, 'rotate', 'number', null),
      blurFrom:    readAttr(el, 'blur', 'number', null)
    };
  }

  // Length value: keep "%" strings as-is, otherwise a number (px).
  function len(v) {
    if (v == null) return v;
    var s = String(v).trim();
    return /%$/.test(s) ? s : parseFloat(s);
  }

  // Build a "from" object from any per-property overrides the user set.
  // These win over the preset's own values (Object.assign order), so you can
  // tweak one axis of a preset or compose an entrance from scratch on "custom".
  function customFrom(o) {
    var f = {};
    if (o.yFrom != null)       f.y = len(o.yFrom);
    if (o.xFrom != null)       f.x = len(o.xFrom);
    if (o.opacityFrom != null) f.opacity = o.opacityFrom;
    if (o.scaleFrom != null)   f.scale = o.scaleFrom;
    if (o.rotateFrom != null)  f.rotation = o.rotateFrom;
    if (o.blurFrom != null)    f.filter = 'blur(' + o.blurFrom + 'px)';
    return f;
  }

  // Stagger value: a number, or {each, from} when a stagger origin is set.
  function staggerVal(o) {
    return o.staggerFrom ? { each: o.stagger, from: o.staggerFrom } : o.stagger;
  }

  // Strong, intentional easing curves — built-in CSS eases lack punch.
  // Reference by name: data-gsap-ease="smooth" (the default).
  var NAMED_EASES = {
    smooth: [0.23, 1, 0.32, 1],    // strong ease-out — great for entrances
    snappy: [0.32, 0.72, 0, 1],    // iOS drawer feel
    swift:  [0.77, 0, 0.175, 1],   // strong ease-in-out for on-screen movement
    soft:   [0.25, 1, 0.5, 1]      // gentle ease-out
  };

  // Turn four bezier control points into a GSAP CustomEase (cached by name).
  function cubicEase(p) {
    if (p.length !== 4 || p.some(isNaN) || !window.CustomEase) return null;
    var name = 'ce_' + p.join('_').replace(/[.\-]/g, 'n');
    try {
      return window.CustomEase.create(
        name,
        'M0,0 C' + p[0] + ',' + p[1] + ' ' + p[2] + ',' + p[3] + ' 1,1'
      );
    } catch (e) {
      warn('CustomEase failed for', p, e);
      return null;
    }
  }

  // Resolve an ease value. Supports:
  //   named strong curves   →  data-gsap-ease="smooth"
  //   custom cubic-bezier   →  data-gsap-ease="cubic(0.16, 1, 0.3, 1)"
  //   any GSAP ease         →  data-gsap-ease="back.out(1.7)"
  // Falls back to power3.out if CustomEase isn't available.
  function resolveEase(easeStr) {
    easeStr = String(easeStr || 'smooth').trim();
    if (NAMED_EASES[easeStr]) return cubicEase(NAMED_EASES[easeStr]) || 'power3.out';
    var m = easeStr.match(/^(?:cubic|cubic-bezier)\(([^)]+)\)$/i);
    if (m) return cubicEase(m[1].split(',').map(parseFloat)) || 'power3.out';
    return easeStr; // let GSAP resolve named eases
  }

  // Base tween vars shared by all animations.
  function baseVars(o) {
    return { duration: o.duration, ease: o.ease, delay: o.delay };
  }

  // Build the ScrollTrigger config for an element.
  // Returns null for LOAD animations (trigger="load") — those play on page load
  // with no ScrollTrigger at all. Everything else is a SCROLL animation, fired
  // when the trigger element crosses `start`.
  function scrollConfig(el, o) {
    if (o.trigger === 'load') return null;

    // The element that drives the scroll position. By default it's the animated
    // element itself; data-gsap-trigger-element lets a child animate when its
    // section enters (great for section entrances).
    var triggerEl = el;
    if (o.triggerEl) {
      triggerEl = (el.closest && el.closest(o.triggerEl)) ||
        document.querySelector(o.triggerEl) || el;
    }

    var cfg = { trigger: triggerEl, start: o.start, markers: o.markers };

    // Optional custom scroll container (e.g. a scrollable panel or modal).
    if (o.scroller) {
      var sc = document.querySelector(o.scroller);
      if (sc) cfg.scroller = sc;
    }

    if (o.scrub && o.scrub !== 'false') {
      // Scrubbed: progress is tied to scroll between start and end.
      cfg.scrub = (o.scrub === 'true') ? true : parseFloat(o.scrub) || true;
      cfg.end = o.end || 'top 30%';
    } else {
      // Triggered: plays once on enter (once), or replays on re-enter.
      cfg.toggleActions = o.toggle ||
        (o.once ? 'play none none none' : 'play none none reverse');
      if (o.end) cfg.end = o.end;
    }
    return cfg;
  }

  /* --------------------------------------------------------------------------
   * 2. Animation registry
   * Each preset returns the "from" state. We use gsap.from() so elements
   * animate FROM this state TO their natural, CSS-defined appearance — which
   * makes it safe and predictable inside Webflow.
   * ------------------------------------------------------------------------ */
  var PRESETS = {
    'fade':        function (o) { return { opacity: 0 }; },
    'fade-up':     function (o) { return { opacity: 0, y: o.distance }; },
    'fade-down':   function (o) { return { opacity: 0, y: -o.distance }; },
    'fade-left':   function (o) { return { opacity: 0, x: o.distance }; },
    'fade-right':  function (o) { return { opacity: 0, x: -o.distance }; },
    'slide-up':    function (o) { return { y: o.distance * 2, opacity: 0 }; },
    'slide-down':  function (o) { return { y: -o.distance * 2, opacity: 0 }; },
    'slide-left':  function (o) { return { x: o.distance * 2, opacity: 0 }; },
    'slide-right': function (o) { return { x: -o.distance * 2, opacity: 0 }; },
    'scale-in':    function (o) { return { opacity: 0, scale: 0.8 }; },
    'zoom-in':     function (o) { return { opacity: 0, scale: 1.15 }; },
    'rotate-in':   function (o) { return { opacity: 0, rotation: -o.rotation, y: o.distance }; },
    'flip-up':     function (o) { return { opacity: 0, rotationX: -90, transformOrigin: '50% 100% -50px' }; },
    'flip-down':   function (o) { return { opacity: 0, rotationX: 90, transformOrigin: '50% 0% -50px' }; },
    'blur-in':     function (o) { return { opacity: 0, filter: 'blur(14px)' }; },
    'skew-in':     function (o) { return { opacity: 0, skewY: 6, y: o.distance }; },
    // Blank canvases — compose your own entrance purely from x/y/opacity/scale/
    // rotate/blur overrides. "none" starts from nothing; "custom" fades by default.
    'custom':      function (o) { return { opacity: 0 }; },
    'none':        function (o) { return {}; }
  };

  // Presets driven by clip-path (reveal wipes). Handled with fromTo because the
  // natural "to" value must be explicit.
  var CLIP = {
    'reveal-up':    { from: 'inset(100% 0 0 0)', to: 'inset(0% 0 0 0)' },
    'reveal-down':  { from: 'inset(0 0 100% 0)', to: 'inset(0 0 0% 0)' },
    'reveal-left':  { from: 'inset(0 100% 0 0)', to: 'inset(0 0% 0 0)' },
    'reveal-right': { from: 'inset(0 0 0 100%)', to: 'inset(0 0 0 0%)' }
  };

  // Text presets require SplitText. Value = how each piece animates in.
  var TEXT = {
    'text-fade':  { split: 'words', from: function (o) { return { opacity: 0, y: o.distance * 0.4 }; }, mask: false },
    'text-up':    { split: 'lines', from: function (o) { return { yPercent: 110 }; }, mask: true },
    'text-lines': { split: 'lines', from: function (o) { return { opacity: 0, y: o.distance }; }, mask: false },
    'text-words': { split: 'words', from: function (o) { return { opacity: 0, y: o.distance * 0.6 }; }, mask: false },
    'text-chars': { split: 'chars', from: function (o) { return { opacity: 0, y: o.distance * 0.5 }; }, mask: false },
    'text-flip':  { split: 'chars', from: function (o) { return { opacity: 0, rotationX: -90 }; }, mask: false },
    // Scroll-linked fill: pieces start dim and brighten as you scroll (scrubbed).
    // Split words by default; set data-gsap-split / data-gsap-opacity to taste.
    'text-fill':  { split: 'words', from: function (o) { return { opacity: 0.15 }; }, mask: false,
                    scrub: true, ease: 'none', end: 'bottom 60%' }
  };

  /* --------------------------------------------------------------------------
   * 3. Apply an animation to a single element
   * ------------------------------------------------------------------------ */
  function applyOne(el) {
    // Guard: init each element only once.
    if (el.__gsapAttrInit) return;
    el.__gsapAttrInit = true;

    var o = readOptions(el);
    if (!o.name) return;

    // Reduced motion: reveal instantly, skip the animation.
    if (CONFIG.reduceMotion) {
      window.gsap.set(el, { clearProps: 'all', autoAlpha: 1, visibility: 'visible' });
      return;
    }

    window.gsap.set(el, { visibility: 'visible' });

    if (TEXT[o.name])       return applyText(el, o, TEXT[o.name]);
    if (CLIP[o.name])       return applyClip(el, o, CLIP[o.name]);
    if (PRESETS[o.name])    return applyPreset(el, o, PRESETS[o.name]);

    warn('Unknown animation "' + o.name + '" on', el);
  }

  // Standard "from" preset — with optional stagger over children and any
  // per-property overrides layered on top of the preset's defaults.
  function applyPreset(el, o, presetFn) {
    var fromVars = Object.assign({}, presetFn(o), customFrom(o));
    var st = scrollConfig(el, o);

    // Stagger mode: animate children (grid / list) instead of the container.
    // Only when there are actually child elements to stagger — otherwise fall
    // through and animate the element itself (a leaf with stagger is harmless).
    if (el.hasAttribute(A + '-stagger') || o.target) {
      var items = o.target
        ? el.querySelectorAll(o.target)
        : el.children;
      items = Array.prototype.slice.call(items || []);
      if (items.length) {
        window.gsap.set(el, { visibility: 'visible' });
        window.gsap.from(items, Object.assign({}, fromVars, baseVars(o), {
          stagger: staggerVal(o),
          scrollTrigger: st
        }));
        return;
      }
    }

    window.gsap.from(el, Object.assign({}, fromVars, baseVars(o), {
      scrollTrigger: st
    }));
  }

  // clip-path reveal.
  function applyClip(el, o, clip) {
    var st = scrollConfig(el, o);
    window.gsap.fromTo(el,
      { clipPath: clip.from, webkitClipPath: clip.from },
      Object.assign({ clipPath: clip.to, webkitClipPath: clip.to }, baseVars(o), {
        scrollTrigger: st
      })
    );
  }

  // Text animation via SplitText, with a masked overflow option for line reveals.
  function applyText(el, o, def) {
    if (!window.SplitText) {
      warn('SplitText not loaded — cannot run "' + o.name + '". Falling back to fade.');
      return applyPreset(el, o, PRESETS['fade-up']);
    }
    var splitType = o.split || def.split;
    var useMask = def.mask;

    // Preset-level scroll defaults (e.g. text-fill is scrubbed by default),
    // each overridable by the matching attribute.
    if (def.scrub && o.scrub == null) o.scrub = 'true';
    if (def.end && !o.end) o.end = def.end;
    if (def.ease && !el.hasAttribute(A + '-ease')) o.ease = def.ease;

    var split = new window.SplitText(el, {
      type: splitType,
      linesClass: 'gsap-line',
      wordsClass: 'gsap-word',
      charsClass: 'gsap-char',
      // Wrap each line so we can mask overflow for the "text-up" reveal.
      mask: useMask ? splitType : false
    });

    var pieces = split[splitType] || split.lines || split.words || split.chars;
    var st = scrollConfig(el, o);

    window.gsap.set(el, { visibility: 'visible' });
    if (!pieces || !pieces.length) {
      // Nothing to split (empty element) — just reveal it.
      return;
    }
    window.gsap.from(pieces, Object.assign({}, def.from(o), customFrom(o), baseVars(o), {
      stagger: staggerVal(o),
      scrollTrigger: st
    }));
  }

  /* --------------------------------------------------------------------------
   * 4. Scan + init
   * ------------------------------------------------------------------------ */
  function scan(root) {
    root = root || document;
    var els = root.querySelectorAll('[' + A + ']');
    log('found', els.length, 'element(s)');
    for (var i = 0; i < els.length; i++) applyOne(els[i]);
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  function init() {
    CONFIG.reduceMotion = CONFIG.respectReducedMotion &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Register plugins if present.
    if (window.gsap) {
      if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
      if (window.SplitText)     window.gsap.registerPlugin(window.SplitText);
      if (window.CustomEase)    window.gsap.registerPlugin(window.CustomEase);
    }

    document.documentElement.classList.add(READY_CLASS);
    scan(document);
  }

  /* --------------------------------------------------------------------------
   * 5. FOUC guard — hide animated elements until we're ready
   * ------------------------------------------------------------------------ */
  function injectHideStyle() {
    if (!CONFIG.hideUntilReady) return;
    var css = 'html:not(.' + READY_CLASS + ') [' + A + ']{visibility:hidden!important}';
    var style = document.createElement('style');
    style.setAttribute('data-gsap-attr', '');
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);
  }

  /* --------------------------------------------------------------------------
   * 6. GSAP loader (auto-inject from CDN if not present)
   * ------------------------------------------------------------------------ */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureGSAP() {
    if (window.gsap && window.ScrollTrigger && window.SplitText) {
      return Promise.resolve();
    }
    if (!CONFIG.autoload) {
      warn('GSAP (or a plugin) is missing and autoload is off. Load gsap, ScrollTrigger, SplitText and CustomEase yourself.');
      return Promise.resolve();
    }
    var base = 'https://cdn.jsdelivr.net/npm/gsap@' + CONFIG.gsapVersion + '/dist/';
    var chain = Promise.resolve();
    if (!window.gsap)         chain = chain.then(function () { return loadScript(base + 'gsap.min.js'); });
    if (!window.ScrollTrigger) chain = chain.then(function () { return loadScript(base + 'ScrollTrigger.min.js'); });
    if (!window.SplitText)    chain = chain.then(function () { return loadScript(base + 'SplitText.min.js'); });
    if (!window.CustomEase)   chain = chain.then(function () { return loadScript(base + 'CustomEase.min.js'); });
    return chain;
  }

  /* --------------------------------------------------------------------------
   * 7. Public API
   * ------------------------------------------------------------------------ */
  var API = {
    version: '1.2.0',
    config: CONFIG,
    presets: PRESETS,
    eases: NAMED_EASES,
    // Register a custom animation preset at runtime.
    register: function (name, fn) { PRESETS[name] = fn; return API; },
    // Re-scan the DOM (e.g. after CMS load, Barba transition, tab switch).
    refresh: function (root) { scan(root); return API; },
    // Manually (re)initialise everything.
    init: function () { boot(); return API; }
  };

  function boot() {
    ensureGSAP().then(init).catch(function (err) {
      warn('Could not initialise:', err.message);
      // Fail open — reveal everything so content is never stuck hidden.
      document.documentElement.classList.add(READY_CLASS);
    });
  }

  // Kick off.
  injectHideStyle();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.GSAPAttr = Object.assign(USER, API);
})(window, document);
