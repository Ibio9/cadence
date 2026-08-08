'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, hhmm, parseT, fmtDur, todayKey } from '../lib/api';

const PPM = 1.05;
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

  const say = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

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
  const proj = (id) => projects.find((p) => p.id === id) || { name: '—', color: '#575D70' };

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
    say('Captured');
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

  const dateObj = new Date(cursor + 'T12:00:00');

  return (
    <>
      <div id="capture">
        <div id="logo">CAD<span>—</span>ENCE</div>
        <input ref={capRef} id="cap" autoComplete="off" onKeyDown={capture}
          placeholder="Pour it out. Anything at all — it lands in the inbox." />
        <span className="kbd">/</span>
        <div id="rail">
          <span>held <b>{stats.held.toFixed(1)}</b>/{stats.planned.toFixed(1)}h</span>
          <span>rate <b>{stats.rate}</b>%</span>
          <span className="brass">streak <b>{streak}</b>d</span>
        </div>
      </div>

      <div id="shell">
        <div id="main">
          <div id="dayhead">
            <h1 id="dtitle">{isToday ? 'Today' : dateObj.toLocaleDateString('en-GB', { weekday: 'long' })}</h1>
            <div className="sub">{dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</div>
            <div className="nav">
              <button onClick={() => shiftDay(-1)} aria-label="Previous day">←</button>
              <button onClick={() => setCursor(todayKey())}>Today</button>
              <button onClick={() => shiftDay(1)} aria-label="Next day">→</button>
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
                  + {fmtDur(b - a)} open — {hhmm(a)} to {hhmm(b)}
                </div>
              ))}

              {blocks.map((b) => {
                const p = proj(b.projectId);
                const live = isToday && nm >= b.startMin && nm < b.endMin;
                const cls = ['block', b.source === 'jarvis' ? 'jarvis' : '', b.fixed ? 'fixed' : '', b.status,
                  live ? 'now' : '', isToday && nm >= b.endMin && b.status === 'pending' ? 'past' : ''].join(' ');
                return (
                  <div key={b.id} className={cls} style={{ top: y(b.startMin), height: Math.max((b.endMin - b.startMin) * PPM - 4, 30) }}
                    onClick={() => setModal({ kind: 'block', data: b })}>
                    <div className="t">{b.title}
                      <span className="tag" style={{ color: p.color, border: `1px solid ${p.color}44` }}>{p.name}</span>
                    </div>
                    <div className="m">{hhmm(b.startMin)}–{hhmm(b.endMin)} · {fmtDur(b.endMin - b.startMin)}{b.source === 'jarvis' ? ' · proposed' : ''}</div>
                    <div className="acts" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => markBlock(b, 'done')}>done</button>
                      <button onClick={() => markBlock(b, 'missed')}>missed</button>
                    </div>
                  </div>
                );
              })}

              {isToday && nm >= lo && nm <= hi && (
                <div id="nowline" style={{ top: y(nm) }} data-tick={tick}><b>{hhmm(nm)}</b></div>
              )}
            </div>
          </div>
        </div>

        <div id="side">
          <div id="tabs">
            {['inbox', 'tasks', 'rhythm', 'jarvis'].map((p) => (
              <button key={p} className={pane === p ? 'on' : ''} onClick={() => setPane(p)}>
                {p} {p === 'inbox' && state?.inbox?.length ? <span className="c">({state.inbox.length})</span> : null}
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
          <div className={`pane ${pane === 'jarvis' ? 'on' : ''}`}>
            <Jarvis state={state} cursor={cursor} refresh={refresh} say={say} />
          </div>
        </div>
      </div>

      {modal && (
        <Modal
          modal={modal} projects={projects} onClose={() => setModal(null)}
          mutate={mutate} say={say}
        />
      )}
      <div id="toast" className={toast ? 'on' : ''}>{toast}</div>
    </>
  );
}

/* ================= panes ================= */

function Inbox({ state, mutate, setModal, projects, say }) {
  if (!state) return null;
  if (!state.inbox.length)
    return <div className="blank"><b>Inbox clear.</b>Anything in your head goes in the bar up top. Sort it later — that&apos;s the deal.</div>;

  return state.inbox.map((i) => (
    <div className="row" key={i.id}>
      <div className="txt">{i.text}</div>
      <div className="meta">
        <span>{new Date(i.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        <button onClick={async () => {
          await mutate(async () => {
            await api.create('tasks', { title: i.text, projectId: projects[0]?.id });
            await api.remove('inbox', i.id);
          });
          say('Moved to tasks');
        }}>→ task</button>
        <button onClick={async () => {
          const start = Math.ceil(nowMin() / 30) * 30;
          await mutate(() => api.remove('inbox', i.id));
          setModal({ kind: 'block', data: { title: i.text, startMin: start, endMin: start + 60, projectId: projects[0]?.id } });
        }}>→ block</button>
        <button onClick={() => mutate(() => api.remove('inbox', i.id))}>discard</button>
      </div>
    </div>
  ));
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
          <span className="pill" style={{ color: p.color, borderColor: `${p.color}44` }}>{p.name}</span>
          <span className="pill">{t.energy}</span>
          <span className="pill">{fmtDur(t.est)}</span>
          <button onClick={() => mutate(() => api.update('tasks', t.id, { done: !t.done }))}>{t.done ? 'reopen' : 'done'}</button>
          <button onClick={() => {
            const start = Math.ceil(nowMin() / 30) * 30;
            setModal({ kind: 'block', data: { title: t.title, startMin: start, endMin: start + t.est, projectId: t.projectId } });
          }}>schedule</button>
          <button onClick={() => mutate(() => api.remove('tasks', t.id))}>delete</button>
        </div>
      </div>
    );
  };

  return (
    <>
      <h3 className="ph">Open · {open.length}</h3>
      {open.length ? open.map(Row) : <div className="blank"><b>Nothing queued.</b>Triage the inbox, or let Jarvis do it.</div>}
      {done.length > 0 && <><h3 className="ph">Done · {done.length}</h3>{done.slice(0, 8).map(Row)}</>}
    </>
  );
}

function Rhythm({ state, proj, setModal }) {
  if (!state) return null;
  return (
    <>
      <h3 className="ph">Weekly skeleton</h3>
      <div className="blank" style={{ textAlign: 'left', padding: '0 0 12px' }}>
        These repeat forever. Editing one here changes every future day — editing a block on the spine changes only that day.
      </div>
      {state.rhythms.map((r) => {
        const p = proj(r.projectId);
        return (
          <div className="row" key={r.id}>
            <div className="txt">{r.title}</div>
            <div className="meta">
              <span>{hhmm(r.startMin)}–{hhmm(r.endMin)}</span>
              <span className="pill" style={{ color: p.color, borderColor: `${p.color}44` }}>{p.name}</span>
              <span>{r.days.map((d) => DAY_SHORT[d]).join(' ')}</span>
              {r.fixed && <span className="pill" style={{ color: 'var(--brass)', borderColor: '#C89B3C44' }}>fixed</span>}
              <button onClick={() => setModal({ kind: 'rhythm', data: r })}>edit</button>
            </div>
          </div>
        );
      })}
      <button className="go" style={{ width: '100%', marginTop: 6, borderRadius: 6, padding: 9, background: 'var(--brass)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}
        onClick={() => setModal({ kind: 'rhythm', data: { title: '', startMin: 1080, endMin: 1140, days: [1, 2, 3, 4, 5], projectId: state.projects[0]?.id, fixed: true } })}>
        + Add recurring block
      </button>
    </>
  );
}

function Jarvis({ state, cursor, refresh, say }) {
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const inRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => { if (state?.chat) setLog(state.chat.map((m) => ({ role: m.role, text: m.text }))); }, [state?.chat?.length]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const send = async (text) => {
    const message = (text ?? inRef.current.value).trim();
    if (!message || busy) return;
    inRef.current.value = '';
    setLog((l) => [...l, { role: 'user', text: message }, { role: 'assistant', text: '◍' }]);
    setBusy(true);
    try {
      const r = await api.jarvis(message, cursor);
      setLog((l) => [...l.slice(0, -1), { role: 'assistant', text: r.text }]);
      if (r.applied) say(`Jarvis added ${r.applied} item${r.applied > 1 ? 's' : ''} — review before you commit`);
      await refresh();
    } catch (e) {
      setLog((l) => [...l.slice(0, -1), { role: 'assistant', text: `Jarvis is unreachable: ${e.message}. Your data is untouched.` }]);
    }
    setBusy(false);
  };

  return (
    <div id="jwrap">
      <div id="jlog" ref={logRef}>
        {log.length === 0 && (
          <div className="msg j">I&apos;m live. Your skeleton is loaded. Pour whatever&apos;s in your head into the bar up top, then tell me to fill your gaps.</div>
        )}
        {log.map((m, i) => <div key={i} className={`msg ${m.role === 'user' ? 'me' : 'j'}`}>{m.text}</div>)}
      </div>
      <div id="jquick">
        <button onClick={() => send('Plan the rest of my day around what actually matters.')}>Fill my gaps</button>
        <button onClick={() => send('Triage my inbox into tasks.')}>Triage inbox</button>
        <button onClick={() => send('How am I actually doing this week? Be straight with me.')}>Read me</button>
      </div>
      <div id="jbar">
        <textarea ref={inRef} id="jin" rows={1} placeholder="Ask Jarvis…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button onClick={() => send()} disabled={busy}>{busy ? '…' : 'Send'}</button>
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
    if (kind === 'rhythm') say('Rhythm updated from tomorrow');
    onClose();
  };

  const del = async () => {
    await mutate(() => api.remove(kind === 'rhythm' ? 'rhythms' : 'blocks', data.id));
    onClose();
  };

  return (
    <div id="veil" className="on" onClick={(e) => e.target.id === 'veil' && onClose()}>
      <div id="modal">
        <h2>{isNew ? (kind === 'rhythm' ? 'New rhythm' : 'New block') : (kind === 'rhythm' ? 'Edit rhythm' : 'Edit block')}</h2>

        <div className="f">
          <label>What</label>
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
              <option value="true">Fixed — this one is non-negotiable</option>
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

function Fatal({ message }) {
  return (
    <div style={{ padding: 40, fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.8, color: 'var(--dim)' }}>
      <div style={{ fontFamily: 'var(--disp)', fontSize: 22, color: 'var(--bone)', marginBottom: 12 }}>Cadence can&apos;t reach its server.</div>
      {message}
      <div style={{ marginTop: 18 }}>
        Check that <b style={{ color: 'var(--brass)' }}>NEXT_PUBLIC_API_URL</b> points at your Railway service and that{' '}
        <b style={{ color: 'var(--brass)' }}>NEXT_PUBLIC_CADENCE_TOKEN</b> matches <b style={{ color: 'var(--brass)' }}>CADENCE_TOKEN</b> on the server.
      </div>
    </div>
  );
}
