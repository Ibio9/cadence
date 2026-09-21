# Cadence design system

One substrate, one light. Everything below follows from that.

The reference is an X-ray plate or a long exposure: dense black, structure
emerging in cold light, most of the frame empty. If a screen looks busy, the
fix is subtraction, not rebalancing.

---

## 1. There is one theme

No light mode, no toggle, no `[data-theme]` selector, no theme provider, no
pre-paint script. `tokens.css` declares the palette on bare `:root` and nothing
at runtime can change it.

This is a decision, not an omission. The light rule below is the whole design,
and it only survives being decided once — a second substrate would have meant a
second set of judgements about where the light falls, made in a hurry, against
a ground nobody was actually looking at.

---

## 2. The palette is six named values

Everything else is derived. Each is named for the job it does, never for what
colour it is.

| Token | Value | Job |
|---|---|---|
| `--paper` | `#0b0d12` | The substrate everything is printed on |
| `--ink` | `#e8ecf3` | Everything you read first |
| `--quiet` | `#9aa4b4` | Everything you read second |
| `--emission` | `#3d8bff` | The light that means "this is happening now" |
| `--signal` | `#7db4ff` | The ink that says "now" where a word or numeral carries it |
| `--alarm` | `#ff8f7a` | The ink that means something needs you |

**`--paper` is a blued charcoal, not black.** Pure `#000` has no material — it
is the absence of a screen, and everything on it floats. A near-black with a
little blue in it is a surface, and blue light falling on a faintly blue ground
belongs there rather than sitting on top of it.

**`--emission` and `--signal` are two values, not one.** `--emission` is
saturated and would fail as text; it never appears as text. `--signal` is
lighter and clears 4.5:1 on every ground in the system, so it can be read.

Measured contrast, against the ground each one actually lands on:

| | on `--paper` | on `--surface` |
|---|---|---|
| `--ink` | 16.4:1 | 15.2:1 |
| `--quiet` | 7.6:1 | 7.0:1 |
| `--signal` | 9.1:1 | 8.3:1 |
| `--alarm` | 8.8:1 | 8.1:1 |
| `--ink-subtle` | 5.2:1 | 4.8:1 |

`--ink-subtle` clears 4.5:1 deliberately. On the old paper substrate it sat at
3.6:1 and was documented as "large text only", which in practice meant it got
used for small text anyway. Making it legal removed the loophole.

### There is no green

Blue is the light, and the light means *now*. A colour for "you got this right"
would either compete with it or add a fourth hue to a palette whose whole
argument is restraint. So a correct answer, a held block and a met criterion all
take `--held` — a bright neutral — plus a word or a mark. Held is a fact about
the past. It is not an event, and it does not glow.

---

## 3. The light rule

**Blue radiates from meaning. It never comes from chrome.**

It is allowed on: the active block, the now-marker, the recording indicator,
Jarvis thinking, a focused input, a topic falling out of retention, and the
current question in a timed drill.

It is banned on: borders, resting cards, headers, nav, dividers, and anything
whose only claim is that it is interactive.

Enforced by the absence of a class. There is no utility that puts `--emission`
on a border, a fill or a text colour. The only routes to it are `.glow-xs`,
`.glow-sm`, `.glow-md`, `.glow-lg`, `.bloom` and `.bloom-centre` — four shadows
and two radial gradients.

### Soft falloff, never a ring

Every glow is two low-opacity blue shadows at wide blur with negative spread, so
the edge is never findable. The single largest emitter on a screen also gets a
bloom, because a shadow alone cannot make light appear to come from *inside* a
surface — it only paints it behind one.

`.cd-bead__dot` is the reference implementation: a 9px `--signal` dot, a
`--glow-md` shadow, and a `::after` at nine times the diameter carrying
`--bloom-centre`. Without the third layer it read as a dot with a smudge.

### Pull the opacities down, not up

Blue at full saturation against near-black is the highest-energy pairing in the
system. The same geometry that read as a soft halo on cream reads as a lamp
here. Every glow opacity is roughly half its mint predecessor, and every time
one of them looked right it was too much.

### The budget

One primary emitter per screen at `--glow-md` or above. One secondary at
`--glow-xs`, which is about a third. Everything else is zero. Under about a
tenth of the viewport is ever lit.

`--glow-xs` exists because "everything else at a third" needs a value rather
than a good intention: without it, every second emitter quietly became
`--glow-sm` and each screen ended up with two lights of equal weight, at which
point neither reads as a source.

Where two emitters could collide, one is written so it cannot:

- `.cd-railrow.is-now` and `.cd-bead` never co-exist — the bead only appears
  when nothing is running.
- `.cd-btn--go` and a running `.cd-sessionrail` never co-exist — the button
  becomes Pause the moment the clock starts.

### Contrast beats light, always

Text over any glowed surface holds 4.5:1. If a glow ever costs a reading, the
glow loses. This is why `--signal` exists as a separate value from
`--emission`, and why the focus ring is drawn in `--signal` rather than felt
through a glow — a focus ring has to be *seen*.

### Breathing

`.cd-breathes` runs a 5.6s opacity cycle between 0.78 and 1. Long and low: alive,
not flashing. It is applied only while something is genuinely running.

Under `prefers-reduced-motion: reduce` a breathing glow drops to a static glow
at full strength. The emphasis is information, so it is stilled, never removed.

---

## 4. Brightness is not importance

The correction that came out of the first screenshot pass, and the one rule most
easily lost when inverting a design.

On paper, "the one filled control" and "the darkest rectangle" happened to be the
same thing, so `background: var(--ink)` was both correct and quiet. Inverted, it
produces a near-white slab on near-black — brighter than every glow in the
building. In the first screenshots the eye went to *Save note* on every screen
and never to the lit block.

So `--fill` (`#232936`) is derived for this substrate rather than flipped into
it: a lifted charcoal, unmistakably the one solid control, nowhere near the
light. `--ink` on it reads 12.3:1.

Everything that was a large ink fill now uses it: the primary button, the
primary icon button, the user's chat bubble, a checked radio. The only things
left at full brightness are text and the light.

---

## 5. Type

| Role | Face | Why this one |
|---|---|---|
| Display | **Newsreader** | A variable serif with a real optical size axis and *moderate* stroke contrast. On black, light spreads: fine serifs bloom and high-contrast thins dissolve. A face drawn for paper does not survive the inversion, so this was chosen against black rather than adapted to it. |
| Body | **IBM Plex Sans** | Genuine tabular lining figures and a slashed zero, drawn to the same skeleton as the mono. |
| Instrument | **IBM Plex Mono** | Every time, duration, count and score. |

**The utility face was chosen for its numerals.** The day spine and the drill
timers are almost entirely figures, and a numeral that changes width when a
clock ticks is a defect. Plex Sans and Plex Mono are metric siblings, so a
duration inside a sentence and the same duration in a table are the same digits
at the same width — which the previous pairing, drawn by different hands for
different purposes, could not promise.

Tabular figures are set on `body`, not opted into per component:

```css
font-variant-numeric: tabular-nums slashed-zero;
font-feature-settings: 'kern' 1, 'tnum' 1, 'zero' 1;
```

### Optical size

Newsreader's `opsz` axis runs 6–72 and is driven by three tokens: `lg` (60) for
the day title and Focus's block title, `md` (30) for section headings and modal
titles, `sm` (12) for the wordmark. Large sizes take a high value, which refines
the serifs; small sizes take a low one, which keeps them sturdy enough to hold
on this ground.

### The pairing means something

Newsreader is the person's voice: what I mean to do. Plex Mono is the
instrument's voice: what is measured. Plex Sans is the connective tissue. A
block title is set in Newsreader and the elapsed clock in Plex Mono, and never
the reverse.

---

## 6. Motion

The entire budget is spent on one moment: **a block opening into Focus.**
Everything else is 140ms or does not move.

The row is a rectangle on the day spine. Focus is a bigger rectangle. So the
moment is that rectangle *growing* — measured, not approximated:

1. `openBlock()` captures the row's box and its title's box on the way out.
2. `playOpen()` draws `.cd-openghost` at exactly the row's bounds and animates
   width, height and position to exactly the header's, carrying the substrate
   wash and the glow so what grows is the lit block itself.
3. The title travels from where it was standing to where it lands, scaled by
   the ratio of the two measured heights, so there are never two titles at two
   sizes.
4. The session rail unrolls from the left, 80ms behind — the vertical rail the
   row was hanging off, turning horizontal.
5. Everything else arrives last and barely moves.

The ghost is `pointer-events: none`, `aria-hidden`, and removed on `finish`,
`cancel`, or a timeout — a backgrounded tab never fires `finish`.

A browser that cannot measure it simply navigates. This is the polish, never the
function.

---

## 7. Copy

- **Active voice.** "The day did not load", never "The day could not be loaded".
- **Sentence case.** "Start", not "Begin Session".
- **Plain verbs.** Write, open, drill, hold, pick.
- **Empty states are invitations.** They name the first move. They never
  describe the void, and they no longer carry a decorative icon tile above the
  heading — it repeated the title and, on this substrate, put a grey box in the
  middle of a frame whose argument is emptiness.
- **Errors say what happened and the one thing to do.** No apologies, no
  "something went wrong", no "please", never a bare status code as the whole
  message.

Every error in the app follows the same three-beat shape: what failed, where
your work actually is, what to do.

> **The day did not load.** The server did not answer. Your blocks are on it, not
> in this tab, so nothing is lost. Check your connection and try again.

---

## 8. Rules a component must not break

1. No literal colour, shadow, radius or duration outside `tokens.css`.
2. No `--emission` on a border, a fill or a text colour.
3. No second primary emitter on a screen.
4. Nothing under 44px of hit area.
5. No status carried by colour alone — always a word or a mark beside it.
6. No text under 4.5:1 on the ground it actually lands on.
7. Nothing large filled with `--ink`. That is what `--fill` is for.
