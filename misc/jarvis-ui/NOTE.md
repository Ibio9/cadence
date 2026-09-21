# JARVIS interface pieces, retired

Moved here rather than deleted. Nothing in this folder is built or imported.

## History.tsx

The history popup: a list of everything shown this session, opened with the
left-hand four. Retired on 21 September 2026 when history became the HISTORY
tab along the top (`HistoryPanel` in `src/ui/Tabs.tsx`), which keeps entries
across sessions, groups them by day and filters them by kind. The left-hand
four now opens that tab.

It will not compile as it stands: it reads `historyOpen` from the store, which
went when the popup did. To bring it back, restore that flag (`historyOpen`,
set false by `restoreBlade`, flipped by `toggleHistory`), move the file back
to `src/ui/`, and render `<History />` in `App.tsx`. Its styles (`.history`,
`.history-*`) are still in `src/index.css`.
