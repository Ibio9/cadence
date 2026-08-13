const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN = process.env.NEXT_PUBLIC_CADENCE_TOKEN || '';

async function call(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-cadence-token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
  return res.json();
}

export const api = {
  state: (date) => call(`/api/state?date=${date}`),
  block: (id) => call(`/api/blocks/${id}`),
  create: (kind, data) => call(`/api/${kind}`, 'POST', data),
  update: (kind, id, data) => call(`/api/${kind}/${id}`, 'PATCH', data),
  remove: (kind, id) => call(`/api/${kind}/${id}`, 'DELETE'),
  // The clock is the server's. These return the updated block, so the client
  // never has to guess what the elapsed time became.
  session: (id, action) => call(`/api/blocks/${id}/${action}`, 'POST'),
  jarvis: (message, date) => call('/api/jarvis', 'POST', { message, date }),

  /* TARA Drill. The bank is the server's; the client only ever asks for a set
     and posts back what was answered. Grading happens on the server, so a
     stale tab cannot write a score the bank disagrees with. */
  tara: {
    state: () => call('/api/tara/state'),
    reference: () => call('/api/tara/reference'),
    progress: () => call('/api/tara/progress'),
    drill: (params) => call(`/api/tara/drill?${new URLSearchParams(clean(params))}`),
    record: (attempts) => call('/api/tara/attempts', 'POST', { attempts }),
    generate: (body) => call('/api/tara/generate', 'POST', body),
    /* The bank stocks itself. These two only report on it and, if you are
       impatient, start it early — nothing here blocks a drill. */
    bank: () => call('/api/tara/bank'),
    buildBank: (force = false) => call('/api/tara/bank', 'POST', { force }),
    questions: (params) => call(`/api/tara/questions?${new URLSearchParams(clean(params))}`),
    addQuestion: (body) => call('/api/tara/questions', 'POST', body),
    editQuestion: (id, body) => call(`/api/tara/questions/${id}`, 'PATCH', body),
    removeQuestion: (id) => call(`/api/tara/questions/${id}`, 'DELETE'),
    newPrompts: () => call('/api/tara/writing/prompts', 'POST', {}),
    saveEssay: (body) => call('/api/tara/writing/essays', 'POST', body),
    markEssay: (id, body) => call(`/api/tara/writing/essays/${id}/mark`, 'POST', body),
    essay: (id) => call(`/api/tara/writing/essays/${id}`),
    essays: () => call('/api/tara/writing/essays'),
  },

  /* The PPE interview drill. The sitting's stage lives on the server, so every
     call returns the whole session and the client re-renders from it rather
     than tracking where it thinks it is. */
  interview: {
    state: () => call('/api/interview/state'),
    start: () => call('/api/interview/sessions', 'POST', {}),
    session: (id) => call(`/api/interview/sessions/${id}`),
    save: (id, body) => call(`/api/interview/sessions/${id}`, 'PATCH', body),
    remove: (id) => call(`/api/interview/sessions/${id}`, 'DELETE'),
    /* Marking is slow on purpose — a critique with live web search takes a
       minute or two. The caller shows a real waiting state rather than a
       spinner that looks stuck. */
    mark: (id, body) => call(`/api/interview/sessions/${id}/rounds`, 'POST', body),
  },
};

/** Drop empty params so a blank filter does not become `?module=`. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

export const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const parseT = (s) => { const [h, m] = String(s || '0:0').split(':'); return (+h) * 60 + (+(m || 0)); };
/**
 * A length of time, written the way you would say it. Never a decimal hour:
 * "1h 15m" is what 75 minutes is, and "1.3h" is only what a calculator says.
 */
export const fmtDur = (m) => {
  const mins = Math.max(0, Math.round(m));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

/** Inside an hour, minutes are the unit. Used for the stages of a session. */
export const fmtMins = (m) => `${Math.max(0, Math.round(m))}m`;

/** Elapsed seconds as a clock. Under an hour it stays mm:ss so the seconds
 *  are the big number; past an hour it grows a place rather than rounding. */
export const fmtClock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
};
export const todayKey = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};
