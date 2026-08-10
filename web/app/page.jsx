'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../lib/api';

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const ls = {
  get: (k, fb) => {
    try {
      if (typeof window === 'undefined') return fb;
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fb;
    } catch { return fb; }
  },
  set: (k, v) => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

// ─── Date helpers (call only client-side, post-mount) ─────────────────────────
const getTodayKey = () => {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};

const formatDateLong = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const fmtHHMM = (h, m = 0) =>
  String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

// ─── API response parser ──────────────────────────────────────────────────────
const parseJarvisReply = (result) => {
  if (!result) return '';
  if (result.text) return result.text;
  if (result.reply) return result.reply;
  if (result.message) return result.message;
  if (typeof result === 'string') return result;
  try { const p = JSON.parse(result); return p.text || p.reply || p.message || JSON.stringify(result); } catch {}
  return JSON.stringify(result);
};

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_HABITS = [
  { id: 'fajr',    label: 'Fajr',                      prayer: true  },
  { id: 'dhuhr',   label: 'Dhuhr',                     prayer: true  },
  { id: 'asr',     label: 'Asr',                       prayer: true  },
  { id: 'maghrib', label: 'Maghrib',                    prayer: true  },
  { id: 'isha',    label: 'Isha',                       prayer: true  },
  { id: 'read',    label: 'Read 30 pages',              prayer: false },
  { id: 'podcast', label: 'Podcast / lecture',          prayer: false },
  { id: 'tara',    label: 'TARA prep',                  prayer: false },
  { id: 'alevel',  label: 'A-level study block',        prayer: false },
  { id: 'gym',     label: 'Gym / Training',             prayer: false },
  { id: 'markets', label: 'Review markets',             prayer: false },
  { id: 'macros',  label: 'Track macros',               prayer: false },
];

const NOTE_CATEGORIES = ['Ideas', 'Study', 'Markets', 'Business', 'Personal', 'TARA', 'StudentSolve', 'To Do'];

const CAT_COLORS = {
  Ideas:        '#7C3AED',
  Study:        '#2563EB',
  Markets:      '#16A34A',
  Business:     '#D97706',
  Personal:     '#DB2777',
  TARA:         '#DC2626',
  StudentSolve: '#0891B2',
  'To Do':      '#EA580C',
};

const SLOT_COLORS = {
  'Study':     { border: '#2563EB', light: 'rgba(37,99,235,0.07)',   dark: 'rgba(59,130,246,0.12)'  },
  'Build':     { border: '#7C3AED', light: 'rgba(124,58,237,0.07)',  dark: 'rgba(139,92,246,0.12)'  },
  'Training':  { border: '#16A34A', light: 'rgba(22,163,74,0.07)',   dark: 'rgba(34,197,94,0.12)'   },
  'Admin':     { border: '#6B7280', light: 'rgba(107,114,128,0.06)', dark: 'rgba(107,114,128,0.10)' },
  'Break':     { border: '#D1D5DB', light: 'rgba(0,0,0,0.03)',       dark: 'rgba(255,255,255,0.03)' },
  'Deep Work': { border: '#1E3A8A', light: 'rgba(30,58,138,0.07)',   dark: 'rgba(30,58,138,0.15)'   },
  'Markets':   { border: '#D97706', light: 'rgba(217,119,6,0.07)',   dark: 'rgba(245,158,11,0.12)'  },
};

const SLOT_TYPES = Object.keys(SLOT_COLORS);
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06–23

const DEFAULT_TIMETABLE_PROMPT =
  'Generate an optimal schedule for Ibrahim today based on his usual commitments: TARA prep, A-level study, Muay Thai training, reading, podcast, prayers, and market review.';

// ─── Jarvis system prompt ─────────────────────────────────────────────────────
const buildJarvisSystem = (checklist, timetable) => `You are Jarvis — Ibrahim Malik's personal AI. Be direct, specific, no filler.

Ibrahim, 17. Harris Westminster Sixth Form. A-levels: Further Maths, Maths, Economics, Philosophy. Target: Oxford PPE via TARA (October 2026, 8.0+). St Hilda's College, LMH backup. GCSEs: 9 A*s, 1 A.

CFA Investment Foundations 89% at 14. Bloomberg certified. UK Economics Olympiad top 23. GBEO finalist. JLI Economics shortlist 2026. BNP Paribas, Société Générale (algo trading desk), Trading Performance Centre, Schroders. Trades MNQ futures, built NQConfluenceScalper in C#/Quantower.

StudentSolve: AI revision platform, September 2026 launch, £4.99/mo. Also: dental consent MCQ (uncle, ~£100/mo/practice), clinic portal. Muay Thai + MMA, Tiger Muay Thai Phuket July 2026. 66kg/180cm. Mensa. VEX Robotics Champion 2023. 44 countries. Reading Uncommon Knowledge.

Critical tension: StudentSolve launch September + TARA October + A-levels + multiple builds. Be direct about allocation.

Today checklist: ${checklist}
Today timetable: ${timetable}`;

// ─── Icons ───────────────────────────────────────────────────────────────────
const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="8" r="3"/>
    <line x1="8" y1="1" x2="8" y2="2.5"/>
    <line x1="8" y1="13.5" x2="8" y2="15"/>
    <line x1="1" y1="8" x2="2.5" y2="8"/>
    <line x1="13.5" y1="8" x2="15" y2="8"/>
    <line x1="3.05" y1="3.05" x2="4.1" y2="4.1"/>
    <line x1="11.9" y1="11.9" x2="12.95" y2="12.95"/>
    <line x1="12.95" y1="3.05" x2="11.9" y2="4.1"/>
    <line x1="4.1" y1="11.9" x2="3.05" y2="12.95"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z"/>
  </svg>
);

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="14" y1="2" x2="7" y2="9"/>
    <polygon points="14,2 9,14 7,9 2,7" fill="currentColor" stroke="none"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1,4 3.5,6.5 9,1"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="7" y1="1" x2="7" y2="13"/>
    <line x1="1" y1="7" x2="13" y2="7"/>
  </svg>
);

// ─── ProgressRing ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 56, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct === 100 ? 'var(--success)' : 'var(--accent)';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}

// ─── Siri Orb ─────────────────────────────────────────────────────────────────
function SiriOrb({ thinking }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '28px 0 20px' }}>
      <div
        style={{
          width: 80, height: 80,
          borderRadius: '50%',
          background: '#2952E3',
          animation: thinking
            ? 'blobMorph 2s ease-in-out infinite'
            : 'orbIdle 3s ease-in-out infinite',
          opacity: thinking ? 1 : 0.3,
          transition: 'opacity 0.5s ease',
          boxShadow: thinking
            ? '0 0 32px 10px rgba(41,82,227,0.45)'
            : '0 0 16px 4px rgba(41,82,227,0.20)',
        }}
      />
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV_TABS = [
  { id: 'today',     label: 'Today'     },
  { id: 'notes',     label: 'Notes'     },
  { id: 'timetable', label: 'Timetable' },
  { id: 'jarvis',    label: 'Jarvis'    },
];

function Sidebar({ tab, setTab, theme, toggleTheme }) {
  return (
    <div style={{
      width: 240, flexShrink: 0, height: '100vh',
      background: 'var(--sidebar-bg)',
      display: 'flex', flexDirection: 'column',
      padding: '28px 14px 24px',
    }}>
      {/* Wordmark */}
      <div style={{
        fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em',
        color: 'var(--text-1)', marginBottom: 32, paddingLeft: 12,
        fontFamily: "'Inter', sans-serif",
      }}>
        Cadence
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {NAV_TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', borderRadius: 10,
                fontSize: 14, fontWeight: active ? 500 : 400,
                color: active ? '#FFFFFF' : 'var(--text-2)',
                background: active ? 'var(--accent)' : 'transparent',
                transition: 'all 0.12s',
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom — theme toggle + user */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{
            width: '100%', padding: '8px 14px', borderRadius: 10,
            background: 'transparent',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--text-2)', cursor: 'pointer', fontSize: 13,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-el)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 2 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, color: '#FFFFFF', flexShrink: 0,
          }}>
            I
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>Ibrahim</span>
        </div>
      </div>
    </div>
  );
}

// ─── TodayTab ─────────────────────────────────────────────────────────────────
function TodayTab({ checklistState, setChecklistState, todayKey }) {
  const [editingHabit, setEditingHabit] = useState(null);
  const [editLabel, setEditLabel]       = useState('');
  const [addingHabit, setAddingHabit]   = useState(false);
  const [newHabitLabel, setNewHabitLabel] = useState('');
  const [brief, setBrief]               = useState('');
  const editInputRef = useRef(null);
  const addInputRef  = useRef(null);

  const { habits, checked } = checklistState;

  // Fetch Jarvis brief for today
  useEffect(() => {
    api.jarvis(
      "Give me one sharp, specific sentence about what Ibrahim should focus on most today. No preamble, just the sentence.",
      todayKey
    )
      .then(r => setBrief(parseJarvisReply(r)))
      .catch(() => setBrief('Stay focused on what matters — TARA and StudentSolve, in that order.'));
  }, [todayKey]);

  const saveState = useCallback((next) => {
    setChecklistState(next);
    ls.set('cadence_checklist_' + todayKey, next);
  }, [todayKey, setChecklistState]);

  const toggle = useCallback((id) => {
    const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id];
    const streaks = ls.get('cadence_streaks', {});
    if (!checked.includes(id)) {
      streaks[id] = (streaks[id] || 0) + 1;
    } else {
      streaks[id] = Math.max(0, (streaks[id] || 1) - 1);
    }
    ls.set('cadence_streaks', streaks);
    saveState({ ...checklistState, checked: next });
  }, [checked, checklistState, saveState]);

  const startEditHabit = (id, label, e) => {
    e.stopPropagation();
    setEditingHabit(id);
    setEditLabel(label);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitHabitEdit = () => {
    if (!editLabel.trim()) { setEditingHabit(null); return; }
    const nextHabits = habits.map(h => h.id === editingHabit ? { ...h, label: editLabel.trim() } : h);
    saveState({ ...checklistState, habits: nextHabits });
    setEditingHabit(null);
  };

  const addHabit = () => {
    const label = newHabitLabel.trim();
    if (!label) { setAddingHabit(false); return; }
    const id = 'custom_' + Date.now();
    saveState({ ...checklistState, habits: [...habits, { id, label, prayer: false }] });
    setNewHabitLabel('');
    setAddingHabit(false);
  };

  const removeHabit = (id, e) => {
    e.stopPropagation();
    saveState({
      ...checklistState,
      habits: habits.filter(h => h.id !== id),
      checked: checked.filter(c => c !== id),
    });
  };

  useEffect(() => {
    if (addingHabit) setTimeout(() => addInputRef.current?.focus(), 0);
  }, [addingHabit]);

  const streaks  = ls.get('cadence_streaks', {});
  const prayers  = habits.filter(h => h.prayer);
  const others   = habits.filter(h => !h.prayer);
  const prayersDone = prayers.filter(h => checked.includes(h.id)).length;
  const pct      = habits.length ? Math.round((checked.length / habits.length) * 100) : 0;

  const renderHabit = (h) => {
    const done      = checked.includes(h.id);
    const streak    = streaks[h.id] || 0;
    const isEditing = editingHabit === h.id;

    return (
      <div
        key={h.id}
        onClick={() => toggle(h.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', borderRadius: 10,
          border: '1px solid var(--border)',
          background: done ? 'var(--accent-light)' : 'var(--surface)',
          transition: 'background 0.15s, border-color 0.15s',
          cursor: 'pointer',
        }}
      >
        <div
          className={`cadence-checkbox${done ? ' checked' : ''}`}
          style={{ borderColor: done ? 'var(--accent)' : 'var(--border)' }}
        >
          {done && <CheckIcon />}
        </div>

        {isEditing ? (
          <input
            ref={editInputRef}
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            onBlur={commitHabitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitHabitEdit();
              if (e.key === 'Escape') setEditingHabit(null);
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, fontSize: 14, color: 'var(--text-1)',
              background: 'var(--surface-el)', borderRadius: 6,
              padding: '2px 8px', border: '1px solid var(--accent)',
            }}
          />
        ) : (
          <span
            onClick={e => startEditHabit(h.id, h.label, e)}
            style={{
              flex: 1, fontSize: 14,
              color: done ? 'var(--text-2)' : 'var(--text-1)',
              textDecoration: done ? 'line-through' : 'none',
              textDecorationColor: 'var(--text-3)',
              cursor: 'text',
            }}
            title="Click to rename"
          >
            {h.label}
          </span>
        )}

        {streak > 1 && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
            {streak}d
          </span>
        )}

        {h.id.startsWith('custom_') && (
          <button
            onClick={e => removeHabit(h.id, e)}
            style={{ color: 'var(--text-3)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
          >×</button>
        )}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
      padding: 32, gap: 24,
      maxWidth: 900, width: '100%', margin: '0 auto',
    }}>
      {/* Header card — StudentSolve style */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 28,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 20,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-3)',
            marginBottom: 12,
          }}>
            + Your Daily Brief
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700, fontSize: 32, lineHeight: 1.15,
            color: 'var(--text-1)', letterSpacing: '-0.01em',
            marginBottom: 10,
          }}>
            {getGreeting()}, Ibrahim.
          </h1>
          <p style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic', color: 'var(--accent)',
            fontSize: 15, lineHeight: 1.55,
          }}>
            {brief || ' '}
          </p>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 10 }}>
            {formatDateLong()}
          </div>
        </div>

        {/* Progress arc */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            <ProgressRing pct={pct} size={56} stroke={5} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: 'var(--text-1)',
            }}>
              {pct}%
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {checked.length}/{habits.length}
          </div>
        </div>
      </div>

      {/* Discipline card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {/* Salah group */}
        {prayers.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Salah</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{prayersDone}/{prayers.length} complete</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {prayers.map(renderHabit)}
            </div>
          </div>
        )}

        {/* Divider + Discipline group */}
        {prayers.length > 0 && others.length > 0 && (
          <div style={{
            height: 1, background: 'var(--border)', margin: '4px 0 16px',
          }} />
        )}

        {others.length > 0 && (
          <div>
            {prayers.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
                Discipline
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {others.map(renderHabit)}
            </div>
          </div>
        )}

        {/* Add habit */}
        <div style={{ marginTop: 12 }}>
          {addingHabit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={addInputRef}
                value={newHabitLabel}
                onChange={e => setNewHabitLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addHabit(); if (e.key === 'Escape') setAddingHabit(false); }}
                onBlur={addHabit}
                placeholder="Habit name"
                style={{
                  flex: 1, fontSize: 14, padding: '9px 14px',
                  background: 'var(--surface)', border: '1px solid var(--accent)',
                  borderRadius: 10, color: 'var(--text-1)',
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingHabit(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 14px', width: '100%',
                fontSize: 13, color: 'var(--text-3)',
                border: '1px dashed var(--border)', borderRadius: 10,
                transition: 'color 0.12s, border-color 0.12s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--text-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <PlusIcon /> Add habit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NotesTab ────────────────────────────────────────────────────────────────
function NotesTab({ slots, setSlots, todayKey }) {
  const [notes, setNotes]           = useState(() => ls.get('cadence_notes', []));
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('All');
  const [capturing, setCapturing]   = useState('');
  const [capCat, setCapCat]         = useState('Ideas');
  const [expanded, setExpanded]     = useState(null);
  const [editBody, setEditBody]     = useState('');
  const [customCats, setCustomCats] = useState(() => ls.get('cadence_note_cats', []));
  const [newCat, setNewCat]         = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleBanner, setScheduleBanner] = useState('');
  const saveTimer = useRef(null);

  const allCats = [...NOTE_CATEGORIES, ...customCats];
  const saveNotes = (next) => { setNotes(next); ls.set('cadence_notes', next); };

  const scheduleAsTask = async (taskText) => {
    setScheduling(true);
    try {
      const currentSlots = ls.get('cadence_timetable_' + todayKey, {});
      const slotSummary = Object.entries(currentSlots).length
        ? Object.entries(currentSlots).sort(([a],[b]) => +a - +b)
            .map(([h, v]) => `${fmtHHMM(+h)}: ${v.label}`).join(', ')
        : 'Empty';
      const msg = `Today's timetable: ${slotSummary}. I need to add this task: "${taskText}". Reply with ONLY the best start hour as a number (e.g. 15) — no other text.`;
      const result = await api.jarvis(msg, todayKey);
      const text = parseJarvisReply(result);
      const match = text.match(/\b([6-9]|1[0-9]|2[0-2])\b/);
      const hour = match ? parseInt(match[1], 10) : null;
      if (hour) {
        const nextSlots = { ...ls.get('cadence_timetable_' + todayKey, {}), [hour]: { label: taskText.slice(0, 50), type: 'Admin' } };
        ls.set('cadence_timetable_' + todayKey, nextSlots);
        setSlots(nextSlots);
        setScheduleBanner(`Scheduled for ${fmtHHMM(hour)} today`);
        setTimeout(() => setScheduleBanner(''), 5000);
      } else {
        setScheduleBanner('Could not auto-schedule — add it to your timetable manually');
        setTimeout(() => setScheduleBanner(''), 4000);
      }
    } catch {
      setScheduleBanner('Jarvis is offline — could not auto-schedule');
      setTimeout(() => setScheduleBanner(''), 3000);
    }
    setScheduling(false);
  };

  const addNote = async () => {
    const text = capturing.trim();
    if (!text) return;
    const note = { id: Date.now(), title: text.split('\n')[0].slice(0, 80), body: text, category: capCat, ts: Date.now() };
    saveNotes([note, ...notes]);
    setCapturing('');
    if (capCat === 'To Do') await scheduleAsTask(text);
  };

  const deleteNote = (id) => {
    saveNotes(notes.filter(n => n.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const openNote = (note) => { setExpanded(note.id); setEditBody(note.body); };

  const handleEdit = (val) => {
    setEditBody(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotes(notes.map(n => n.id === expanded
        ? { ...n, body: val, title: val.split('\n')[0].slice(0, 80) } : n));
    }, 600);
  };

  const addCat = () => {
    const c = newCat.trim();
    if (!c || allCats.includes(c)) return;
    const next = [...customCats, c];
    setCustomCats(next); ls.set('cadence_note_cats', next); setNewCat('');
  };

  const filtered = useMemo(() => notes.filter(n => {
    const matchCat = catFilter === 'All' || n.category === catFilter;
    const matchSearch = !search || n.body.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [notes, catFilter, search]);

  const catColor = (cat) => CAT_COLORS[cat] || '#6B7280';
  const expandedNote = notes.find(n => n.id === expanded);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left pane */}
      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1,
        overflow: 'hidden',
        borderRight: expanded ? '1px solid var(--border)' : 'none',
        minWidth: 0,
      }}>
        {/* Schedule banner */}
        {(scheduleBanner || scheduling) && (
          <div style={{
            padding: '10px 20px', background: 'var(--accent-light)',
            borderBottom: '1px solid var(--border)',
            fontSize: 12, color: 'var(--accent)',
            display: 'flex', alignItems: 'center', gap: 8,
            animation: 'banner-in 0.2s ease',
          }}>
            {scheduling ? (
              <>
                <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}/>
                Finding best time slot...
              </>
            ) : (
              <><span>✓</span> {scheduleBanner}</>
            )}
          </div>
        )}

        {/* Capture card */}
        <div style={{
          margin: '20px 20px 0', padding: 20,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <textarea
            placeholder="What's on your mind?"
            value={capturing}
            onChange={e => setCapturing(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote(); }}
            style={{
              width: '100%', resize: 'none', minHeight: 80,
              background: 'var(--surface-el)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px',
              fontSize: 14, color: 'var(--text-1)', lineHeight: 1.6,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={capCat}
              onChange={e => setCapCat(e.target.value)}
              style={{
                flex: 1, padding: '8px 10px',
                background: 'var(--surface-el)', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 13, color: 'var(--text-1)', cursor: 'pointer',
              }}
            >
              {allCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={addNote}
              disabled={scheduling}
              style={{
                padding: '8px 20px', background: 'var(--accent)', color: 'white',
                borderRadius: 8, fontSize: 13, fontWeight: 500, flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              Save
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>⌘+Enter to save quickly</div>
        </div>

        {/* Search + filter */}
        <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, fontSize: 13, color: 'var(--text-1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {['All', ...allCats].map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${catFilter === c ? catColor(c) : 'var(--border)'}`,
                  background: catFilter === c ? catColor(c) + '18' : 'transparent',
                  color: catFilter === c ? catColor(c) : 'var(--text-2)',
                  transition: 'all 0.1s', cursor: 'pointer',
                }}
              >{c}</button>
            ))}
            <input
              placeholder="+ category"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCat()}
              style={{
                fontSize: 12, padding: '4px 8px',
                background: 'transparent', border: '1px dashed var(--border)',
                borderRadius: 6, color: 'var(--text-3)', width: 90,
              }}
            />
          </div>
        </div>

        {/* Notes masonry grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 40 }}>
              {search ? 'No notes match.' : 'No notes yet. Capture something above.'}
            </div>
          )}
          <div style={{ columns: 2, columnGap: 12 }}>
            {filtered.map(n => (
              <div
                key={n.id}
                onClick={() => expanded === n.id ? setExpanded(null) : openNote(n)}
                style={{
                  breakInside: 'avoid', marginBottom: 12, cursor: 'pointer',
                  background: 'var(--surface)',
                  border: `1px solid ${expanded === n.id ? catColor(n.category) + '80' : 'var(--border)'}`,
                  borderRadius: 12, padding: '14px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.10)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: catColor(n.category), display: 'inline-block', flexShrink: 0 }}/>
                    <span style={{ fontSize: 11, fontWeight: 500, color: catColor(n.category) }}>{n.category}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {new Date(n.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNote(n.id); }}
                      style={{ color: 'var(--text-3)', fontSize: 16, lineHeight: 1, padding: '0 1px' }}
                    >×</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {n.title || '(untitled)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {n.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Note editor pane */}
      {expanded && expandedNote && (
        <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: catColor(expandedNote.category), display: 'inline-block' }}/>
              <span style={{ fontSize: 12, fontWeight: 500, color: catColor(expandedNote.category) }}>{expandedNote.category}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>auto-saving</span>
              <button onClick={() => deleteNote(expandedNote.id)} style={{ fontSize: 12, color: 'var(--destructive)', fontWeight: 500 }}>Delete</button>
              <button onClick={() => setExpanded(null)} style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1 }}>×</button>
            </div>
          </div>
          <textarea
            autoFocus
            value={editBody}
            onChange={e => handleEdit(e.target.value)}
            style={{
              flex: 1, resize: 'none', padding: '20px 18px',
              background: 'transparent', color: 'var(--text-1)',
              fontSize: 14, lineHeight: 1.7, fontFamily: 'inherit',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── TimetableTab ─────────────────────────────────────────────────────────────
function TimetableTab({ slots, setSlots, todayKey }) {
  const [editHour, setEditHour]     = useState(null);
  const [editLabel, setEditLabel]   = useState('');
  const [editType, setEditType]     = useState('Study');
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt]   = useState('');
  const [genError, setGenError]     = useState('');
  const [genBadge, setGenBadge]     = useState(false);
  const [nowMinute, setNowMinute]   = useState(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowMinute(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const saveSlots = (next) => { setSlots(next); ls.set('cadence_timetable_' + todayKey, next); };

  const openEdit = (hour) => {
    setEditHour(hour);
    const ex = slots[hour];
    setEditLabel(ex?.label || '');
    setEditType(ex?.type || 'Study');
  };

  const saveSlot = () => {
    if (!editLabel.trim()) {
      const next = { ...slots }; delete next[editHour]; saveSlots(next);
    } else {
      saveSlots({ ...slots, [editHour]: { label: editLabel.trim(), type: editType } });
    }
    setEditHour(null);
  };

  const generate = async () => {
    // Auto-use default prompt if textarea is empty
    const prompt = genPrompt.trim() || DEFAULT_TIMETABLE_PROMPT;
    setGenerating(true); setGenError('');
    try {
      const sys = `Create a realistic hourly schedule for Ibrahim Malik (17, Harris Westminster, A-levels Further Maths/Maths/Economics/Philosophy, building StudentSolve, TARA prep October 2026, trades MNQ futures, Muay Thai training). Produce a JSON object ONLY — no explanation, no markdown. Keys are hours as numbers (6–22), values are {"label":"...","type":"..."}. Types must be one of: Study, Build, Training, Admin, Break, Deep Work, Markets. Tasks/context: ${prompt}`;
      const result = await api.jarvis(sys, todayKey);
      const text = parseJarvisReply(result);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found in response');
      const parsed = JSON.parse(match[0]);
      const next = {};
      for (const [k, v] of Object.entries(parsed)) {
        const hour = parseInt(k, 10);
        if (hour >= 6 && hour <= 22 && v?.label) {
          next[hour] = { label: String(v.label), type: SLOT_TYPES.includes(v.type) ? v.type : 'Study' };
        }
      }
      saveSlots(next);
      setGenBadge(true);
      setTimeout(() => setGenBadge(false), 8000);
    } catch (e) {
      setGenError('Jarvis is offline right now. Check your server connection.');
    }
    setGenerating(false);
  };

  const startMinute = 6 * 60;
  const endMinute   = 23 * 60;
  const ROW_H       = 44;
  const nowPct      = Math.min(Math.max((nowMinute - startMinute) / (endMinute - startMinute), 0), 1);
  const nowTop      = nowPct * (HOURS.length * ROW_H);
  const inRange     = nowMinute >= startMinute && nowMinute <= endMinute;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Generate panel */}
      <div style={{
        margin: '20px 24px 0',
        padding: 20,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: 12,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Generate schedule
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            placeholder={`What do you need to get done today? (leave empty for Ibrahim's default schedule)`}
            value={genPrompt}
            onChange={e => setGenPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); } }}
            disabled={generating}
            rows={2}
            style={{
              flex: 1, resize: 'none',
              padding: '9px 12px', background: 'var(--surface-el)',
              border: '1px solid var(--border)', borderRadius: 10,
              fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button
              onClick={generate}
              disabled={generating}
              style={{
                padding: '9px 20px', background: 'var(--accent)', color: 'white',
                borderRadius: 10, fontSize: 13, fontWeight: 500,
                transition: 'background 0.15s', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!generating) e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {generating ? 'Generating…' : 'Generate schedule'}
            </button>
            {genBadge && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '2px 0' }}>
                ✓ Generated by Jarvis
              </span>
            )}
          </div>
        </div>
        {genError && (
          <div style={{ fontSize: 12, color: 'var(--destructive)', padding: '6px 10px', background: '#FEF2F2', borderRadius: 6 }}>
            {genError}
          </div>
        )}
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {SLOT_TYPES.map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: SLOT_COLORS[t].border, flexShrink: 0 }}/>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editHour !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
          onClick={() => setEditHour(null)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: 360, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
              {fmtHHMM(editHour)} – {fmtHHMM(editHour + 1)}
            </div>
            <input
              autoFocus
              placeholder="What's happening this hour?"
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveSlot()}
              style={{ padding: '10px 14px', background: 'var(--surface-el)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text-1)' }}
            />
            <select
              value={editType}
              onChange={e => setEditType(e.target.value)}
              style={{ padding: '10px 14px', background: 'var(--surface-el)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text-1)', cursor: 'pointer' }}
            >
              {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {slots[editHour] && (
                <button
                  style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--destructive)', color: 'var(--destructive)', fontSize: 13 }}
                  onClick={() => { const n = { ...slots }; delete n[editHour]; saveSlots(n); setEditHour(null); }}
                >Clear</button>
              )}
              <button
                style={{ padding: '9px 20px', background: 'var(--accent)', color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 500 }}
                onClick={saveSlot}
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Hour grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {HOURS.map((hour, idx) => {
            const slot   = slots[hour];
            const isNow  = new Date().getHours() === hour;
            const colors = slot ? (SLOT_COLORS[slot.type] || SLOT_COLORS['Study']) : null;

            return (
              <div
                key={hour}
                onClick={() => openEdit(hour)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  height: ROW_H, cursor: 'pointer', padding: '0 16px',
                  borderBottom: idx < HOURS.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                  background: 'transparent',
                }}
                onMouseEnter={e => { if (!slot) e.currentTarget.style.background = 'var(--surface-el)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Time label */}
                <div style={{
                  width: 46, fontSize: 12, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                  fontWeight: isNow ? 600 : 400,
                  color: isNow ? 'var(--accent)' : 'var(--text-3)',
                }}>
                  {fmtHHMM(hour)}
                </div>

                {/* Slot area */}
                <div style={{
                  flex: 1, height: 28, borderRadius: 6,
                  display: 'flex', alignItems: 'center',
                  paddingLeft: slot ? 10 : 0,
                  gap: 10,
                  background: slot ? colors.light : 'transparent',
                  borderLeft: slot ? `3px solid ${colors.border}` : '3px solid transparent',
                  transition: 'background 0.15s',
                }}>
                  {slot ? (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', flex: 1 }}>{slot.label}</span>
                      <span style={{ fontSize: 11, color: colors.border, fontWeight: 500, marginRight: 4, flexShrink: 0 }}>{slot.type}</span>
                    </>
                  ) : isNow ? (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Now — click to add</span>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* Current time indicator */}
          {inRange && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: nowTop,
              height: 1, background: 'var(--destructive)',
              zIndex: 5, pointerEvents: 'none',
            }}>
              <div style={{ position: 'absolute', left: 60, top: -3, width: 6, height: 6, borderRadius: '50%', background: 'var(--destructive)' }}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── JarvisTab ───────────────────────────────────────────────────────────────
function JarvisTab({ checklistState, slots, todayKey }) {
  const [messages, setMessages] = useState(() => ls.get('cadence_jarvis_history', []));
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const getChecklistStatus = () => {
    const { habits, checked } = checklistState;
    const done = habits.filter(h => checked.includes(h.id)).map(h => h.label);
    const todo = habits.filter(h => !checked.includes(h.id)).map(h => h.label);
    return `Done: ${done.join(', ') || 'none'}. To do: ${todo.join(', ') || 'all done'}. Progress: ${checked.length}/${habits.length}`;
  };

  const getTimetableStatus = () => {
    const entries = Object.entries(slots).sort(([a],[b]) => +a - +b)
      .map(([h, v]) => `${fmtHHMM(+h)} ${v.label} (${v.type})`);
    return entries.length ? entries.join(', ') : 'No timetable set';
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg  = { role: 'user', content: text, ts: Date.now() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const system  = buildJarvisSystem(getChecklistStatus(), getTimetableStatus());
      const context = `[SYSTEM]\n${system}\n\n[HISTORY]\n${
        messages.slice(-10).map(m => `${m.role === 'user' ? 'Ibrahim' : 'Jarvis'}: ${m.content}`).join('\n')
      }\n\n[NEW MESSAGE]\nIbrahim: ${text}`;

      const result  = await api.jarvis(context, todayKey);
      const reply   = parseJarvisReply(result);
      const jarvisMsg = { role: 'jarvis', content: reply, ts: Date.now() };
      const finalMsgs = [...nextMsgs, jarvisMsg];
      setMessages(finalMsgs);
      ls.set('cadence_jarvis_history', finalMsgs.slice(-60));
    } catch {
      setError('Jarvis is offline right now. Check your server connection.');
    }
    setLoading(false);
  };

  const clearHistory = () => { setMessages([]); ls.set('cadence_jarvis_history', []); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Siri Orb + header */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingBottom: 12,
      }}>
        <SiriOrb thinking={loading} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 24px' }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
            {loading ? 'Jarvis is thinking…' : 'Ask me anything'}
          </span>
          <button onClick={clearHistory} style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Clear history
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && !error && (
          <div style={{
            fontSize: 14, color: 'var(--text-3)', textAlign: 'center',
            marginTop: 48, lineHeight: 1.9,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
          }}>
            Jarvis is ready.<br/>
            <span style={{ fontSize: 13, fontStyle: 'normal', fontFamily: 'Inter, sans-serif' }}>
              Schedule, TARA, StudentSolve, markets — ask anything.
            </span>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '74%',
                padding: '11px 16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: 14, lineHeight: 1.7,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                ...(isUser ? {
                  background: 'var(--accent)',
                  color: '#FFFFFF',
                } : {
                  background: 'var(--surface)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }),
              }}>
                {m.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 18px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '16px 16px 16px 4px',
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: `thinking-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}/>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--destructive)', textAlign: 'center',
            padding: '12px 20px', background: '#FEF2F2', borderRadius: 10,
            border: '1px solid #FECACA',
          }}>
            {error}
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ padding: '14px 24px 20px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 28, padding: '6px 6px 6px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'border-color 0.15s',
        }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <input
            ref={inputRef}
            placeholder="Ask Jarvis anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={loading}
            style={{ flex: 1, fontSize: 14, color: 'var(--text-1)', background: 'transparent' }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--border)',
              color: input.trim() && !loading ? 'white' : 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <SendIcon/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Cadence() {
  // ── Hydration guard — NO localStorage or new Date() until mounted ──
  const [mounted, setMounted] = useState(false);
  const [tab, setTab]         = useState('today');
  const [theme, setTheme]     = useState('light');

  // Safe defaults for SSR (no localStorage access)
  const [checklistState, setChecklistState] = useState({ habits: DEFAULT_HABITS, checked: [] });
  const [slots, setSlots]                   = useState({});
  const [todayKey, setTodayKey]             = useState('');

  // Load everything from localStorage after mount
  useEffect(() => {
    const key = getTodayKey();
    setTodayKey(key);

    // Theme
    const savedTheme = ls.get('cadence_theme', 'light');
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Checklist
    const stored = ls.get('cadence_checklist_' + key, null);
    if (stored?.habits?.length) {
      const existingIds = stored.habits.map(h => h.id);
      const missing     = DEFAULT_HABITS.filter(h => !existingIds.includes(h.id));
      const customs     = stored.habits.filter(h => h.id.startsWith('custom_'));
      const nextHabits  = missing.length ? [...DEFAULT_HABITS, ...customs] : stored.habits;
      const next        = { ...stored, habits: nextHabits };
      setChecklistState(next);
      if (missing.length) ls.set('cadence_checklist_' + key, next);
    }

    // Timetable
    setSlots(ls.get('cadence_timetable_' + key, {}));

    // Done — show UI
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    ls.set('cadence_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }, [theme]);

  // ── Skeleton until client mounts (prevents hydration mismatch) ──
  if (!mounted) {
    return <div style={{ minHeight: '100vh', background: '#F5F0E8' }} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar tab={tab} setTab={setTab} theme={theme} toggleTheme={toggleTheme}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: 'var(--bg)' }}>
        {tab === 'today'     && (
          <TodayTab
            checklistState={checklistState}
            setChecklistState={setChecklistState}
            todayKey={todayKey}
          />
        )}
        {tab === 'notes'     && (
          <NotesTab
            slots={slots}
            setSlots={setSlots}
            todayKey={todayKey}
          />
        )}
        {tab === 'timetable' && (
          <TimetableTab
            slots={slots}
            setSlots={setSlots}
            todayKey={todayKey}
          />
        )}
        {tab === 'jarvis'    && (
          <JarvisTab
            checklistState={checklistState}
            slots={slots}
            todayKey={todayKey}
          />
        )}
      </main>
    </div>
  );
}
