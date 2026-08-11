/**
 * App data helpers.
 *
 * Lifted verbatim out of the previous single file page so the screens could be
 * split up. Storage keys, shapes, prompt strings and parsing behaviour are
 * unchanged: this move is presentational only.
 */

export const ls = {
  get: (k, fb) => {
    try {
      if (typeof window === 'undefined') return fb;
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fb;
    } catch {
      return fb;
    }
  },
  set: (k, v) => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

/* Date helpers. Call client side only, after mount. */
export const getTodayKey = () => {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};

export const formatDateLong = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const parseJarvisReply = (result) => {
  if (!result) return '';
  if (result.text) return result.text;
  if (result.reply) return result.reply;
  if (result.message) return result.message;
  if (typeof result === 'string') return result;
  try {
    const p = JSON.parse(result);
    return p.text || p.reply || p.message || JSON.stringify(result);
  } catch {}
  return JSON.stringify(result);
};

export const DEFAULT_HABITS = [
  { id: 'fajr', label: 'Fajr', prayer: true },
  { id: 'dhuhr', label: 'Dhuhr', prayer: true },
  { id: 'asr', label: 'Asr', prayer: true },
  { id: 'maghrib', label: 'Maghrib', prayer: true },
  { id: 'isha', label: 'Isha', prayer: true },
  { id: 'read', label: 'Read 30 pages', prayer: false },
  { id: 'podcast', label: 'Podcast / lecture', prayer: false },
  { id: 'tara', label: 'TARA prep', prayer: false },
  { id: 'alevel', label: 'A-level study block', prayer: false },
  { id: 'gym', label: 'Gym / Training', prayer: false },
  { id: 'markets', label: 'Review markets', prayer: false },
  { id: 'macros', label: 'Track macros', prayer: false },
];

export const NOTE_CATEGORIES = ['Ideas', 'Study', 'Markets', 'Business', 'Personal', 'TARA', 'StudentSolve', 'To Do'];

/**
 * Model prompt, not UI copy. It is never rendered to the screen.
 *
 * The day is deliberately absent: buildContext on the server puts today's real
 * blocks into every request, so a second copy assembled here could only go
 * stale and contradict it.
 */
export const buildJarvisSystem = (checklist) => `You are Jarvis — Ibrahim Malik's personal AI. Be direct, specific, no filler.

Ibrahim, 17. Harris Westminster Sixth Form. A-levels: Further Maths, Maths, Economics, Philosophy. Target: Oxford PPE via TARA (October 2026, 8.0+). St Hilda's College, LMH backup. GCSEs: 9 A*s, 1 A.

CFA Investment Foundations 89% at 14. Bloomberg certified. UK Economics Olympiad top 23. GBEO finalist. JLI Economics shortlist 2026. BNP Paribas, Société Générale (algo trading desk), Trading Performance Centre, Schroders. Trades MNQ futures, built NQConfluenceScalper in C#/Quantower.

StudentSolve: AI revision platform, September 2026 launch, £4.99/mo. Also: dental consent MCQ (uncle, ~£100/mo/practice), clinic portal. Muay Thai + MMA, Tiger Muay Thai Phuket July 2026. 66kg/180cm. Mensa. VEX Robotics Champion 2023. 44 countries. Reading Uncommon Knowledge.

Critical tension: StudentSolve launch September + TARA October + A-levels + multiple builds. Be direct about allocation.

Today checklist: ${checklist}`;
