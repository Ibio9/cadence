'use client';

/**
 * The habits checklist.
 *
 * Habits are the one part of the day that is genuinely local: they are ticks
 * against a personal standard, not blocks on a timetable, and they never
 * needed a server. This hook is the single owner of that storage so no screen
 * reads or writes the keys directly, and so `ready` is the one flag that says
 * "local storage has been read, it is safe to render real values".
 */

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_HABITS, getTodayKey, ls } from './store';

const key = (day) => 'cadence_checklist_' + day;

export function useChecklist() {
  const [day, setDay] = useState('');
  const [habits, setHabits] = useState(DEFAULT_HABITS);
  const [checked, setChecked] = useState([]);
  const [streaks, setStreaks] = useState({});
  const [ready, setReady] = useState(false);

  // Nothing reads local storage or the clock until after mount, so the server
  // render and the first client render agree.
  useEffect(() => {
    const today = getTodayKey();
    setDay(today);

    const stored = ls.get(key(today), null);
    if (stored?.habits?.length) {
      // A habit added to the defaults after this day was first opened should
      // still appear, without losing the ones that were renamed or added here.
      const existing = stored.habits.map((h) => h.id);
      const missing = DEFAULT_HABITS.filter((h) => !existing.includes(h.id));
      const customs = stored.habits.filter((h) => h.id.startsWith('custom_'));
      const next = missing.length ? [...DEFAULT_HABITS, ...customs] : stored.habits;
      setHabits(next);
      setChecked(stored.checked ?? []);
      if (missing.length) ls.set(key(today), { habits: next, checked: stored.checked ?? [] });
    }

    setStreaks(ls.get('cadence_streaks', {}));
    setReady(true);
  }, []);

  const save = useCallback(
    (nextHabits, nextChecked) => {
      setHabits(nextHabits);
      setChecked(nextChecked);
      if (day) ls.set(key(day), { habits: nextHabits, checked: nextChecked });
    },
    [day],
  );

  const toggle = useCallback(
    (id) => {
      const on = !checked.includes(id);
      const nextStreaks = { ...streaks, [id]: on ? (streaks[id] || 0) + 1 : Math.max(0, (streaks[id] || 1) - 1) };
      setStreaks(nextStreaks);
      ls.set('cadence_streaks', nextStreaks);
      save(habits, on ? [...checked, id] : checked.filter((x) => x !== id));
    },
    [checked, habits, streaks, save],
  );

  const rename = useCallback(
    (id, label) => save(habits.map((h) => (h.id === id ? { ...h, label } : h)), checked),
    [habits, checked, save],
  );

  const add = useCallback(
    (label) => save([...habits, { id: 'custom_' + Date.now(), label, prayer: false }], checked),
    [habits, checked, save],
  );

  const remove = useCallback(
    (id) => save(habits.filter((h) => h.id !== id), checked.filter((c) => c !== id)),
    [habits, checked, save],
  );

  /** One line of plain text for Jarvis. Never rendered. */
  const summary = useCallback(() => {
    const done = habits.filter((h) => checked.includes(h.id)).map((h) => h.label);
    const todo = habits.filter((h) => !checked.includes(h.id)).map((h) => h.label);
    return `Done: ${done.join(', ') || 'none'}. To do: ${todo.join(', ') || 'all done'}. Progress: ${checked.length}/${habits.length}`;
  }, [habits, checked]);

  return { ready, day, habits, checked, streaks, toggle, rename, add, remove, summary };
}

export default useChecklist;
