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
  create: (kind, data) => call(`/api/${kind}`, 'POST', data),
  update: (kind, id, data) => call(`/api/${kind}/${id}`, 'PATCH', data),
  remove: (kind, id) => call(`/api/${kind}/${id}`, 'DELETE'),
  jarvis: (message, date) => call('/api/jarvis', 'POST', { message, date }),
};

export const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const parseT = (s) => { const [h, m] = String(s || '0:0').split(':'); return (+h) * 60 + (+(m || 0)); };
export const fmtDur = (m) => (m >= 60 ? (m / 60).toFixed(m % 60 ? 1 : 0).replace('.0', '') + 'h' : m + 'm');
export const todayKey = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};
