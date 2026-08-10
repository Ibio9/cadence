'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0a0f',
  surface:  '#0f1117',
  card:     '#13161f',
  border:   '#1e2433',
  borderHi: '#2a3347',
  blue:     '#3b82f6',
  indigo:   '#6366f1',
  txt:      '#e2e8f0',
  txtDim:   '#94a3b8',
  txtFaint: '#475569',
  green:    '#22c55e',
  amber:    '#f59e0b',
  red:      '#ef4444',
  purple:   '#a855f7',
};

const s = {
  // layout
  fill: { display: 'flex', flexDirection: 'column', height: '100%', background: C.bg },
  row:  { display: 'flex', alignItems: 'center' },
  col:  { display: 'flex', flexDirection: 'column' },
  // text
  label: { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.txtFaint },
  // card
  card: {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '16px',
  },
  // input
  input: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '9px 13px', color: C.txt,
    width: '100%', fontSize: 14,
  },
  // button primary
  btnPrimary: {
    background: C.blue, color: '#fff', borderRadius: 8,
    padding: '9px 18px', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', border: 'none',
    transition: 'opacity 0.15s',
  },
  // badge
  badge: (color) => ({
    background: color + '22', color, borderRadius: 5,
    padding: '2px 8px', fontSize: 11, fontWeight: 600,
    letterSpacing: '0.04em',
  }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const todayKey = () => {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};

const ls = {
  get: (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const formatTime = (date = new Date()) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const formatDate = (date = new Date()) =>
  date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const NOTE_CATEGORIES = ['Ideas', 'Study', 'Markets', 'Business', 'Personal', 'TARA', 'StudentSolve'];
const CAT_COLORS = {
  Ideas: C.indigo, Study: C.blue, Markets: C.green,
  Business: C.amber, Personal: C.purple, TARA: C.red, StudentSolve: '#06b6d4',
};

const SLOT_COLORS = {
  'Study':      { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  'Build':      { bg: '#1a1f3a', border: '#6366f1', text: '#a5b4fc' },
  'Training':   { bg: '#1a2e1a', border: '#22c55e', text: '#86efac' },
  'Admin':      { bg: '#2a2000', border: '#f59e0b', text: '#fcd34d' },
  'Break':      { bg: '#1a1a1a', border: '#475569', text: '#94a3b8' },
  'Deep Work':  { bg: '#2a1a3a', border: '#a855f7', text: '#d8b4fe' },
  'Markets':    { bg: '#1a2e1a', border: '#10b981', text: '#6ee7b7' },
};

const DEFAULT_HABITS = [
  { id: 'read',     emoji: '📚', label: 'Read 30 pages' },
  { id: 'podcast',  emoji: '🎧', label: 'Podcast / lecture (30 min)' },
  { id: 'tara',     emoji: '📝', label: 'TARA prep (min 45 min)' },
  { id: 'alevel',   emoji: '📖', label: 'A-level study block (2 hrs)' },
  { id: 'training', emoji: '🥊', label: 'Muay Thai / training' },
  { id: 'markets',  emoji: '📊', label: 'Review markets (MNQ / NQ)' },
  { id: 'walk',     emoji: '🏃', label: 'Movement / walk' },
  { id: 'macros',   emoji: '🥗', label: 'Track macros (target 66kg)' },
];

const JARVIS_SYSTEM = (checklist, timetable) => `You are Jarvis — Ibrahim Malik's personal AI. You know him completely.

Ibrahim is 17, at Harris Westminster Sixth Form. A-levels: Further Maths, Maths, Economics, Philosophy. Target: Oxford PPE via TARA (October 2026, aiming 8.0+), St Hilda's College. GCSEs: 9 A*s, 1 A.

He has CFA Investment Foundations (89%, age 14), Bloomberg certified, UK Economics Olympiad top 23, GBEO finalist. Placements at BNP Paribas, Société Générale (algo trading desk), Trading Performance Centre (Quantower), Schroders. He trades MNQ futures, built NQConfluenceScalper in C#.

His main build is StudentSolve — AI revision platform for UK GCSE/A-Level, September 2026 launch. Also: dental consent MCQ with his uncle (~£100/mo/practice), clinic blood results portal. He's done a lot of startup kill-tests (freight invoicing, MTD bookkeeping, tenancy deposits, probate copilot — all killed on saturation or distribution).

He did Muay Thai at Tiger Muay Thai Phuket in July 2026. 66kg/180cm. Looking for a BJJ gym in NW London. Mensa. VEX Robotics National Champion 2023. 44 countries. PADI diver.

Currently reading Uncommon Knowledge. Just finished Liar's Poker, More Money Than God.

Real tension: StudentSolve launch (September) + TARA prep (October) + A-levels + multiple live builds. Be honest about this allocation problem when relevant, not just validating.

Today's checklist status: ${checklist}
Today's timetable: ${timetable}

Be direct, specific, no filler. You know Ibrahim — don't explain things he already knows. Challenge him when warranted. When he asks about scheduling, use his actual timetable. When he asks about study, be aware of TARA and his A-level subjects. When he asks about markets, engage properly.`;

// ─── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 80, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={pct === 100 ? C.green : C.blue} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
    </svg>
  );
}

// ─── Tab: Today ───────────────────────────────────────────────────────────────
function TodayTab({ checklistState, setChecklistState }) {
  const key = todayKey();
  const [time, setTime] = useState(formatTime());
  const [customInput, setCustomInput] = useState('');
  const [timeLog, setTimeLog] = useState(() => ls.get('cadence_timelog_' + key, {}));

  useEffect(() => {
    const t = setInterval(() => setTime(formatTime()), 30000);
    return () => clearInterval(t);
  }, []);

  const habits = checklistState.habits;
  const checked = checklistState.checked;

  const toggle = (id) => {
    const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id];
    const nextState = { ...checklistState, checked: next };
    setChecklistState(nextState);
    ls.set('cadence_checklist_' + key, nextState);

    // update streaks
    const streaks = ls.get('cadence_streaks', {});
    if (!checked.includes(id)) {
      streaks[id] = (streaks[id] || 0) + 1;
    } else {
      streaks[id] = Math.max(0, (streaks[id] || 1) - 1);
    }
    ls.set('cadence_streaks', streaks);
  };

  const addCustom = () => {
    const label = customInput.trim();
    if (!label) return;
    const id = 'custom_' + Date.now();
    const nextHabits = [...habits, { id, emoji: '✏️', label }];
    const nextState = { ...checklistState, habits: nextHabits };
    setChecklistState(nextState);
    ls.set('cadence_checklist_' + key, nextState);
    setCustomInput('');
  };

  const streaks = ls.get('cadence_streaks', {});
  const pct = habits.length ? Math.round((checked.length / habits.length) * 100) : 0;

  const motLines = [
    'TARA is 8 weeks out. Every session compounds.',
    'StudentSolve launches in September. Today\'s code is tomorrow\'s users.',
    'The Oxford interview rewards depth, not breadth. Go deep today.',
    'Liar\'s Poker taught you: edge is everything. Build yours.',
    'Markets open. MNQ is live. Stay sharp.',
  ];
  const mot = motLines[new Date().getDay() % motLines.length];

  return (
    <div style={{ ...s.col, gap: 20, padding: '24px', overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <div style={{ ...s.col, gap: 4 }}>
        <div style={{ fontSize: 13, color: C.txtDim }}>{formatDate()}</div>
        <div style={{ fontSize: 14, color: C.blue, fontStyle: 'italic' }}>{mot}</div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Done today', val: `${checked.length} / ${habits.length}` },
          { label: 'Time', val: time },
          { label: 'Streak (avg)', val: `${habits.length ? Math.round(Object.values(streaks).reduce((a,b)=>a+b,0)/Math.max(habits.length,1)) : 0}d` },
        ].map(({ label, val }) => (
          <div key={label} style={{ ...s.card, textAlign: 'center' }}>
            <div style={{ ...s.label, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.txt }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Progress + Checklist */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
        {/* Ring */}
        <div style={{ ...s.card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 24px' }}>
          <div style={{ position: 'relative' }}>
            <ProgressRing pct={pct} size={90} stroke={8} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: C.txt,
            }}>
              {pct}%
            </div>
          </div>
          <div style={{ ...s.label }}>today</div>
        </div>

        {/* Habits list */}
        <div style={{ ...s.col, gap: 8 }}>
          {habits.map((h) => {
            const done = checked.includes(h.id);
            const streak = streaks[h.id] || 0;
            return (
              <div
                key={h.id}
                onClick={() => toggle(h.id)}
                style={{
                  ...s.card, ...s.row, gap: 12, cursor: 'pointer',
                  borderColor: done ? C.blue + '55' : C.border,
                  background: done ? C.blue + '0d' : C.card,
                  padding: '12px 16px',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  border: `2px solid ${done ? C.blue : C.borderHi}`,
                  background: done ? C.blue : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                  {done && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: 16 }}>{h.emoji}</span>
                <span style={{ flex: 1, color: done ? C.txtDim : C.txt, textDecoration: done ? 'line-through' : 'none' }}>
                  {h.label}
                </span>
                {streak > 0 && (
                  <span style={{ ...s.badge(C.amber), fontSize: 11 }}>🔥 {streak}d</span>
                )}
              </div>
            );
          })}

          {/* Add custom */}
          <div style={{ ...s.row, gap: 8, marginTop: 4 }}>
            <input
              style={{ ...s.input }}
              placeholder="Add habit…"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
            />
            <button style={{ ...s.btnPrimary, whiteSpace: 'nowrap' }} onClick={addCustom}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Notes ───────────────────────────────────────────────────────────────
function NotesTab() {
  const [notes, setNotes] = useState(() => ls.get('cadence_notes', []));
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [capturing, setCapturing] = useState('');
  const [capCat, setCapCat] = useState('Ideas');
  const [expanded, setExpanded] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [customCats, setCustomCats] = useState(() => ls.get('cadence_note_cats', []));
  const [newCat, setNewCat] = useState('');
  const saveTimer = useRef(null);

  const allCats = [...NOTE_CATEGORIES, ...customCats];

  const save = (next) => {
    setNotes(next);
    ls.set('cadence_notes', next);
  };

  const addNote = () => {
    if (!capturing.trim()) return;
    const note = {
      id: Date.now(),
      title: capturing.trim().split('\n')[0].slice(0, 60),
      body: capturing.trim(),
      category: capCat,
      ts: Date.now(),
    };
    save([note, ...notes]);
    setCapturing('');
  };

  const deleteNote = (id) => {
    save(notes.filter(n => n.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const openNote = (note) => {
    setExpanded(note.id);
    setEditBody(note.body);
  };

  const handleEdit = (val) => {
    setEditBody(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(notes.map(n => n.id === expanded ? { ...n, body: val, title: val.split('\n')[0].slice(0, 60) } : n));
    }, 600);
  };

  const addCat = () => {
    if (!newCat.trim() || allCats.includes(newCat.trim())) return;
    const next = [...customCats, newCat.trim()];
    setCustomCats(next);
    ls.set('cadence_note_cats', next);
    setNewCat('');
  };

  const filtered = notes.filter(n => {
    const matchCat = catFilter === 'All' || n.category === catFilter;
    const matchSearch = !search || n.body.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const color = (cat) => CAT_COLORS[cat] || C.indigo;

  const expandedNote = notes.find(n => n.id === expanded);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: expanded ? '1fr 1fr' : '1fr', height: '100%', overflow: 'hidden' }}>
      {/* Left pane */}
      <div style={{ ...s.col, gap: 0, overflow: 'hidden', borderRight: expanded ? `1px solid ${C.border}` : 'none' }}>
        {/* Capture bar */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, ...s.col, gap: 10 }}>
          <textarea
            style={{ ...s.input, resize: 'none', minHeight: 60, borderRadius: 8, padding: '10px 13px' }}
            placeholder="Capture a note… (Enter to save)"
            value={capturing}
            onChange={e => setCapturing(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote(); }}
          />
          <div style={{ ...s.row, gap: 8 }}>
            <select
              style={{ ...s.input, width: 'auto', flex: 1, padding: '7px 12px', borderRadius: 8 }}
              value={capCat} onChange={e => setCapCat(e.target.value)}
            >
              {allCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button style={{ ...s.btnPrimary }} onClick={addNote}>Save ⌘↵</button>
          </div>
        </div>

        {/* Search + filter */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, ...s.col, gap: 10 }}>
          <input
            style={{ ...s.input }}
            placeholder="Search notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ ...s.row, gap: 6, flexWrap: 'wrap' }}>
            {['All', ...allCats].map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: `1px solid ${catFilter === c ? color(c) : C.border}`,
                  background: catFilter === c ? color(c) + '22' : 'transparent',
                  color: catFilter === c ? color(c) : C.txtDim,
                  transition: 'all 0.1s',
                }}
              >{c}</button>
            ))}
            <div style={{ ...s.row, gap: 4, marginLeft: 4 }}>
              <input
                style={{ ...s.input, width: 90, padding: '4px 8px', fontSize: 12, borderRadius: 6 }}
                placeholder="+ category"
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCat()}
              />
            </div>
          </div>
        </div>

        {/* Notes list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', ...s.col, gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ color: C.txtFaint, fontSize: 13, marginTop: 20, textAlign: 'center' }}>
              {search ? 'No notes match your search.' : 'No notes yet. Start capturing.'}
            </div>
          )}
          {filtered.map(n => (
            <div
              key={n.id}
              onClick={() => expanded === n.id ? setExpanded(null) : openNote(n)}
              style={{
                ...s.card, cursor: 'pointer', padding: '12px 14px',
                borderColor: expanded === n.id ? color(n.category) + '55' : C.border,
                background: expanded === n.id ? color(n.category) + '0a' : C.card,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ ...s.row, gap: 8 }}>
                  <span style={{ ...s.badge(color(n.category)) }}>{n.category}</span>
                </div>
                <div style={{ ...s.row, gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.txtFaint }}>
                    {new Date(n.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteNote(n.id); }}
                    style={{ color: C.txtFaint, fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                  >×</button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.txt, fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.title || '(untitled)'}
              </div>
              <div style={{ fontSize: 12, color: C.txtDim, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {n.body.slice(0, 200)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right pane — note editor */}
      {expanded && expandedNote && (
        <div style={{ ...s.col, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, ...s.row, justifyContent: 'space-between' }}>
            <span style={{ ...s.badge(color(expandedNote.category)) }}>{expandedNote.category}</span>
            <div style={{ ...s.row, gap: 10 }}>
              <span style={{ fontSize: 11, color: C.txtFaint }}>auto-saving</span>
              <button
                onClick={() => deleteNote(expandedNote.id)}
                style={{ color: C.red, fontSize: 13, fontWeight: 500 }}
              >Delete</button>
              <button onClick={() => setExpanded(null)} style={{ color: C.txtDim, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
          </div>
          <textarea
            style={{
              flex: 1, background: 'transparent', color: C.txt, fontSize: 14,
              padding: '20px', resize: 'none', lineHeight: 1.7,
              fontFamily: 'inherit', border: 'none', outline: 'none',
            }}
            value={editBody}
            onChange={e => handleEdit(e.target.value)}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

// ─── Tab: Timetable ───────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00–23:00
const SLOT_TYPES = Object.keys(SLOT_COLORS);

function TimetableTab() {
  const key = 'cadence_timetable_' + todayKey();
  const [slots, setSlots] = useState(() => ls.get(key, {}));
  const [editHour, setEditHour] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState('Study');
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genError, setGenError] = useState('');

  const saveSlots = (next) => { setSlots(next); ls.set(key, next); };

  const openEdit = (hour) => {
    setEditHour(hour);
    const existing = slots[hour];
    setEditLabel(existing?.label || '');
    setEditType(existing?.type || 'Study');
  };

  const saveSlot = () => {
    if (!editLabel.trim()) {
      const next = { ...slots };
      delete next[editHour];
      saveSlots(next);
    } else {
      saveSlots({ ...slots, [editHour]: { label: editLabel.trim(), type: editType } });
    }
    setEditHour(null);
  };

  const clearSlot = (hour) => {
    const next = { ...slots };
    delete next[hour];
    saveSlots(next);
  };

  const generate = async () => {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const sysPrompt = `You are scheduling Ibrahim Malik's day. He is 17, at Harris Westminster Sixth Form, A-levels Further Maths/Maths/Economics/Philosophy. Main priorities: StudentSolve (AI revision platform, September 2026 launch), TARA exam prep (Oxford PPE, October 2026), A-level study, markets (MNQ trading), and training (Muay Thai/BJJ). Wake typically 6-7am. Given his tasks for today, create a realistic hour-by-hour schedule from 06:00 to 23:00. Respond ONLY with a valid JSON object where keys are hours as numbers (6-22) and values are objects with "label" (string, brief task name) and "type" (one of: Study, Build, Training, Admin, Break, Deep Work, Markets). Example: {"7":{"label":"Morning routine","type":"Admin"},"8":{"label":"TARA past paper","type":"Deep Work"}}. No explanation, only the JSON object.`;

      const result = await api.jarvis(`${sysPrompt}\n\nUser's tasks for today: ${genPrompt}`, todayKey());
      // api.jarvis returns { reply } based on the API structure
      const text = result?.reply || result?.message || JSON.stringify(result);
      // extract JSON
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]);
      // validate and normalise
      const next = {};
      for (const [k, v] of Object.entries(parsed)) {
        const hour = parseInt(k, 10);
        if (hour >= 6 && hour <= 22 && v?.label) {
          next[hour] = { label: v.label, type: SLOT_TYPES.includes(v.type) ? v.type : 'Study' };
        }
      }
      saveSlots(next);
    } catch (e) {
      setGenError('Generation failed: ' + e.message);
    }
    setGenerating(false);
  };

  const now = new Date();
  const currentHour = now.getHours();

  return (
    <div style={{ ...s.col, height: '100%', overflow: 'hidden' }}>
      {/* Generate bar */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, ...s.col, gap: 10 }}>
        <div style={{ ...s.row, gap: 8 }}>
          <input
            style={{ ...s.input, flex: 1 }}
            placeholder="What do you need to get done today? Jarvis will schedule it…"
            value={genPrompt}
            onChange={e => setGenPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            disabled={generating}
          />
          <button
            style={{ ...s.btnPrimary, opacity: generating ? 0.6 : 1, whiteSpace: 'nowrap' }}
            onClick={generate}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate Schedule'}
          </button>
        </div>
        {genError && <div style={{ color: C.red, fontSize: 12 }}>{genError}</div>}
        <div style={{ ...s.row, gap: 8, flexWrap: 'wrap' }}>
          {SLOT_TYPES.map(t => (
            <div key={t} style={{ ...s.row, gap: 5, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: SLOT_COLORS[t].border }} />
              <span style={{ color: C.txtDim }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Slot editor modal */}
      {editHour !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setEditHour(null)}>
          <div
            style={{ ...s.card, width: 340, padding: 24, ...s.col, gap: 14 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {String(editHour).padStart(2,'0')}:00 – {String(editHour+1).padStart(2,'0')}:00
            </div>
            <input
              style={{ ...s.input }}
              placeholder="What's happening this hour?"
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveSlot()}
              autoFocus
            />
            <select
              style={{ ...s.input, padding: '9px 13px', borderRadius: 8 }}
              value={editType} onChange={e => setEditType(e.target.value)}
            >
              {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ ...s.row, gap: 8, justifyContent: 'flex-end' }}>
              {slots[editHour] && (
                <button
                  style={{ color: C.red, fontSize: 13, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.red}33` }}
                  onClick={() => { clearSlot(editHour); setEditHour(null); }}
                >Clear</button>
              )}
              <button style={{ ...s.btnPrimary }} onClick={saveSlot}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Hour grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', ...s.col, gap: 4 }}>
        {HOURS.map(hour => {
          const slot = slots[hour];
          const isNow = hour === currentHour;
          const colors = slot ? SLOT_COLORS[slot.type] || SLOT_COLORS['Study'] : null;
          return (
            <div
              key={hour}
              onClick={() => openEdit(hour)}
              style={{
                ...s.row, gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${isNow ? C.blue : slot ? colors.border + '55' : C.border}`,
                background: isNow && !slot ? C.blue + '0a' : slot ? colors.bg : 'transparent',
                transition: 'all 0.1s',
                minHeight: 44,
              }}
            >
              <div style={{ width: 44, fontSize: 12, fontWeight: 600, color: isNow ? C.blue : C.txtFaint, flexShrink: 0 }}>
                {String(hour).padStart(2,'0')}:00
              </div>
              {slot ? (
                <>
                  <div style={{ flex: 1, fontSize: 13, color: colors.text, fontWeight: 500 }}>{slot.label}</div>
                  <span style={{ ...s.badge(colors.border), fontSize: 10 }}>{slot.type}</span>
                </>
              ) : (
                <div style={{ flex: 1, fontSize: 12, color: C.txtFaint }}>
                  {isNow ? '← now · click to add' : 'click to add'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Jarvis ──────────────────────────────────────────────────────────────
function JarvisTab({ checklistState }) {
  const [messages, setMessages] = useState(() => ls.get('cadence_jarvis_history', []));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const getChecklistStatus = () => {
    const { habits, checked } = checklistState;
    const done = habits.filter(h => checked.includes(h.id)).map(h => h.label);
    const todo = habits.filter(h => !checked.includes(h.id)).map(h => h.label);
    return `Done: ${done.join(', ') || 'none'}. Still to do: ${todo.join(', ') || 'all done'}. Progress: ${checked.length}/${habits.length}`;
  };

  const getTimetableStatus = () => {
    const key = 'cadence_timetable_' + todayKey();
    const slots = ls.get(key, {});
    const entries = Object.entries(slots)
      .sort(([a], [b]) => +a - +b)
      .map(([h, v]) => `${String(h).padStart(2,'0')}:00 ${v.label} (${v.type})`);
    return entries.length ? entries.join(', ') : 'No timetable set';
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text, ts: Date.now() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const systemPrompt = JARVIS_SYSTEM(getChecklistStatus(), getTimetableStatus());
      // Build context for API: inject system as first user message (api.jarvis takes single message)
      const contextMsg = `[SYSTEM CONTEXT]\n${systemPrompt}\n\n[CONVERSATION SO FAR]\n${
        messages.slice(-10).map(m => `${m.role === 'user' ? 'Ibrahim' : 'Jarvis'}: ${m.content}`).join('\n')
      }\n\n[NEW MESSAGE]\nIbrahim: ${text}`;

      const result = await api.jarvis(contextMsg, todayKey());
      const reply = result?.reply || result?.message || (typeof result === 'string' ? result : JSON.stringify(result));

      const jarvisMsg = { role: 'jarvis', content: reply, ts: Date.now() };
      const finalMsgs = [...nextMsgs, jarvisMsg];
      setMessages(finalMsgs);
      ls.set('cadence_jarvis_history', finalMsgs.slice(-60));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const clearHistory = () => {
    setMessages([]);
    ls.set('cadence_jarvis_history', []);
  };

  return (
    <div style={{ ...s.col, height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, ...s.row, justifyContent: 'space-between' }}>
        <div style={{ ...s.row, gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Jarvis</span>
          <span style={{ color: C.txtFaint, fontSize: 12 }}>— knows your day</span>
        </div>
        <button onClick={clearHistory} style={{ color: C.txtFaint, fontSize: 12 }}>Clear history</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', ...s.col, gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ color: C.txtFaint, fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Jarvis is ready. Ask about your schedule, TARA prep, StudentSolve, markets — anything.
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ ...s.row, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              {!isUser && (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: C.indigo + '33',
                  border: `1px solid ${C.indigo}55`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 13, flexShrink: 0, marginRight: 10, alignSelf: 'flex-end',
                }}>J</div>
              )}
              <div style={{
                maxWidth: '75%',
                background: isUser ? C.blue + '22' : C.card,
                border: `1px solid ${isUser ? C.blue + '44' : C.border}`,
                borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '10px 14px',
                fontSize: 14, lineHeight: 1.65, color: C.txt,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {m.content}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ ...s.row, gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: C.indigo + '33',
              border: `1px solid ${C.indigo}55`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, flexShrink: 0,
            }}>J</div>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: '14px 14px 14px 4px', padding: '12px 16px',
              ...s.row, gap: 5,
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: C.blue,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        {error && (
          <div style={{ color: C.red, fontSize: 12, textAlign: 'center' }}>Error: {error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, ...s.row, gap: 10 }}>
        <input
          ref={inputRef}
          style={{ ...s.input, flex: 1, padding: '11px 16px' }}
          placeholder="Ask Jarvis anything…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={loading}
        />
        <button
          style={{ ...s.btnPrimary, opacity: loading || !input.trim() ? 0.5 : 1 }}
          onClick={send}
          disabled={loading || !input.trim()}
        >Send</button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'today',     label: 'Today' },
  { id: 'notes',     label: 'Notes' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'jarvis',    label: 'Jarvis' },
];

export default function Cadence() {
  const [tab, setTab] = useState('today');

  const defaultChecklist = { habits: DEFAULT_HABITS, checked: [] };
  const [checklistState, setChecklistState] = useState(() => {
    const stored = ls.get('cadence_checklist_' + todayKey(), null);
    if (stored && stored.habits) return stored;
    return defaultChecklist;
  });

  // Merge new default habits in if stored habits don't have them
  useEffect(() => {
    const stored = ls.get('cadence_checklist_' + todayKey(), null);
    if (!stored) return;
    const existingIds = (stored.habits || []).map(h => h.id);
    const missing = DEFAULT_HABITS.filter(h => !existingIds.includes(h.id));
    if (missing.length) {
      const next = { ...stored, habits: [...DEFAULT_HABITS, ...(stored.habits || []).filter(h => h.id.startsWith('custom_'))] };
      setChecklistState(next);
      ls.set('cadence_checklist_' + todayKey(), next);
    }
  }, []);

  return (
    <div style={{ ...s.fill }}>
      {/* Top bar */}
      <div style={{
        ...s.row, height: 52, borderBottom: `1px solid ${C.border}`,
        padding: '0 20px', gap: 0, flexShrink: 0,
        background: C.surface,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', color: C.txt, marginRight: 28 }}>
          CADENCE
        </div>
        <div style={{ ...s.row, gap: 4, flex: 1 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                color: tab === t.id ? C.txt : C.txtDim,
                background: tab === t.id ? C.card : 'transparent',
                border: `1px solid ${tab === t.id ? C.border : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >{t.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.txtFaint }}>
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'today'     && <TodayTab checklistState={checklistState} setChecklistState={setChecklistState} />}
        {tab === 'notes'     && <NotesTab />}
        {tab === 'timetable' && <TimetableTab />}
        {tab === 'jarvis'    && <JarvisTab checklistState={checklistState} />}
      </div>
    </div>
  );
}
