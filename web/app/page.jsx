'use client';

/**
 * Cadence root.
 *
 * Composition only: this file resolves the day, loads what is in local
 * storage, and hands the state to whichever screen the shell is showing.
 * All layout, styling and states live in the shell and the screens.
 *
 * Navigation is the app's existing client side view state. No routes changed.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../src/components/shell/AppShell';
import { ToastProvider } from '../src/components/ui';
import { ThemeProvider } from '../src/context/ThemeContext';
import { DEFAULT_HABITS, getTodayKey, ls } from '../src/lib/store';
import JarvisScreen from '../src/screens/JarvisScreen';
import NotesScreen from '../src/screens/NotesScreen';
import SettingsScreen from '../src/screens/SettingsScreen';
import TimetableScreen from '../src/screens/TimetableScreen';
import TodayScreen from '../src/screens/TodayScreen';

function CadenceApp() {
  // Nothing reads localStorage or the clock until after mount, so the server
  // render and the first client render agree.
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('today');

  const [checklistState, setChecklistState] = useState({ habits: DEFAULT_HABITS, checked: [] });
  const [todayKey, setTodayKey] = useState('');
  // The day the Timetable is looking at. Starts on today, moves independently.
  const [date, setDate] = useState('');

  useEffect(() => {
    const key = getTodayKey();
    setTodayKey(key);

    const stored = ls.get('cadence_checklist_' + key, null);
    if (stored?.habits?.length) {
      const existingIds = stored.habits.map((h) => h.id);
      const missing = DEFAULT_HABITS.filter((h) => !existingIds.includes(h.id));
      const customs = stored.habits.filter((h) => h.id.startsWith('custom_'));
      const nextHabits = missing.length ? [...DEFAULT_HABITS, ...customs] : stored.habits;
      const next = { ...stored, habits: nextHabits };
      setChecklistState(next);
      if (missing.length) ls.set('cadence_checklist_' + key, next);
    }

    setDate(key);
    setReady(true);
  }, []);

  const onViewChange = useCallback((next) => setView(next), []);

  return (
    <AppShell view={view} onViewChange={onViewChange}>
      {view === 'today' ? (
        <TodayScreen
          ready={ready}
          checklistState={checklistState}
          setChecklistState={setChecklistState}
          todayKey={todayKey}
        />
      ) : null}

      {view === 'notes' ? <NotesScreen ready={ready} todayKey={todayKey} /> : null}

      {view === 'timetable' && date ? (
        <TimetableScreen date={date} onDateChange={setDate} />
      ) : null}

      {view === 'jarvis' ? (
        <JarvisScreen ready={ready} checklistState={checklistState} todayKey={todayKey} />
      ) : null}

      {view === 'settings' ? <SettingsScreen /> : null}
    </AppShell>
  );
}

export default function Cadence() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <CadenceApp />
      </ToastProvider>
    </ThemeProvider>
  );
}
