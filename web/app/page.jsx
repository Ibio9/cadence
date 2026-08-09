'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, hhmm, parseT, fmtDur, todayKey } from '../lib/api';

const PPM = 1.15;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

export default function Cadence() {
  const [state, setState] = useState(null);
  const [cursor, setCursor] = useState(todayKey());
  const [pane, setPane] = useState('inbox');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const capRef = useRef(null);
  const spineRef = useRef(null);

  const refresh = useCallback(async (date = cursor) => {
    try { setState(await api.state(date)); setError(''); }
    catch (e) { setError(e.message); }
  }, [cursor]);

  useEffect(() => { refresh(cursor); }, [cursor, refresh]);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 60000); return () => clearInterval(t); }, []);

  const say = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
      if (e.key === '/' && !typing) { e.preventDefault(); capRef.current?.focus(); }
      if (e.key === 'Escape') { setModal(null); capRef.current?.blur(); }
      if (e.key === 'j' && !typing && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setPane('jarvis'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const projects = state?.projects || [];
  const proj = (id) => projects.find((p) => p.id === id) || { name: '—', color: '#5EA4FF' };

  /* ---------- derived ---------- */
  const blocks = useMemo(() => [...(state?.blocks || [])].sort((a, b) => a.startMin - b.startMin), [state]);
  const isToday = cursor === todayKey();

  const streak = useMemo(() => {
    const byDay = {};
    for (const b of state?.history || []) {
      byDay[b.date] ??= { held: 0, settled: 0 };
      if (b.status !== 'pending') byDay[b.date].settled++;
      if (b.status === 'done') byDay[b.date].held++;
    }
    let n = 0;
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const day = byDay[todayKey(d)];
      if (!day || !day.settled) { if (i === 0) { d.setDate(d.getDate() - 1); continue; } break; }
      if (day.held / day.settled >= 0.7) n++; else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [state]);

  const stats = useMemo(() => {
    const planned = blocks.reduce((a, b) => a + (b.endMin - b.startMin), 0) / 60;
    const held = blocks.filter((b) => b.status === 'done').reduce((a, b) => a + (b.endMin - b.startMin), 0) / 60;
    const settled = blocks.filter((b) => b.status !== 'pending').length;
    const rate = settled ? Math.round((blocks.filter((b) => b.status === 'done').length / settled) * 100) : 0;
    return { planned, held, rate };
  }, [blocks]);

  /* ---------- mutations ---------- */
  const mutate = async (fn) => { try { await fn(); await refresh(); } catch (e) { say(e.message); } };

  const capture = async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const text = e.target.value.trim();
    e.target.value = '';
    await mutate(() => api.create('inbox', { text }));
    say('Captured to intel buffer');
  };

  const markBlock = (b, status) =>
    mutate(() => api.update('blocks', b.id, { status: b.status === status ? 'pending' : status }));

  /* ---------- spine geometry ---------- */
  const [lo, hi] = useMemo(() => {
    let a = 360, z = 1440;
    if (blocks.length) { a = Math.min(a, blocks[0].startMin - 30); z = Math.max(...blocks.map((b) => b.endMin)) + 30; }
    return [Math.floor(a / 60) * 60, Math.min(1440, Math.ceil(z / 60) * 60)];
  }, [blocks]);
  const y = (m) => (m - lo) * PPM;

  const gaps = useMemo(() => {
    const out = [];
    let cur = lo;
    for (const b of blocks) { if (b.startMin - cur >= 25) out.push([cur, b.startMin]); cur = Math.max(cur, b.endMin); }
    if (hi - cur >= 25) out.push([cur, hi]);
    return out;
  }, [blocks, lo, hi]);

  const nm = nowMin();
  useEffect(() => {
    if (!state || !isToday || !spineRef.current) return;
    spineRef.current.scrollTop = y(nm) - spineRef.current.clientHeight / 2.6;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.date]);

  const shiftDay = (n) => { const d = new Date(cursor + 'T12:00:00'); d.setDate(d.getDate() + n); setCursor(todayKey(d)); };

  if (error && !state) return <Fatal message={error} />;
  if (!state) return <Boot />;

  const dateObj = new Date(cursor + 'T12:00:00');
  const heldPct = stats.planned ? Math.round((stats.held / stats.planned) * 100) : 0;

  return (
    <div id="app">
      <div className="bg" />
      <div className="scan" />

      {/* ============ TOP BAR ============ */}
      <header id="topbar">
        <div className="brand">
          <Reactor className="reactor" />
          <div className="brand-txt">
            <div id="logo">CADENCE</div>
            <div className="brand-sub">PERSONAL&nbsp;OS</div>
          </div>
        </div>

        <div id="cmd">
          <span className="cmd-prompt">▸</span>
          <input ref={capRef} id="cap" autoComplete="off" onKeyDown={capture}
            placeholder="Log anything to the intel buffer — thoughts, tasks, noise. Sort it later." />
          <span className="kbd">/</span>
        </div>

        <div id="readouts">
          <Gauge label="Held" value={<><b>{stats.held.toFixed(1)}</b><span className="u">/{stats.planned.toFixed(1)}h</span></>} pct={heldPct} />
          <Gauge label="Hold rate" value={<><b>{stats.rate}</b><span className="u">%</span></>} pct={stats.rate} />
          <Gauge label="Streak" value={<><b>{streak}</b><span className="u">d</span></>} pct={Math.min(streak / 14 * 100, 100)} accent="streak" />
        </div>
      </header>

      {/* ============ SHELL ============ */}
      <div id="shell">
        <main id="main">
          <div id="dayhead">
            <div className="dh-l">
              <h1 id="dtitle">{isToday ? 'Today' : dateObj.toLocaleDateString('en-GB', { weekday: 'long' })}</h1>
              <div className="sub">{dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</div>
              {isToday && <span className="livechip">Live · {hhmm(nm)}</span>}
            </div>
            <div className="nav">
              <button onClick={() => shiftDay(-1)} aria-label="Previous day">◄</button>
              <button onClick={() => setCursor(todayKey())}>Today</button>
              <button onClick={() => shiftDay(1)} aria-label="Next day">►</button>
            </div>
          </div>

          <div id="spinewrap" ref={spineRef}>
            <div id="spine" style={{ height: (hi - lo) * PPM }}>
              {Array.from({ length: (hi - lo) / 60 + 1 }, (_, i) => lo + i * 60).map((m) => (
                <div key={m} className="hour" style={{ top: y(m) }}><i>{hhmm(m)}</i></div>
              ))}

              {gaps.map(([a, b]) => (
                <div key={a} className="empty" style={{ top: y(a) + 2, height: (b - a) * PPM - 6 }}
                  onClick={() => setModal({ kind: 'block', data: { title: '', startMin: a, endMin: Math.min(b, a + 60), projectId: projects[0]?.id } })}>
                  + Deploy · {fmtDur(b - a)} open — {hhmm(a)} to {hhmm(b)}
                </div>
              ))}

              {blocks.map((b) => {
                const p = proj(b.projectId);
                const live = isToday && nm >= b.startMin && nm < b.endMin;
                const cls = ['block', b.source === 'jarvis' ? 'jarvis' : '', b.fixed ? 'fixed' : '', b.status,
                  live ? 'now' : '', isToday && nm >= b.endMin && b.status === 'pending' ? 'past' : ''].join(' ');
                return (
                  <div key={b.id} className={cls} style={{ top: y(b.startMin), height: Math.max((b.endMin - b.startMin) * PPM - 4, 34), '--accent': p.color }}
                    onClick={() => setModal({ kind: 'block', data: b })}>
                    <div className="t">{b.title}
                      <span className="tag" style={{ color: p.color, borderColor: `${p.color}55` }}>{p.name}</span>
                    </div>
                    <div className="m">{hhmm(b.startMin)}–{hhmm(b.endMin)} · {fmtDur(b.endMin - b.startMin)}{b.source === 'jarvis' ? ' · proposed by jarvis' : ''}</div>
                    <div className="acts" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => markBlock(b, 'done')}>hold</button>
                      <button onClick={() => markBlock(b, 'missed')}>miss</button>
                    </div>
                  </div>
                );
              })}

              {isToday && nm >= lo && nm <= hi && (
                <div id="nowline" style={{ top: y(nm) }} data-tick={tick}><b>{hhmm(nm)}</b></div>
              )}
            </div>
          </div>
        </main>

        {/* ============ SIDE ============ */}
        <aside id="side">
          <div id="tabs">
            {[['inbox', 'Intel'], ['tasks', 'Missions'], ['rhythm', 'Protocols'], ['jarvis', 'Jarvis']].map(([p, label]) => (
              <button key={p} className={pane === p ? 'on' : ''} onClick={() => setPane(p)}>
                {label}{p === 'inbox' && state?.inbox?.length ? <span className="c"> {state.inbox.length}</span> : null}
              </button>
            ))}
          </div>

          <div className={`pane ${pane === 'inbox' ? 'on' : ''}`}>
            <Inbox state={state} mutate={mutate} setModal={setModal} projects={projects} say={say} />
          </div>
          <div className={`pane ${pane === 'tasks' ? 'on' : ''}`}>
            <Tasks state={state} mutate={mutate} proj={proj} setModal={setModal} />
          </div>
          <div className={`pane ${pane === 'rhythm' ? 'on' : ''}`}>
            <Rhythm state={state} proj={proj} setModal={setModal} />
          </div>
          <div className={`pane ${pane === 'jarvis' ? 'on' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>
            <Jarvis state={state} cursor={cursor} refresh={refresh} say={say} active={pane === 'jarvis'} />
          </div>
        </aside>
      </div>

      {modal && (
        <Modal modal={modal} projects={projects} onClose={() => setModal(null)} mutate={mutate} say={say} />
      )}
      <div id="toast" className={toast ? 'on' : ''}>{toast}</div>
    </div>
  );
}

/* ================= HUD atoms ================= */

function Gauge({ label, value, pct = 0, accent = '' }) {
  return (
    <div className={`gauge ${accent}`}>
      <div className="gl">{label}</div>
      <div className="gv">{value}</div>
      <div className="bar" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

function Reactor({ className = 'reactor', color = '#28E4FF' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="reactorCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EAFDFF" />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor="rgba(40,228,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeOpacity="0.22" strokeWidth="1" />
      <circle className="spin-slow" cx="50" cy="50" r="42" fill="none" stroke={color} strokeOpacity="0.5"
        strokeWidth="2" strokeDasharray="3 7" />
      <circle className="spin-rev" cx="50" cy="50" r="34" fill="none" stroke={color} strokeOpacity="0.7"
        strokeWidth="3" strokeDasharray="14 12" strokeLinecap="round" />
      <circle className="pulse-ring" cx="50" cy="50" r="24" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2 5" />
      <circle cx="50" cy="50" r="17" fill="url(#reactorCore)" />
      <circle cx="50" cy="50" r="11" fill="none" stroke="#EAFDFF" strokeOpacity="0.85" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="4.5" fill="#EAFDFF" />
    </svg>
  );
}

/* ================= panes ================= */

function Inbox({ state, mutate, setModal, projects, say }) {
  if (!state) return null;
  if (!state.inbox.length)
    return <div className="blank"><b>Buffer clear</b>Everything on your mind goes in the command line up top. Capture now, triage later — that&apos;s the protocol.</div>;

  return (
    <>
      <h3 className="ph">Incoming intel · {state.inbox.length}</h3>
      {state.inbox.map((i) => (
        <div className="row" key={i.id}>
          <div className="txt">{i.text}</div>
          <div className="meta">
            <span>{new Date(i.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <button onClick={async () => {
              await mutate(async () => {
                await api.create('tasks', { title: i.text, projectId: projects[0]?.id });
                await api.remove('inbox', i.id);
              });
              say('Promoted to mission');
            }}>→ mission</button>
            <button onClick={async () => {
              const start = Math.ceil(nowMin() / 30) * 30;
              await mutate(() => api.remove('inbox', i.id));
              setModal({ kind: 'block', data: { title: i.text, startMin: start, endMin: start + 60, projectId: projects[0]?.id } });
            }}>→ deploy</button>
            <button onClick={() => mutate(() => api.remove('inbox', i.id))}>discard</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Tasks({ state, mutate, proj, setModal }) {
  if (!state) return null;
  const open = state.tasks.filter((t) => !t.done);
  const done = state.tasks.filter((t) => t.done);

  const Row = (t) => {
    const p = proj(t.projectId);
    return (
      <div className={`row task ${t.done ? 'done' : ''}`} key={t.id}>
        <div className="txt">{t.title}</div>
        <div className="meta">
          <span className="pill" style={{ color: p.color, borderColor: `${p.color}55` }}>{p.name}</span>
          <span className="pill">{t.energy}</span>
          <span className="pill">{fmtDur(t.est)}</span>
          <button onClick={() => mutate(() => api.update('tasks', t.id, { done: !t.done }))}>{t.done ? 'reopen' : 'complete'}</button>
          <button onClick={() => {
            const start = Math.ceil(nowMin() / 30) * 30;
            setModal({ kind: 'block', data: { title: t.title, startMin: start, endMin: start + t.est, projectId: t.projectId } });
          }}>deploy</button>
          <button onClick={() => mutate(() => api.remove('tasks', t.id))}>abort</button>
        </div>
      </div>
    );
  };

  return (
    <>
      <h3 className="ph">Active objectives · {open.length}</h3>
      {open.length ? open.map(Row) : <div className="blank"><b>No active missions</b>Triage the intel buffer, or hand it to Jarvis to sort.</div>}
      {done.length > 0 && <><h3 className="ph">Completed · {done.length}</h3>{done.slice(0, 8).map(Row)}</>}
    </>
  );
}

function Rhythm({ state, proj, setModal }) {
  if (!state) return null;
  return (
    <>
      <h3 className="ph">Standing protocols</h3>
      <div className="blank" style={{ textAlign: 'left', padding: '0 0 14px' }}>
        These recur indefinitely. Edit one here and it reshapes every future day — edit a block on the timeline and only that day changes.
      </div>
      {state.rhythms.map((r) => {
        const p = proj(r.projectId);
        return (
          <div className="row" key={r.id}>
            <div className="txt">{r.title}</div>
            <div className="meta">
              <span>{hhmm(r.startMin)}–{hhmm(r.endMin)}</span>
              <span className="pill" style={{ color: p.color, borderColor: `${p.color}55` }}>{p.name}</span>
              <span>{r.days.map((d) => DAY_SHORT[d]).join(' ')}</span>
              {r.fixed && <span className="pill" style={{ color: 'var(--amber)', borderColor: 'rgba(255,194,75,.4)' }}>locked</span>}
              <button onClick={() => setModal({ kind: 'rhythm', data: r })}>modify</button>
            </div>
          </div>
        );
      })}
      <button className="addbtn"
        onClick={() => setModal({ kind: 'rhythm', data: { title: '', startMin: 1080, endMin: 1140, days: [1, 2, 3, 4, 5], projectId: state.projects[0]?.id, fixed: true } })}>
        + New protocol
      </button>
    </>
  );
}

/* ================= JARVIS ================= */

function Typed({ text, onType }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !text) { setN(text?.length || 0); return; }
    setN(0);
    let i = 0;
    const step = Math.max(1, Math.round(text.length / 140));
    const id = setInterval(() => {
      i = Math.min(text.length, i + step);
      setN(i);
      onType?.();
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = n >= (text?.length || 0);
  return <>{text.slice(0, n)}{!done && <span className="caret" />}</>;
}

function Jarvis({ state, cursor, refresh, say, active }) {
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const inRef = useRef(null);
  const logRef = useRef(null);

  const scrollDown = () => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; };

  // seed from server history only on first load; then manage locally so typing isn't cut off
  useEffect(() => {
    setLog((l) => (l.length === 0 && state?.chat?.length ? state.chat.map((m) => ({ role: m.role, text: m.text })) : l));
  }, [state?.chat?.length]);
  useEffect(scrollDown, [log]);
  useEffect(() => { if (active) inRef.current?.focus(); }, [active]);

  const send = async (text) => {
    const message = (text ?? inRef.current.value).trim();
    if (!message || busy) return;
    if (inRef.current) inRef.current.value = '';
    setLog((l) => [...l, { role: 'user', text: message }, { role: 'assistant', pending: true }]);
    setBusy(true);
    try {
      const r = await api.jarvis(message, cursor);
      setLog((l) => [...l.slice(0, -1), { role: 'assistant', text: r.text, animate: true }]);
      if (r.applied) say(`Jarvis deployed ${r.applied} item${r.applied > 1 ? 's' : ''} — review before you commit`);
      await refresh();
    } catch (e) {
      setLog((l) => [...l.slice(0, -1), { role: 'assistant', text: `Signal lost: ${e.message}. Your data is untouched.`, animate: true }]);
    }
    setBusy(false);
  };

  return (
    <div id="jwrap">
      <div id="jcore">
        <Reactor className="orb" color={busy ? '#FFC24B' : '#28E4FF'} />
        <div className={`jstat ${busy ? 'busy' : ''}`}>
          <div className="n">JARVIS</div>
          <div className="s">{busy ? 'Processing…' : 'Online · standing by'}</div>
        </div>
      </div>

      <div id="jlog" ref={logRef}>
        {log.length === 0 && (
          <div className="msg j">Systems online. Your skeleton is loaded and I&apos;m watching the day. Dump whatever&apos;s in your head into the command line up top — then tell me to fill your gaps.</div>
        )}
        {log.map((m, i) => {
          if (m.pending) return <div key={i} className="msg j"><span className="think"><i /><i /><i /></span></div>;
          return (
            <div key={i} className={`msg ${m.role === 'user' ? 'me' : 'j'}`}>
              {m.animate ? <Typed text={m.text} onType={scrollDown} /> : m.text}
            </div>
          );
        })}
      </div>

      <div id="jquick">
        <button onClick={() => send('Plan the rest of my day around what actually matters.')}>Fill my gaps</button>
        <button onClick={() => send('Triage my inbox into tasks.')}>Triage intel</button>
        <button onClick={() => send('How am I actually doing this week? Be straight with me.')}>Status report</button>
      </div>

      <div id="jbar">
        <div className="jbar-in">
          <textarea ref={inRef} id="jin" rows={1} placeholder="Talk to Jarvis…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        </div>
        <button id="jsend" onClick={() => send()} disabled={busy} aria-label="Send">{busy ? '◌' : '➤'}</button>
      </div>
    </div>
  );
}

/* ================= modal ================= */

function Modal({ modal, projects, onClose, mutate, say }) {
  const { kind, data } = modal;
  const [form, setForm] = useState({
    title: data.title || '',
    start: hhmm(data.startMin ?? 540),
    end: hhmm(data.endMin ?? 600),
    projectId: data.projectId || projects[0]?.id,
    fixed: data.fixed ?? true,
    days: data.days || [1, 2, 3, 4, 5],
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isNew = !data.id;

  const submit = async () => {
    const startMin = parseT(form.start), endMin = parseT(form.end);
    if (endMin <= startMin) return say('End time must be after start');
    if (kind === 'rhythm' && !form.days.length) return say('Pick at least one day');

    const payload = kind === 'rhythm'
      ? { title: form.title || 'Untitled', startMin, endMin, days: form.days, projectId: form.projectId, fixed: form.fixed === 'true' || form.fixed === true }
      : { title: form.title || 'Untitled', startMin, endMin, projectId: form.projectId, date: data.date || todayKey(), source: data.source === 'jarvis' ? 'me' : (data.source || 'me') };

    const collection = kind === 'rhythm' ? 'rhythms' : 'blocks';
    await mutate(() => isNew ? api.create(collection, payload) : api.update(collection, data.id, payload));
    if (kind === 'rhythm') say('Protocol updated from tomorrow');
    onClose();
  };

  const del = async () => {
    await mutate(() => api.remove(kind === 'rhythm' ? 'rhythms' : 'blocks', data.id));
    onClose();
  };

  return (
    <div id="veil" className="on" onClick={(e) => e.target.id === 'veil' && onClose()}>
      <div id="modal">
        <h2>{isNew ? (kind === 'rhythm' ? 'New protocol' : 'Deploy block') : (kind === 'rhythm' ? 'Edit protocol' : 'Edit block')}</h2>

        <div className="f">
          <label>Designation</label>
          <input autoFocus value={form.title} onChange={set('title')} placeholder="Further Maths — polar coordinates" />
        </div>

        <div className="f2">
          <div className="f"><label>Start</label><input type="time" value={form.start} onChange={set('start')} /></div>
          <div className="f"><label>End</label><input type="time" value={form.end} onChange={set('end')} /></div>
        </div>

        {kind === 'rhythm' && (
          <div className="f">
            <label>Days</label>
            <div className="days">
              {DAY_LETTERS.map((d, i) => (
                <button key={i} className={form.days.includes(i) ? 'on' : ''}
                  onClick={() => setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i].sort() })}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="f">
          <label>Project</label>
          <select value={form.projectId} onChange={set('projectId')}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {kind === 'rhythm' && (
          <div className="f">
            <label>Discipline</label>
            <select value={String(form.fixed)} onChange={set('fixed')}>
              <option value="true">Locked — this one is non-negotiable</option>
              <option value="false">Flexible — move it when needed</option>
            </select>
          </div>
        )}

        <div className="mact">
          {!isNew && <button className="del" onClick={del}>Delete</button>}
          <button onClick={onClose}>Cancel</button>
          <button className="go" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ================= boot + fatal ================= */

function Boot() {
  return (
    <div id="boot">
      <Reactor className="reactor" />
      <div className="bootlbl">Initialising Cadence</div>
      <div className="bootbar"><i /></div>
    </div>
  );
}

function Fatal({ message }) {
  return (
    <div id="app">
      <div className="bg" />
      <div id="fatal">
        <h1>Signal lost</h1>
        <p>
          Cadence can&apos;t reach its server.<br />{message}
        </p>
        <p style={{ marginTop: 18 }}>
          Check that <b>NEXT_PUBLIC_API_URL</b> points at your Railway service and that{' '}
          <b>NEXT_PUBLIC_CADENCE_TOKEN</b> matches <b>CADENCE_TOKEN</b> on the server.
        </p>
      </div>
    </div>
  );
}
