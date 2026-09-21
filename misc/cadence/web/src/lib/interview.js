'use client';

/**
 * Client state for the interview drill.
 *
 * Two clocks and a camera, and none of them is allowed to be the authority on
 * anything that matters: the sitting's stage lives on the server, so a refresh
 * mid-prep or a closed laptop mid-critique comes back to the same place.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { listen, speechSupported } from './speech';

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

export function useInterviewState() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.interview.state());
      setStatus('ready');
      setError('');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, status, error, reload: load };
}

export function useSitting(id) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setSession(await api.interview.session(id));
      setStatus('ready');
      setError('');
    } catch (e) {
      setError(e.message);
      setStatus(/not here/i.test(e.message) ? 'missing' : 'error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { session, setSession, status, error, reload: load };
}

/* --------------------------------------------------------------------------
   The prep clock
   -------------------------------------------------------------------------- */

/**
 * Fifteen minutes, counting down, calmly.
 *
 * It does not stop you when it reaches zero and it does not go red at two
 * minutes. A prep timer that panics you is training the wrong reflex — the
 * real fifteen minutes are silent, and the point is to get used to feeling
 * time pass without being shouted at.
 */
export function useCountdown({ total, running, already = 0 }) {
  // Prep already spent on a previous visit is banked up front, so closing the
  // laptop for an hour and coming back does not hand you a fresh fifteen
  // minutes — the clock is a measurement, not a reward.
  const spent = useRef(already);
  const started = useRef(null);
  const [left, setLeft] = useState(total - already);

  useEffect(() => {
    if (!running) {
      if (started.current != null) {
        spent.current += (Date.now() - started.current) / 1000;
        started.current = null;
      }
      return undefined;
    }

    started.current = Date.now();
    const tick = () => {
      const used = spent.current + (started.current ? (Date.now() - started.current) / 1000 : 0);
      setLeft(total - used);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => {
      clearInterval(id);
      if (started.current != null) {
        spent.current += (Date.now() - started.current) / 1000;
        started.current = null;
      }
    };
  }, [running, total]);

  // `used` is derived from `left` rather than from the ref, so it is correct
  // while the clock is still running — which is exactly when "ready to answer"
  // is pressed.
  return { left: Math.round(left), used: Math.max(0, Math.round(total - left)), over: left < 0 };
}

/* --------------------------------------------------------------------------
   Recording
   -------------------------------------------------------------------------- */

/**
 * Camera, microphone and a live transcript.
 *
 * The camera stream is shown and never stored. Speaking to a lens is the part
 * of an interview that has to be rehearsed — you sound different doing it — but
 * a video of yourself is not something the critique can read, and keeping one
 * would mean uploading a hundred megabytes per sitting to be watched never.
 * What gets kept is what gets marked: the words and the clock.
 */
export function useRecorder() {
  const [state, setState] = useState('idle'); // idle | ready | recording | stopped
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const speechRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const startedAt = useRef(null);

  const stopEverything = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.close?.().catch(() => {});
    audioRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopEverything, [stopEverything]);

  /** Ask for the camera and microphone, and show the self-view. */
  const arm = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 1280 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      /* A live level meter, from the real microphone. Without one, a session
         where the microphone was muted looks exactly like a session where you
         said nothing — and you find out four minutes later. */
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const meter = () => {
        analyser.getByteTimeDomainData(bins);
        let peak = 0;
        for (const b of bins) peak = Math.max(peak, Math.abs(b - 128));
        setLevel(Math.min(1, peak / 90));
        rafRef.current = requestAnimationFrame(meter);
      };
      meter();

      setState('ready');
    } catch (e) {
      const denied = e.name === 'NotAllowedError' || e.name === 'SecurityError';
      setError(
        denied
          ? 'The camera and microphone are blocked. Allow them in the address bar and try again. On a phone or a laptop this needs HTTPS — it will not work over plain http.'
          : e.name === 'NotFoundError'
            ? 'No camera or microphone was found. Plug one in, or answer with audio only from another device.'
            : `The camera would not start: ${e.message}`,
      );
      setState('idle');
    }
  }, []);

  const start = useCallback(() => {
    if (!streamRef.current) return;
    setTranscript('');
    setInterim('');
    setSeconds(0);
    startedAt.current = Date.now();
    setState('recording');

    speechRef.current = listen({
      onText: (settled, tail) => {
        if (settled) setTranscript((t) => (t ? `${t} ${settled.trim()}` : settled.trim()));
        setInterim(tail);
      },
      onError: setError,
    });
  }, []);

  const stop = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    setInterim('');
    setState('stopped');
  }, []);

  // The answer clock. Counts up; the window is 3–5 minutes and both edges are
  // marked, because under is as much a failure as over.
  useEffect(() => {
    if (state !== 'recording') return undefined;
    const id = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [state]);

  return {
    state,
    error,
    setError,
    transcript,
    setTranscript,
    interim,
    seconds,
    level,
    videoRef,
    arm,
    start,
    stop,
    release: stopEverything,
    speechSupported: speechSupported(),
  };
}

/* --------------------------------------------------------------------------
   Formatting
   -------------------------------------------------------------------------- */

export const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Words spoken per minute. Interview pace is roughly 130–160. */
export const pace = (transcript, seconds) => {
  const n = (transcript || '').trim().split(/\s+/).filter(Boolean).length;
  if (!seconds || !n) return null;
  return Math.round(n / (seconds / 60));
};

/** How a score should be spoken about. 7 is a borderline offer, so say so. */
export function band(score) {
  if (score == null) return { tone: 'neutral', label: 'Unmarked' };
  if (score >= 8) return { tone: 'held', label: 'Strong' };
  if (score >= 7) return { tone: 'neutral', label: 'Borderline' };
  if (score >= 5) return { tone: 'warning', label: 'Under' };
  return { tone: 'danger', label: 'Weak' };
}
