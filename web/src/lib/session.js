'use client';

/**
 * The session: one block, its clock, and the shape of the hour.
 *
 * Everything here is arithmetic on a block record. There is no model call and
 * no second source of truth: the clock's authority is the server's `startedAt`
 * and `elapsedSec`, and this file only reads them.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

/* -------------------------------------------------------------------------- */
/* The clock                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Elapsed seconds for a block, right now.
 *
 * `elapsedSec` is time already banked by a pause. `startedAt` is the stamp the
 * server wrote when the clock was last started. Adding them is what makes a
 * refresh, a second tab and a closed laptop all agree.
 */
export function elapsedOf(block) {
  if (!block) return 0;
  const banked = block.elapsedSec || 0;
  if (!block.startedAt) return banked;
  const since = (Date.now() - new Date(block.startedAt).getTime()) / 1000;
  return banked + Math.max(0, Math.floor(since));
}

export const isRunning = (block) => Boolean(block?.startedAt);

/** A ticking elapsed value. Only mounts an interval while the clock is running. */
export function useElapsed(block) {
  const [elapsed, setElapsed] = useState(() => elapsedOf(block));

  useEffect(() => {
    setElapsed(elapsedOf(block));
    if (!isRunning(block)) return undefined;
    const t = setInterval(() => setElapsed(elapsedOf(block)), 1000);
    return () => clearInterval(t);
  }, [block]);

  return elapsed;
}

/* -------------------------------------------------------------------------- */
/* One block, loaded by id                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Focus is linkable, so it loads its own block by id rather than filtering a
 * day it was handed. `patch` writes a field and keeps the local record in step
 * with what the server actually stored.
 */
export function useBlock(id) {
  const [block, setBlock] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | missing
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    try {
      setBlock(await api.block(id));
      setError('');
      setStatus('ready');
    } catch (e) {
      const message = e?.message || 'The server did not answer.';
      setError(message);
      setStatus(/not on any day/i.test(message) ? 'missing' : 'error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (data) => {
      const row = await api.update('blocks', id, data);
      setBlock((prev) => ({ ...prev, ...row }));
      return row;
    },
    [id],
  );

  const act = useCallback(
    async (action) => {
      const row = await api.session(id, action);
      setBlock(row);
      return row;
    },
    [id],
  );

  return { block, status, error, reload: load, patch, act, setBlock };
}

/**
 * A field that saves itself a beat after you stop typing.
 *
 * Returns the value you type immediately so the field never fights the cursor,
 * and reports whether the last write reached the server so the pane can say
 * "Saved" or "Not saved" instead of pretending.
 */
export function useAutosave(initial, save, delay = 700) {
  const [value, setValue] = useState(initial ?? '');
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const timer = useRef(null);
  const latest = useRef(initial ?? '');
  const hydrated = useRef(false);

  // Adopt the server's value once it arrives, but never overwrite something
  // already being typed.
  useEffect(() => {
    if (hydrated.current) return;
    if (initial === undefined || initial === null) return;
    hydrated.current = true;
    latest.current = initial;
    setValue(initial);
  }, [initial]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (latest.current === undefined) return;
    setState('saving');
    try {
      await save(latest.current);
      setState('saved');
    } catch {
      setState('error');
    }
  }, [save]);

  const change = useCallback(
    (next) => {
      setValue(next);
      latest.current = next;
      setState('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  return { value, change, flush, state };
}

/* -------------------------------------------------------------------------- */
/* The shape of the hour                                                      */
/* -------------------------------------------------------------------------- */

/**
 * How the block's minutes are meant to be spent, derived from its length.
 *
 * Nothing is generated and nothing is fetched: a 60 minute block always splits
 * the same way, so the plan is already on screen the moment Focus opens. The
 * stages always add back up to the block's real length.
 */
export function sessionPlan(block) {
  const mins = Math.max(1, (block?.endMin ?? 0) - (block?.startMin ?? 0));

  const stages =
    mins <= 25
      ? [{ label: 'One push, no breaks', mins }]
      : (() => {
          const open = mins <= 45 ? 3 : 5;
          const close = Math.min(10, Math.max(4, Math.round(mins * 0.12)));
          return [
            { label: 'Settle and name the target', mins: open },
            { label: 'The work', mins: mins - open - close },
            { label: 'Write down where you stopped', mins: close },
          ];
        })();

  let at = block?.startMin ?? 0;
  return stages.map((stage) => {
    const from = at;
    at += stage.mins;
    return { ...stage, from, to: at };
  });
}
