# Cadence design system

Light, warm cream, cobalt blue. Restrained, editorial, calm. One accent used
sparingly, generous space, soft lift instead of hard shadow. Every screen should
read as one product designed at one time by one person.

This file is the contract. If a change would break a rule here, change the rule
here first.

---

## 0. Where things live

```
web/src/styles/tokens.css        every value the UI may use, plus both themes
web/src/styles/base.css          reset, element defaults, focus, motion policy
web/src/styles/components.css    primitive component classes (.cd-*)
web/src/styles/utilities.css     semantic utilities (bg-surface, text-ink-muted, ...)
web/tailwind.config.js           the same tokens mapped to Tailwind semantic names
web/app/globals.css              the import order: tokens, base, components, utilities
web/src/components/ui/           the 23 primitives
web/src/components/shell/        AppShell, Page, Sidebar, MobileNav
web/src/components/Icon.jsx      the single line icon set
web/src/context/ThemeContext.jsx theme state and the pre paint script
web/src/screens/                 the five screens
web/app/dev/ui/page.jsx          the gallery, behind NEXT_PUBLIC_ENABLE_DEV_UI
```

**Import order matters.** Components load before utilities so a utility can
always override a component class without a specificity fight. That is the same
layering Tailwind uses.

**A note on Tailwind.** Tailwind is not an installed dependency and the project
brief forbids adding one. `utilities.css` publishes the exact class names
`tailwind.config.js` declares, so components are written in Tailwind's
vocabulary today and installing Tailwind later needs no component edits.

---

## 1. Tokens

### Surfaces and ink

| Token | light-blue | dark-blue | Use |
| --- | --- | --- | --- |
| `--bg` | `#f4efe4` | `#14130f` | The page ground and the sidebar |
| `--surface` | `#fbf8f1` | `#1c1b17` | Cards |
| `--surface-raised` | `#ffffff` | `#24231e` | Modals, sheets, popovers, form controls |
| `--surface-sunken` | `#efe9dc` | `#100f0c` | Recessive rows, neutral badge grounds |
| `--ink` | `#16181d` | `#f4f1e9` | Headings and primary copy |
| `--ink-muted` | `#5c5f66` | `#aba79c` | Body copy and descriptions |
| `--ink-subtle` | `#7e818a` | `#7e7a70` | Eyebrows, timestamps, metadata |
| `--ink-inverse` | `#fbf8f1` | `#16181d` | Copy on a dark ground |

### Accent

| Token | light-blue | dark-blue | Use |
| --- | --- | --- | --- |
| `--accent` | `#2f5bd0` | `#8faef8` | Primary buttons, links, focus, progress, chart series |
| `--accent-deep` | `#24499f` | `#a9c2fa` | Hover and active |
| `--accent-soft` | `#6e8fe0` | `#5e7fc9` | Secondary rules where full accent would shout |
| `--accent-tint` | `#e6ebf9` | `#1e2635` | Selected rows, active nav pill, badge grounds |
| `--on-accent` | `#ffffff` | `#11151f` | Text on a filled accent |

`--on-accent` exists because the dark theme lifts the accent for legibility on a
dark ground, which makes white text on it fail. The token flips instead, so both
themes clear 4.5:1 without a single `dark:` variant anywhere.

### Lines, status, depth

| Token | Notes |
| --- | --- |
| `--border` | Hairline, `rgba(ink, 0.08)` light, `rgba(ink, 0.10)` dark |
| `--border-strong` | Form controls and secondary buttons |
| `--hover-tint` / `--active-tint` | Warm neutral, never blue |
| `--success` / `--success-tint` | Deep desaturated green on a very pale ground |
| `--warning` / `--warning-tint` | Deep amber |
| `--danger` / `--danger-tint` | Deep desaturated red, no neon, never `#ff0000` |
| `--shadow-sm` / `-md` / `-lg` | Two layer, wide, low opacity. Lift, not drop |
| `--press-inset` | The inset used on `:active` for filled buttons |

### Radius, space, motion

- `--radius-card` 22px, `--radius-control` 12px, `--radius-sm` 8px, `--radius-pill` 999px
- Space is a single 4px scale: `--space-1` (4px) through `--space-24` (96px)
- `--ease` is a pure ease out. `--dur-fast` 160ms, `--dur-base` 200ms, `--dur-slow` 250ms
- Nothing bounces, nothing overshoots

### Shell geometry

Set once, never overridden per screen: `--shell-sidebar-w` 248px,
`--shell-gutter` 24px (40px from 768px up), `--shell-max-w` 1120px,
`--shell-card-gap` 24px, `--shell-card-pad` 24px, `--shell-mobile-nav-h` 64px.

### Controls

`--control-h` and `--touch-target` are both 44px. **The compact variants change
type size, glyph size and horizontal padding only.** No interactive control in
the app is under 44px in either dimension.

---

## 2. Type scale

Playfair Display for headings. Hanken Grotesk for UI and body. JetBrains Mono
for anything numeric, tabular or code-like.

| Token | Size | Leading | Use |
| --- | --- | --- | --- |
| `--text-eyebrow` | 11px | 1.2 | The one uppercase, letterspaced style in the app |
| `--text-caption` | 12px | 1.45 | Metadata, helper text, timestamps |
| `--text-sm` | 13px | 1.45 | Descriptions, table cells, buttons |
| `--text-base` | 15px | 1.65 | Body, the reading size |
| `--text-lg` | 17px | 1.65 | The italic accent line |
| `--text-xl` | 20px | 1.3 | Card titles, sheet titles |
| `--text-2xl` | 24px | 1.3 | Modal titles |
| `--text-3xl` | 30px | 1.05 | Page heading below 768px |
| `--text-4xl` | 38px | 1.05 | Page heading from 768px |
| `--text-display` | 48px | 1.05 | Reserved, not currently used in the app |

Headings are tight at 1.05. Body is generous at 1.65. **Nothing is all caps
except the eyebrow.** Mono always carries tabular figures so decimals stack.

---

## 3. The rules

### Surfaces

Page on `--bg`, cards on `--surface`, overlays on `--surface-raised`. **Never
more than two surface levels visible on one screen.** Cards get
`--radius-card`, a `--border` hairline, and `--shadow-sm` or `--shadow-md`.

### Colour discipline

Blue is the only accent. It appears in primary buttons, the italic serif accent
line, active nav state, links, focus rings, progress fills and chart series.

It is **never** a background wash, **never** a gradient, **never** decorative
fill. Warm neutrals carry everything else. If a screen looks flat, the fix is
space and hierarchy, not another hue.

Two consequences worth stating, because both replaced something the previous
build did with colour:

- **Note categories** have no per category hue. A category is told apart by its
  name in a neutral badge.
- **Timetable slot types** have no per type hue. A filled hour takes the accent
  tint with an accent rule; recessive types (Break, Admin) take the sunken
  ground with a soft rule. The type name is always shown in mono.

### The heading pattern

Every major screen opens with an eyebrow in `--ink-subtle`, a Playfair heading
in `--ink`, then a second Playfair line in italic `--accent`. Once per screen,
never twice. Use `PageHeading`; do not hand roll it.

`PageHeading` also owns the loading and error variants of the accent line
(`accentLoading`, `accentError`), so the heading keeps its shape while the line
resolves and never blanks when it fails.

### Buttons

| Variant | Ground | Text | When |
| --- | --- | --- | --- |
| `primary` | `--accent` | `--on-accent` | The one main action on a screen |
| `secondary` | `--surface-raised` + `--border-strong` | `--ink` | Everything alongside it |
| `tertiary` | transparent | `--accent` | Inline, low weight |
| `ghost` | transparent | `--ink-muted` | Chrome level actions |
| `danger` | `--surface-raised` + danger hairline | `--danger` | Destructive, the default weight |
| `danger-solid` | `--danger` | `--surface-raised` | Irreversible only |

Every variant has hover, active, disabled and loading. **Loading replaces the
leading icon with a spinner and keeps the label**, so the button keeps its width
and nothing on the row shifts. `cd-btn--wrap` is for buttons whose label is a
sentence: it wraps and left aligns instead of forcing the page wider.

### Nav

Sidebar on `--bg`, not on a card. Active item is a soft `--accent-tint` pill
with `--ink` text and an accent icon. Inactive items are `--ink-muted` with line
icons. **Hover is a warm neutral tint, never blue.** Under 768px the sidebar
becomes a bottom bar carrying the same active state language.

### Tables and lists

Hairline row dividers, **no zebra striping, no vertical rules**. Numeric columns
are mono, right aligned and tabular. Generous row height. Row hover is a warm
tint; a selected row is `--accent-tint`.

### Forms

One control height across the app. `--border-strong` hairline,
`--radius-control`, blue focus ring. Label above, helper below, inline
validation in `--danger` **with a message and an icon**. Setting `error` on any
field renders the message and wires `aria-describedby`. There is no way to
produce a bare red outline with no explanation.

### Overlays

Modals on `--surface-raised`, generous padding, Playfair title, actions bottom
right with the primary rightmost. Both `Modal` and `Sheet` trap focus, close on
Escape, restore focus to whatever opened them and lock body scroll.

Toasts sit bottom right (bottom centre above the nav under 768px), hairline
border, a status bar down the leading edge, auto dismiss **paused while the
pointer or keyboard focus is on the toast**.

### Charts

Cream ground, `--accent` for the primary series, hairline axes, minimal
gridlines, mono tick labels. Never default chart library colours. If a chart
needs more than three colours, reconsider the chart.

### Motion

`--dur-fast` on hover and colour, `--dur-slow` on layout and modal entry, always
`--ease`. Under `prefers-reduced-motion: reduce` every transition and animation
collapses, the skeleton shimmer stops, and only the spinner, the thinking dots
and the Jarvis status dot keep a slow non flashing pulse so it stays clear that
something is still working.

---

## 4. States

Every screen builds five states in one pass.

- **Empty.** One short Playfair line, one sentence of guidance, one primary
  action, written as an invitation to start. Use `EmptyState`.
- **Loading.** Warm neutral skeletons shaped like the real layout.
  **No full page spinners anywhere.** Use `Skeleton` and `SkeletonText`.
- **Error.** Plain language: what happened and what to do next, with a retry.
  Never a bare error code as the whole message. Use `ErrorState` when the
  screen has nothing to show, `InlineError` when the rest of the screen still
  works.
- **Partial.** Show what loaded and mark what is missing. Never blank the whole
  screen. Use `PartialNotice`.
- **Success.** The happy path.

---

## 5. Accessibility, verified

These were measured in a real browser, not asserted. Both themes.

- **Contrast.** Twenty token pairs checked per theme, all pass:
  `--ink-muted` on `--surface` 6.03:1 light and 7.17:1 dark; white on
  `--accent` 5.95:1 light and `--on-accent` on `--accent` 8.32:1 dark; every
  status colour on its own tint between 5.08:1 and 7.47:1. `--ink-subtle` is
  supplementary or large text only and clears 3:1 on every ground it lands on
  (3.22:1 at worst). **If a pairing fails, fix the token, never add a one off.**
- **Never colour alone.** Every status carries an icon or a word. `Badge`
  attaches the matching icon by tone automatically. Verified in greyscale.
- **Focus.** `--accent` at 2px with 2px offset on every interactive element. No
  outline is removed anywhere without a replacement.
- **Touch targets.** No interactive control is under 44px in either dimension,
  at any breakpoint, in either theme.
- **Names and labels.** Every icon only button has an `aria-label`. Every field
  has an associated label. Zero unnamed controls, zero unlabelled fields.
- **Landmarks and headings.** One `<main>`, one `<nav>` visible at a time, one
  `h1` per screen followed by `h2` sections. A skip link is the first tab stop.
- **Responsive.** Five screens times four widths (375, 768, 1280, 1920) times
  two themes: forty combinations, zero horizontal overflow. Labels truncate,
  values never do.
- **Keyboard.** The three highest traffic flows pass end to end: Tab reaches
  every habit checkbox and Space toggles it; Ctrl or Cmd plus Enter saves a
  note; Enter opens an hour, focus stays trapped in the dialog, Escape closes it
  and focus returns to the row that opened it.
- **No flash.** With `dark-blue` stored, `data-theme` is stamped at ~17ms and
  first paint happens at ~52ms, so the correct theme is in place before
  anything is painted.

---

## 6. Themes

`light-blue` is the default and canonical theme. `dark-blue` is a full
counterpart: warm neutral darks, the accent lifted for contrast, status colours
re derived rather than reused.

`ThemeProvider` resolves the preference from storage, falling back to
`light-blue`, and writes `data-theme` on `<html>`. The pre paint script
(`THEME_INIT_SCRIPT`, exported from the same file so the key and the theme list
have one home) is injected into `<head>` in `app/layout.jsx`. There is no
`index.html` in the App Router; head is the equivalent hook.

Settings renders the choice as live preview cards. Each card scopes
`data-theme` to its own preview, so both options show their real ground, card,
accent and text sample whichever theme is currently active.

### Adding a third theme

One new block in `tokens.css` and nothing else:

```css
[data-theme='your-theme'] {
  color-scheme: light;   /* or dark */
  /* redeclare only the colour tokens: surfaces, ink, accent, on-accent,
     borders, tints, status, shadows, scrim, scrollbar, skeleton */
}
```

Then add one entry to `THEMES` in `ThemeContext.jsx`. The theme independent
scales (space, radius, type, motion, shell geometry) sit outside the theme
blocks and are never redefined. Every component already resolves through
variables, so nothing else changes.

---

## 7. Working in this system

1. **No component contains a colour.** No hex, no `rgb()`, no arbitrary value.
   The only literals outside `tokens.css` are the two `themeColor` values in
   `app/layout.jsx`, because a meta tag cannot read a CSS variable. Grep before
   committing:
   `grep -rnE '#[0-9a-fA-F]{3,8}|rgba?\(' web/src web/app --include=*.jsx --include=*.js`
2. **Use a primitive.** If you are writing a bare `<button>` or `<input>`, stop
   and use `Button` or `Input`. If a primitive is missing a state, add it to the
   primitive.
3. **Never override shell geometry per screen.** Page gutters, max width and
   card spacing come from `Page` and the shell tokens.
4. **One `PageHeading` per screen.** No exceptions.
5. **Check `/dev/ui` before and after.** Set `NEXT_PUBLIC_ENABLE_DEV_UI=true` in
   `web/.env.local`. Every primitive in every state in both themes on one page.
6. **Build all five states in the same pass.** A screen with only a happy path
   is not finished.

### Copy

Plain, direct and calm. No em dashes. No emoji, ever: the icon set is line style
only. Banned outright: revolutionary, game-changing, unlock, supercharge,
effortless, seamless, empower, journey, cutting-edge, harness, leverage.

The only em dashes left in the codebase are inside the three model prompt
strings in `lib/store.js`, `NotesScreen.jsx` and `TimetableScreen.jsx`. Those
are inputs to the assistant, never rendered to the screen, and are preserved
byte for byte so its behaviour does not change. Do not tidy them.

### Also banned

Gradient text, glassmorphism, backdrop blur, purple, neon. The one gradient in
the codebase is the skeleton shimmer, which runs transparent to a neutral token
to transparent and switches off entirely under reduced motion.
