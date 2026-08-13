'use client';

/**
 * Shared TARA client helpers.
 *
 * Fetching, formatting and the honesty rules that the whole section depends
 * on. The most important of these is `pct`: an untried subcategory has no
 * accuracy and must not be rendered as 0%, because "you have never tried this"
 * and "you get all of these wrong" are opposite pieces of information.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

/** One fetch, with a real status and a retry. Used by every TARA screen. */
export function useResource(load, deps = []) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const alive = useRef(true);

  const run = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const next = await load();
      if (!alive.current) return;
      setData(next);
      setStatus('ready');
      setError('');
    } catch (e) {
      if (!alive.current) return;
      setError(e.message);
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  return { data, status, error, reload: run, setData };
}

export const useTaraState = () => useResource(() => api.tara.state(), []);
export const useTaraProgress = () => useResource(() => api.tara.progress(), []);
export const useReference = () => useResource(() => api.tara.reference(), []);

/**
 * How the bank build is going.
 *
 * Polls only while something is actually happening, and once more after it
 * stops so the strip settles on a final count rather than freezing one tick
 * short. A failed poll is not surfaced: the bank writing itself is background
 * work, and an error banner about a thing nobody asked for is noise.
 *
 * `onDone` fires on the transition from running to not running, so the screen
 * around it can reload and show the questions that just arrived.
 */
export function useBankBuild({ interval = 4000, onDone } = {}) {
  const [state, setState] = useState(null);
  const wasRunning = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let alive = true;
    let timer;

    const poll = async () => {
      try {
        const next = await api.tara.bank();
        if (!alive) return;
        setState(next);
        if (wasRunning.current && !next.running) done.current?.();
        wasRunning.current = next.running;
        // Idle costs one request a minute; a running build costs one every
        // few seconds, which is what the moving number is worth.
        timer = setTimeout(poll, next.running ? interval : 60000);
      } catch {
        if (alive) timer = setTimeout(poll, 30000);
      }
    };

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [interval]);

  return state;
}

/* --------------------------------------------------------------------------
   Formatting
   -------------------------------------------------------------------------- */

/**
 * A fraction as a percentage, or an em dash when there is nothing to report.
 * Never invents a zero.
 */
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/** mm:ss. Used for every clock in the section so they all read the same. */
export const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** "1m 50s" for a budget, "48s" under a minute. */
export const secs = (s) => {
  if (s == null) return '—';
  const n = Math.round(s);
  return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, '0')}s`;
};

/**
 * How an accuracy should be spoken about. Deliberately blunt: the brief for
 * the progress view is to say 60% is 60%, not to find a kind way to put it.
 */
export function standing(accuracy) {
  if (accuracy == null) return { tone: 'neutral', label: 'Untried' };
  if (accuracy >= 0.9) return { tone: 'success', label: 'Solid' };
  if (accuracy >= 0.75) return { tone: 'neutral', label: 'Close' };
  if (accuracy >= 0.5) return { tone: 'warning', label: 'Shaky' };
  return { tone: 'danger', label: 'Weak' };
}

/** The five options, always A–E, in order, whatever the server sent. */
export const LABELS = ['A', 'B', 'C', 'D', 'E'];

export const orderOptions = (options = []) =>
  LABELS.map((label) => options.find((o) => o.label === label)).filter(Boolean);

/** Why a given wrong option is wrong, from the distractor list. */
export const reasonFor = (question, label) =>
  (question?.distractors || []).find((d) => d.label === label)?.why || '';

/* --------------------------------------------------------------------------
   The clock
   -------------------------------------------------------------------------- */

/**
 * A ticking second counter. Counts up when there is no limit and down when
 * there is; `expired` fires once so a timed set can submit itself.
 */
export function useClock({ running, limitSec = null }) {
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(null);
  const banked = useRef(0);

  useEffect(() => {
    if (!running) {
      if (started.current != null) {
        banked.current += (Date.now() - started.current) / 1000;
        started.current = null;
      }
      return undefined;
    }
    started.current = Date.now();
    const tick = () =>
      setElapsed(banked.current + (started.current ? (Date.now() - started.current) / 1000 : 0));
    tick();
    const id = setInterval(tick, 250);
    return () => {
      clearInterval(id);
      if (started.current != null) {
        banked.current += (Date.now() - started.current) / 1000;
        started.current = null;
      }
    };
  }, [running]);

  const reset = useCallback(() => {
    banked.current = 0;
    started.current = running ? Date.now() : null;
    setElapsed(0);
  }, [running]);

  const remaining = limitSec == null ? null : Math.max(0, limitSec - elapsed);
  return { elapsed, remaining, expired: remaining != null && remaining <= 0, reset };
}
