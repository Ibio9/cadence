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
};

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
