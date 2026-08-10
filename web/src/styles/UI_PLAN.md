# Cadence UI Plan

Map of the app before any CSS was written. Build order: tokens, primitives, layout shell, screens.
Tick boxes are updated as work lands.

---

## 0. Context and constraints

Cadence is a Next.js 14 App Router app (`web/`) with a single public route. Navigation between
the four working areas is component state inside that route, not the router. An Express + Prisma
API lives in `server/` and is out of scope: no server code, data model, API contract, routing or
business logic was changed.

Two things in the original spec do not match this repo, and both are recorded here rather than
worked around silently:

- **Tailwind is not installed** and the hard constraints forbid new dependencies. The design
  system therefore ships as a hand written token driven CSS layer using the exact semantic class
  names the spec asks for (`bg-surface`, `text-ink-muted`, `border-hairline`, `bg-accent-tint`,
  `shadow-card`, `rounded-card`, `font-display`, `font-mono`). `tailwind.config.js` is written and
  wired to the same tokens so installing Tailwind later is a drop in with no component edits.
- **There is no `index.html`** (App Router). The pre paint theme script lives in
  `web/app/layout.jsx` `<head>` instead, which is the App Router equivalent.

---

## 1. Routes and screens

| Route | Screen | Purpose |
| --- | --- | --- |
| `/` | **Today** (default view) | The daily brief plus the discipline checklist: salah, study, training, reading. One glance answer to "what have I held today". |
| `/` | **Notes** | Fast capture inbox with categories, search and an inline editor. Notes filed under To Do are sent to Jarvis to be placed on today's timetable. |
| `/` | **Timetable** | Hour by hour plan for the current day, 06:00 to 23:00, editable per slot, generatable in one action from Jarvis. |
| `/` | **Jarvis** | Conversation with the resident assistant, primed with today's checklist and timetable. |
| `/` | **Settings** | Theme picker with live preview cards, plus appearance and data controls. Added as a fifth view in the same client side view state, not a new route. |
| `/dev/ui` | **Primitive gallery** | Every primitive in every state in both themes on one page. Gated behind `NEXT_PUBLIC_ENABLE_DEV_UI`. |

There is no auth, onboarding, marketing or legal surface in this app, so none is invented.
Settings did not exist and was required by Step 7 (theme control as live preview cards); it is a
view inside the existing route, so routing is unchanged.

- [x] Routes mapped
- [x] Screens named

---

## 2. Shared UI inventory

Primitives (Step 4), all built with every state:

- [x] `PageHeading` eyebrow, serif heading, italic accent line, optional actions
- [x] `Card` plus `CardHeader`, `CardBody`, `CardFooter`
- [x] `Button` primary, secondary, tertiary, danger, danger solid, ghost; sm/md/lg; hover, active, disabled, loading
- [x] `IconButton` same variants, square, always `aria-label`
- [x] `Input` label, helper, error, prefix/suffix, disabled, invalid
- [x] `Select` native, same control height and ring
- [x] `Textarea` auto sizing off, same control language
- [x] `Checkbox` unchecked, checked, indeterminate, disabled, error
- [x] `Radio` and `RadioGroup`
- [x] `Switch` on, off, disabled, with label and description
- [x] `Badge` neutral, accent, success, warning, danger; each with an icon so status is never colour only
- [x] `Tabs` underline and pill variants, keyboard arrow navigation
- [x] `Table` hairline rows, mono numeric right aligned columns, hover, selected, empty, loading
- [x] `Modal` focus trap, Escape, Playfair title, actions bottom right
- [x] `Sheet` right and bottom edges, same overlay rules
- [x] `Toast` plus `ToastProvider`, bottom right, auto dismiss with pause on hover
- [x] `Tooltip` hover and focus, keyboard reachable
- [x] `Skeleton` plus `SkeletonText`, warm neutral, layout shaped
- [x] `EmptyState` serif line, one sentence, one action
- [x] `ErrorState` plain language plus retry
- [x] `Spinner` sm/md/lg, inherits colour
- [x] `Avatar` initials, sizes, with and without image
- [x] `Pagination` first/prev/next/last, current page, truncation

App level shared UI:

- [x] `AppShell` sidebar plus main column, page gutters, max content width, card rhythm
- [x] `Sidebar` desktop, active accent tint pill, line icons
- [x] `MobileNav` bottom bar under 768px with the same active state language
- [x] `Icon` set, single hand built line icon family, 24 grid, 1.5 stroke
- [x] `ProgressRing` accent fill on hairline track, mono percentage

**Charts.** None of the five screens has a series to plot: the app holds one day at a time and
the API exposes no history to the client. No chart was invented to fill the gap. The chart
contract is still written down and the classes exist (`.cd-chart__axis`, `__grid`, `__series`,
`__label`) so the first real chart lands on cream with `--accent` for the primary series,
hairline axes and mono tick labels rather than a library default palette.

Also not needed by this app and therefore not built: data grid with column sorting, file upload,
date picker, command palette.

- [x] Inventory complete

---

## 3. States per screen

Every screen builds the happy path plus empty, loading, error and partial in the same pass.

| Screen | Empty | Loading | Error | Partial | Success |
| --- | --- | --- | --- | --- | --- |
| **Today** | No habits on the list: invitation to add the first one | Brief line and checklist skeletons in the real layout shape | Brief request failed: inline retry inside the brief card, checklist still usable | Checklist rendered from local state while the brief is still failing or loading, marked as unavailable | Full brief, ring at percentage complete, grouped habits |
| **Notes** | No notes yet: capture card stays, list area invites the first note | Note card skeletons in the masonry shape | Auto schedule failed: toast in plain language with retry | Notes list rendered while the auto schedule for a To Do note is still resolving or failed | Filtered, searchable list with editor pane |
| **Timetable** | No slots for today: invitation to generate or add one | Row skeletons matching the 18 hour grid | Generation failed: error card above the grid with retry, grid keeps existing slots | Some hours returned by Jarvis, rest empty and clickable, count shown | Full day with now indicator and legend |
| **Jarvis** | No messages: serif invitation plus three starter prompts | Thinking bubble in the reply position, orb active | Request failed: inline error row with retry that resends the last message | History rendered with the failed turn marked, earlier turns intact | Threaded conversation |
| **Settings** | n/a, always populated | Skeleton preview cards on first paint before theme resolves | Preference write failed: inline notice, theme still applies for the session | Theme applied locally but not persisted, stated plainly | Theme cards, appearance and data controls |
| **/dev/ui** | n/a | n/a | Disabled notice when the env flag is off | n/a | Full gallery |

- [x] States enumerated
- [x] States built

---

## 4. Highest traffic flows

These get the full keyboard pass and the closest breakpoint checking.

1. **Tick the day off.** Open Today, read the brief, toggle habits, watch the ring move.
   Every habit row is a real checkbox: reachable by Tab, toggled by Space, renameable by Enter.
2. **Capture then schedule.** Notes, type into the capture card, pick a category, Cmd or Ctrl
   plus Enter to save. Choosing To Do hands the text to Jarvis and places it on today's timetable,
   with a toast reporting where it landed or why it could not.
3. **Generate the day.** Timetable, optional prompt, one primary action, the grid fills. Any slot
   is then editable in a modal that traps focus and closes on Escape.

- [x] Flows identified
- [x] Keyboard pass done on all three

---

## 5. Build order

- [x] **Tokens** `src/styles/tokens.css`, both themes, wired into `tailwind.config.js`
- [x] **Base** reset, elements, focus ring, reduced motion, scrollbar
- [x] **Utilities** semantic layout, spacing, type, colour, border, radius, shadow, responsive
- [x] **Primitives** all 23, documented, gallery at `/dev/ui`
- [x] **Shell** `AppShell`, `Sidebar`, `MobileNav`, gutters and rhythm fixed once
- [x] **Screens** Today, Notes, Timetable, Jarvis, Settings
- [x] **Themes** `light-blue` default, `dark-blue` counterpart, no flash on load
- [x] **Responsive and accessibility** 375 / 768 / 1280 / 1920, contrast, focus, labels, greyscale
- [x] **Docs** `src/styles/DESIGN_SYSTEM.md`
