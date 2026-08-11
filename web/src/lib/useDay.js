'use client';

/**
 * The day, from the server.
 *
 * One place that knows how to load a date's state, so screens never hold their
 * own copy of the timetable. `reload` is what every mutation calls when it is
 * done: the server is the source of truth, the client does not guess.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function useDay(date) {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!date) return;
    // A refresh of an already loaded day keeps the old day on screen rather
    // than flashing skeletons over content that is still correct.
    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    try {
      const next = await api.state(date);
      setState(next);
      setError('');
      setStatus('ready');
    } catch (e) {
      setError(e?.message || 'The server did not answer.');
      setStatus('error');
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return { state, status, error, reload: load };
}

/** Shift a YYYY-MM-DD key by whole days without tripping over timezones. */
export const shiftDay = (key, days) => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

export const formatDayLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
};

export default useDay;
