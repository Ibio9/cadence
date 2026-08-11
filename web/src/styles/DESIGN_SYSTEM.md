# Cadence — the design system

Everything here answers one brief.

> One person, 17, sitting down at 21:00 after training, nine weeks from an
> Oxford admissions test. Tired, slightly wired, needs to start rather than
> browse. The single job of Today: make the next hour unambiguous.

Every decision below was held against one test: **from the doorway, squinting,
can you tell what to do next?** Not "is this pretty" — "is the next hour
unambiguous."

The visual world is an exam hall, a training log, a lab notebook. It is not a
SaaS dashboard, and where it started drifting toward one, that is written down
in [What was cut](#what-was-cut) rather than quietly fixed.

---

## 1. Palette

Six named values per theme. Each is named for the **job it does in the
interface**, never for what colour it is. Everything else in the system —
surfaces, rules, hovers, status grounds, glows — is derived from these six in
`tokens.css`, and no component ever sees a seventh.

| Token | Light | Dark | What it does |
|---|---|---|---|
| `--paper` | `#EFEAE1` | `#14130E` | The substrate the day is printed on |
| `--ink` | `#191813` | `#EFEAE0` | Everything you read first |
| `--quiet` | `#5E5B51` | `#A39D91` | Everything you read second |
| `--emission` | `#43E3A9` | `#43E3A9` | The light that means *this is happening now* |
| `--signal` | `#0A6B4F` | `#4FDCA4` | The ink that says "now" where a word or numeral carries it |
| `--alarm` | `#9E3B2B` | `#E88C7B` | The ink that means something needs you |

### Why these

**`--paper` is a warm grey-cream, not a yellow cream.** Yellow cream reads
cosy — a journalling app, a recipe site. This needs to read like exam stock:
warm enough not to be clinical, desaturated enough to be serious. It also sits
a few percent off white on purpose, because light cannot bleed *through* a
surface that is already the brightest thing on screen.

**`--emission` is identical in both themes.** That is the whole point of "the
dark theme inverts the substrate, not the logic". What changes between themes
is what the light falls on, never the light.

**`--signal` and `--emission` are two different values doing two different
jobs**, and keeping them apart is what makes the light rule enforceable:

> **`--signal` draws. `--emission` glows.**

`--emission` is high-chroma mint that would fail contrast as text and is never
used as text. `--signal` is a deep mint chosen to clear 4.5:1 on its ground, and
it is what a numeral, a word or a 3px rail segment is actually painted in.

**Held is deliberately not a colour.** An early version tinted every completed
block mint-green. Three green badges on a day pull the eye as hard as the one
lit row, and completion is past tense. Held is now written quietly in
`--ink-muted` and takes no ground at all.

### Measured contrast

Against the ground each one actually lands on:

| | on `--paper` (light) | on `--paper` (dark) |
|---|---|---|
| `--ink` | 14.8:1 | 15.4:1 |
| `--quiet` | 5.7:1 | 7.0:1 |
| `--signal` | 5.5:1 | 11.3:1 |
| `--alarm` | 5.7:1 | 8.1:1 |
| `--ink-subtle` | 3.6:1 — large and supplementary text only | 3.9:1 |
| `--on-signal` on `--signal` | 5.9:1 | 9.6:1 |

Text over a glowed surface holds 4.5:1. **Glow loses to contrast, always** — a
glow is a shadow behind the surface, so it never sits between ink and its
ground, and the `--cool` wash under the primary emitter is 4% mint, which moves
the ground's luminance by less than a percent.

---

## 2. Type

Three faces, deliberately paired. The pairing carries an argument rather than
just filling three slots.

| Role | Face | Why |
|---|---|---|
| Display | **Fraunces** | A variable serif with a real optical-size axis, drawn from old catalogue and almanac types. Warm, printed, slightly odd — nothing like a system serif or a fashion serif. |
| Body | **Public Sans** | Shorter ascenders and less geometry than the usual UI grotesque. Reads like a form you have to fill in correctly, which is the right register. |
| Utility | **IBM Plex Mono** | An *instrument* face, from engineering documentation rather than a code editor. Slab-ish terminals give numerals a printed, mechanical quality. |

**The pairing means something.** Fraunces is the person's voice: what I mean to
do. Plex Mono is the instrument's voice: what is measured. Public Sans is the
connective tissue between them. That is why the objective line is set in
Fraunces and the elapsed clock is set in Plex Mono, and never the reverse.

Not Inter and a generic serif, by explicit instruction and by preference.

### Numerals

The day spine is almost entirely numerals, so this is not a detail.

```css
body {
  font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: 'kern' 1, 'tnum' 1, 'zero' 1;
}
```

Tabular figures are set on `body`, not opted into per component. A ticking
clock must never change width, and a column of start times must align down the
gutter without anyone remembering to ask for it. Mono under 14px also carries
`letter-spacing: 0.02em` (`--tracking-mono`), because Plex Mono sets tight at
caption size.

### Fraunces optical size

The axis is used, not decorative:

| Token | Value | Where |
|---|---|---|
| `--display-opsz-lg` | `opsz 120` | The day title, a block title in Focus. High contrast, fine serifs. |
| `--display-opsz-md` | `opsz 48` | Objective line, state titles, modal titles. |
| `--display-opsz-sm` | `opsz 14` | The wordmark. Sturdy at small size. |

Display type is used for exactly three things: the day title, a block's title
in Focus, and the objective line. Everything else is Public Sans or Plex Mono.

---

## 3. The rail — the signature

One continuous hairline runs the full height of the day. It is literal time,
unbroken, **including across the gaps between blocks**, because the gaps are
part of the day. Every block hangs off it.

```
        │
  08:00 ├─ Further Maths — Complex numbers        held
        │  Finish one exercise and mark it
  10:30 ├─ TARA — Section A under time             held
        │
        ●  ← the bead, at 15:07. The only lit thing on the screen.
  14:00 ┝━ ECONOMICS — MARKET FAILURE ESSAY         Now
        ┃  Write one evaluation paragraph and stop
        │
  16:00 ├─ Philosophy — Uncommon Knowledge      in 53m
  18:00 ├─ BJJ No-Gi
        ╵
```

A single bead sits on the rail at the current minute. The entry the bead
touches is the only one drawn at full size and the only one lit; everything
above it recedes to 50% opacity, everything below is a quiet ruled line.

**Why a rail rather than a list of rows.** A ledger is a table of things; the
rail is time itself. Seeing 11:30–14:00 as empty rail is information rows
cannot give. It also gives emission somewhere to live that is not a card — with
rows, the only way to light the current block is to glow a box, which is
chrome. And it carries: on Focus the same rail turns horizontal and becomes the
session's own progress track. Same object, zoomed in.

Project colour appears as a small **hollow ring on the rail** at the entry's
tick — a legend on a chart, not decoration. It is never the only signal: the
project name is always written out underneath, because a colour chosen in the
database cannot be guaranteed to clear contrast on this ground.

---

## 4. Emission — the light rule

The surface is warm paper. **Mint is light bleeding through it, never ink
printed on it.**

### Where light is allowed

Light radiates from meaning only. There are exactly five emitters in the app:

1. the block you are in (Today, Timetable)
2. the now bead
3. a running session clock and its rail (Focus)
4. Jarvis thinking
5. a focused input

Never chrome: not borders, not resting cards, not headers, not nav, not
dividers. The nav's active item is ink weight and a 2px ink rule — there is no
tint on it and no mint anywhere near it.

### How it is built

Every glow is two low-opacity mint shadows at wide blur, so the edge is never
findable. There is no hard ring anywhere.

```css
--glow-sm: 0 2px 14px -4px rgba(67,227,169,0.24), 0 0 34px -12px rgba(67,227,169,0.16);
--glow-md: 0 4px 26px -6px rgba(67,227,169,0.30), 0 0 68px -16px rgba(67,227,169,0.20);
--glow-lg: 0 6px 42px -8px rgba(67,227,169,0.36), 0 0 120px -24px rgba(67,227,169,0.24);
```

The single largest emitter also gets `--bloom`, a radial gradient anchored to
the left so the light reads as coming off the rail rather than out of the
middle of a box. A shadow alone cannot make light appear to come from *inside*
a surface.

The surface around a glow reads very slightly cooler: `--cool` is `--paper`
mixed 4% toward the emission, and it is the only place in the system where the
light touches a fill.

### The budget

- **One primary emitter per screen.** Secondary at about a third of the
  strength. Everything else zero.
- **Total glowing surface under ~10% of the viewport.** When in doubt, remove
  one.
- Today: primary is the current row (bloom + `--glow-sm`) and its bead
  (`--glow-md`). There is no secondary.
- Focus: primary is the session rail bead while running; secondary is the
  focused input (`--glow-sm`).

### It is enforced by absence

There is deliberately **no utility class** that puts `--emission` on a border,
a fill or a text colour. The only routes to the light are `.glow-sm/md/lg` and
`.bloom`, which are shadows and a gradient. If a component wants a mint border,
the system has no way to give it one.

### Breathing

Glows breathe long and low — `--dur-breathe: 5200ms`, opacity 0.78 → 1 — and
**only while something is genuinely active**. A paused clock is lit and still.

`prefers-reduced-motion` drops to a static glow at full strength via
`.cd-breathes { animation: none; opacity: 1 }`. The emphasis is the
information, so it is stilled, never removed.

---

## 5. Motion

**One orchestrated moment, and it is a block opening into Focus.**

Focus is a route, so by default the day would disappear and something else
would be there — which reads as a modal over the day. Instead the row measures
itself on the way out (`openBlock`) and hands its rectangle forward; Focus picks
it up on mount and plays the block into place from exactly where it was
standing, with the session rail unrolling underneath (`playOpen`). A
first-last-invert on the Web Animations API, so it works in every browser
rather than only where view transitions have shipped.

Everything else moves at `--dur-fast` (140ms) or not at all. `prefers-reduced-motion`
skips the opening entirely and navigates.

---

## 6. Copy

- Active voice, sentence case, plain verbs. **"Start", not "Begin Session".**
- **An action keeps its name through the whole flow.** Start → Pause → Done,
  and "The day" is what the way back is called on every screen.
- **Empty states are invitations.** An empty day says what to do about it and
  links to where to do it: *"Nothing is on today. Your rhythms put training on
  the days you train. Everything else you put here yourself."*
- **Errors say what happened and how to fix it**, never vague, never
  apologising: *"Today could not be loaded. Your blocks are safe on the server.
  This is a connection problem, not lost work."*
- **Named by what you control, not how it was built:** "Working from", not
  "material". "The hour", not "session plan". "Held", not "completed".

---

## 7. The quality floor

Assumed, not announced:

- Responsive to 390px. The rail's gutter narrows and the times drop a size; the
  structure does not change.
- Visible keyboard focus on every interactive element — 2px `--signal` with
  2px offset, never removed without a replacement. On inputs the glow is added
  *to* the ring, never instead of it.
- `prefers-reduced-motion` respected throughout.
- Real loading and empty states on every screen, and skeletons in the real
  shape so nothing shifts when content arrives.
- Every control is at least 44px in its smallest dimension. "Compact" changes
  the glyph and the type, never the target.
- Status is never carried by colour alone: every status has a word or a mark.

---

## 8. Files

```
tokens.css       Every value the interface may use. The only file with literals.
base.css         Reset, element defaults, focus, keyframes, motion policy.
components.css   Component classes. Resolves entirely through tokens.
utilities.css    Semantic utilities, named to match tailwind.config.js.
```

No component file contains a raw colour, shadow, radius or duration.
`/dev/ui` renders every primitive in both themes on one page and is kept in the
repo so it keeps doing that job.

---

## What was cut

Written down because the reasons matter more than the result.

- **"3 of 8 held" in the day header.** The most generic move in the category,
  and at 21:00 it reads *you failed at five things* — the opposite of "start
  now". The corner now shows what is next and when, or nothing at all when a
  block is already running, because then the lit row has already said it.
- **Habits as rounded pills with a `+`.** Every habit tracker ever shipped. Now
  a tally: cells on a baseline rule, struck through when held. A log, not a
  tracker.
- **The Focus clock as a rounded card with a button cluster.** That is a
  Pomodoro app. The card is gone; the elapsed numeral sits on the paper with
  the rail above it as its track, one filled verb, the rest plain words.
- **A 3px project-coloured left border on every row.** The Google Calendar
  convention, and a second vertical line fights the rail. Now a hollow ring on
  the rail itself.
- **Cards on Today and Focus.** On a paper substrate, wrapping everything in a
  shadowed rounded box is a reflex. Cards survive only where something
  genuinely floats: modals, sheets, toasts, and the panels on Settings.
- **The nav's tinted active pill.** A straight violation of the light rule,
  which bans mint on chrome.
- **The Jarvis brief on Today.** A network call on load, in front of the day,
  that said something general. Jarvis has its own screen.
- **The italic display accent line.** A magazine device that had drifted onto
  every screen, saying something decorative in a place that should carry a
  fact. Supporting lines are body type now, or absent.
