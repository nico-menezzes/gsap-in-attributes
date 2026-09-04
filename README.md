# GSAP in Attributes

Declarative GSAP animations, driven by `data-attributes`. Built for **Webflow**
(and any HTML). Paste **one** script into your site and pick animations right on
your elements — type, duration, easing, delay, stagger and more.

```html
<h1 data-gsap="text-up">My headline</h1>

<div data-gsap="fade-up"
     data-gsap-duration="1.2"
     data-gsap-ease="snappy"
     data-gsap-delay="0.2"></div>
```

- **Zero JS** for the end user — just attributes.
- **Auto-loads** GSAP + ScrollTrigger + SplitText + CustomEase if they aren't on the page.
- **Split text** for free (GSAP 3.13+): lines, words, characters.
- **Strong easing** built in: `smooth`, `snappy`, `swift`, `soft` — or your own `cubic(...)`.
- **No flash** (FOUC): elements stay hidden until the library is ready.
- **Accessible**: respects `prefers-reduced-motion`.
- **Scales**: one scan, a public API to re-initialize (CMS, Barba, tabs).

---

## Install in Webflow

1. Push this repository to GitHub (e.g. `YOUR-USER/gsap-in-attributes`).
2. Create a release/tag (e.g. `1.0.0`) — jsDelivr uses the tag.
3. In Webflow: **Project Settings → Custom Code → Footer Code** (or per page), paste:

```html
<script src="https://cdn.jsdelivr.net/gh/YOUR-USER/gsap-in-attributes@1/dist/gsap-attributes.min.js"></script>
```

> Tip: `@1` always pulls the latest release of major version 1. Use `@1.0.0` to pin an exact version.

4. Publish. Now add `data-gsap="fade-up"` (via **Element Settings → Custom Attributes**)
   to any element.

If GSAP is already loaded in your project, the library detects and reuses it — no double download.

---

## Presets

**Entrance (fade / move):**
`fade` · `fade-up` · `fade-down` · `fade-left` · `fade-right`
`slide-up` · `slide-down` · `slide-left` · `slide-right`

**Scale / rotation:**
`scale-in` · `zoom-in` · `rotate-in` · `flip-up` · `flip-down` · `blur-in` · `skew-in`

**Reveal (clip-path):**
`reveal-up` · `reveal-down` · `reveal-left` · `reveal-right`

**Text (SplitText):**
`text-up` (masked lines) · `text-lines` · `text-words` · `text-chars` · `text-fade` · `text-flip`

---

## Attributes

All optional except `data-gsap`. The prefix is always `data-gsap-`.

| Attribute | Values | Default | Description |
|---|---|---|---|
| `data-gsap` | preset name | — | The animation. |
| `data-gsap-duration` | seconds | `0.8` | Duration. |
| `data-gsap-delay` | seconds | `0` | Delay before start. |
| `data-gsap-ease` | named curve, GSAP ease or `cubic(...)` | `smooth` | Easing. See below. |
| `data-gsap-distance` | px | `40` | Travel distance for fades/slides. |
| `data-gsap-stagger` | seconds | `0.06` | Gap between items (or a container's children). |
| `data-gsap-rotation` | degrees | `8` | Initial rotation. |
| `data-gsap-start` | ScrollTrigger start | `top 85%` | When it fires on scroll. |
| `data-gsap-end` | ScrollTrigger end | — | End (used with scrub). |
| `data-gsap-trigger` | `scroll` \| `load` | `scroll` | Fire on scroll or on load. |
| `data-gsap-once` | `true` \| `false` | `true` | Play once, or every time it enters. |
| `data-gsap-scrub` | `true` \| number | `false` | Tie progress to scroll. |
| `data-gsap-split` | `lines`·`words`·`chars` | auto | Override text splitting. |
| `data-gsap-target` | CSS selector | direct children | Which children to stagger. |
| `data-gsap-markers` | `true` | `false` | Show ScrollTrigger debug markers. |

---

## Easing

Four strong curves ship built in — reference them by name:

| Name | Feel | Curve |
|---|---|---|
| `smooth` *(default)* | strong ease-out, great for entrances | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `snappy` | iOS drawer feel | `cubic-bezier(0.32, 0.72, 0, 1)` |
| `swift` | strong ease-in-out for on-screen movement | `cubic-bezier(0.77, 0, 0.175, 1)` |
| `soft` | gentle ease-out | `cubic-bezier(0.25, 1, 0.5, 1)` |

```html
<div data-gsap="fade-up" data-gsap-ease="snappy"></div>
```

Or pass your own cubic-bezier — it becomes a GSAP `CustomEase`:

```html
<div data-gsap="fade-up" data-gsap-ease="cubic(0.16, 1, 0.3, 1)"></div>
```

Or use any named GSAP ease: `power1..4`, `back.out(1.7)`, `elastic.out(1, 0.4)`,
`expo.out`, `circ.out`, `sine.inOut`, etc.

---

## Staggering lists / grids

Put the attribute on the **container** and add `data-gsap-stagger` — the children enter in sequence:

```html
<div class="cards" data-gsap="fade-up" data-gsap-stagger="0.08">
  <div class="card">...</div>
  <div class="card">...</div>
  <div class="card">...</div>
</div>
```

To choose exactly which children: `data-gsap-target=".card"`.

---

## Global config (optional)

Before the script, set project-wide defaults:

```html
<script>
  window.GSAPAttr = {
    defaults: { ease: 'snappy', duration: 0.9, start: 'top 80%' },
    gsapVersion: '3.13.0',
    autoload: true,          // fetch GSAP if missing
    hideUntilReady: true,    // prevent flash
    respectReducedMotion: true
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/YOUR-USER/gsap-in-attributes@1/dist/gsap-attributes.min.js"></script>
```

## Public API

```js
GSAPAttr.refresh(root)         // re-scan (after CMS load, Barba, tab switch)
GSAPAttr.register(name, fn)    // register a custom preset at runtime
GSAPAttr.init()                // re-initialize everything
GSAPAttr.eases                 // the built-in named curves
```

Custom preset example:

```js
GSAPAttr.register('drop-in', function(o){
  return { opacity: 0, y: -o.distance, scale: 1.1 };
});
```

---

## Structure

```
GSAP in Attributes/
├── src/gsap-attributes.js        ← source
├── dist/gsap-attributes.js       ← readable build
├── dist/gsap-attributes.min.js   ← minified build (jsDelivr)
├── demo/index.html               ← demo + docs + playground
└── README.md
```

Open `demo/index.html` in a browser to see everything running.

---

## New in v1.1

- `data-gsap-trigger="scroll|load"` clearly separates the two entrance kinds.
- Per-property overrides: `-y` `-x` `-opacity` `-scale` `-rotate` `-blur` (fine-tune any preset or use `data-gsap="custom"`).
- `-trigger-element` fires when a parent section enters; `-toggle` for full toggleActions; `-stagger-from` for cascade origin.

## Roadmap (v2)

- Attribute-chained timelines (`data-gsap-timeline`).
- Dedicated parallax and scroll effects.
- Hover / click triggers.
- Exit presets for page transitions.

MIT · built by Nico Menezes.
