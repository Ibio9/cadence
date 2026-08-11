'use client';

/**
 * Jarvis.
 *
 * A conversation primed with today's checklist and timetable. The failed turn
 * is marked in place and can be resent, so history is never blanked by one bad
 * request.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import {
  Button,
  Card,
  CardBody,
  IconButton,
  InlineError,
  PageHeading,
  Skeleton,
  useToast,
} from '../components/ui';
import { buildJarvisSystem, ls, parseJarvisReply } from '../lib/store';
import { useChecklist } from '../lib/useChecklist';

const STARTERS = [
  'What should I drop today to protect TARA prep?',
  'Where is StudentSolve behind, and what unblocks it this week?',
  'Rewrite my afternoon so training still fits.',
];

function JarvisSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="5rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(16rem, 70%)" height="2.4rem" rounded="pill" />
      </div>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <Skeleton width="60%" height="3rem" rounded="card" />
          <Skeleton width="75%" height="4.5rem" rounded="card" className="ml-auto" />
          <Skeleton width="55%" height="3rem" rounded="card" />
        </CardBody>
      </Card>
    </Page>
  );
}

export function JarvisScreen() {
  const { toast } = useToast();
  const { ready, day: todayKey, summary } = useChecklist();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastAttempt, setLastAttempt] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (ready) setMessages(ls.get('cadence_jarvis_history', []));
  }, [ready]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const send = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();
      if (!text || loading) return;

      const history = messages;
      const userMsg = { role: 'user', content: text, ts: Date.now() };
      const nextMsgs = [...history, userMsg];
      setMessages(nextMsgs);
      setInput('');
      setLoading(true);
      setError('');
      setLastAttempt(text);

      try {
        // The day itself is not sent from here. buildContext on the server
        // serialises today's real blocks into every request, and a second,
        // client-side copy of the timetable could only contradict it.
        const system = buildJarvisSystem(summary());
        const context = `[SYSTEM]\n${system}\n\n[HISTORY]\n${history
          .slice(-10)
          .map((m) => `${m.role === 'user' ? 'Ibrahim' : 'Jarvis'}: ${m.content}`)
          .join('\n')}\n\n[NEW MESSAGE]\nIbrahim: ${text}`;

        const result = await api.jarvis(context, todayKey);
        const reply = parseJarvisReply(result);
        const finalMsgs = [...nextMsgs, { role: 'jarvis', content: reply, ts: Date.now() }];
        setMessages(finalMsgs);
        ls.set('cadence_jarvis_history', finalMsgs.slice(-60));
        setLastAttempt('');
      } catch {
        setError('Jarvis did not answer. The server may be down or the request timed out.');
      }
      setLoading(false);
    },
    [input, loading, messages, todayKey, summary],
  );

  const clearHistory = () => {
    setMessages([]);
    setError('');
    ls.set('cadence_jarvis_history', []);
    toast({ title: 'History cleared' });
  };

  if (!ready) return <JarvisSkeleton />;

  return (
    <Page>
      <PageHeading
        eyebrow="Assistant"
        title="Jarvis"
        lead="Primed with today's checklist and today's hours."
        actions={
          messages.length > 0 ? (
            <Button variant="secondary" icon="trash" onClick={clearHistory}>
              Clear history
            </Button>
          ) : null
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <span className={loading ? 'cd-orb is-active' : 'cd-orb'} aria-hidden="true" />
            <p className="text-sm text-ink-muted" role="status">
              {loading ? 'Jarvis is thinking.' : 'Ready when you are.'}
            </p>
          </div>

          {messages.length === 0 && !error ? (
            <div className="flex flex-col gap-4 py-4">
              <p className="font-display text-xl text-ink">Ask the thing you are avoiding.</p>
              <p className="text-base text-ink-muted max-w-prose">
                Jarvis can see what you have held today and what is on your timetable. Start with one of these, or
                write your own.
              </p>
              <div className="flex flex-col gap-2 items-start">
                {STARTERS.map((s) => (
                  <Button key={s} variant="secondary" icon="sparkle" className="cd-btn--wrap" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.length > 0 ? (
            <ol className="flex flex-col gap-4 list-none" aria-label="Conversation">
              {messages.map((m, i) => {
                const isUser = m.role === 'user';
                const failedTurn = Boolean(error) && isUser && i === messages.length - 1;
                return (
                  <li key={`${m.ts}-${i}`} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                    <div className="flex flex-col gap-2 max-w-full">
                      <div className={isUser ? 'cd-bubble cd-bubble--user' : 'cd-bubble cd-bubble--agent'}>
                        {m.content}
                      </div>
                      {failedTurn ? (
                        <span className="text-caption text-alarm flex items-center gap-2 justify-end">
                          Not answered
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {loading ? (
            <div className="flex justify-start">
              <div className="cd-bubble cd-bubble--agent flex items-center gap-2" aria-hidden="true">
                <span className="cd-dot" />
                <span className="cd-dot" style={{ animationDelay: '0.2s' }} />
                <span className="cd-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          ) : null}

          {error ? (
            <InlineError onRetry={() => send(lastAttempt)} retrying={loading} retryLabel="Send again">
              {error}
            </InlineError>
          ) : null}

          <div ref={bottomRef} />
        </CardBody>
      </Card>

      <div className="cd-composer">
        <label htmlFor="jarvis-input" className="sr-only">
          Message Jarvis
        </label>
        <input
          id="jarvis-input"
          placeholder="Ask Jarvis"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <IconButton
          icon="send"
          variant="primary"
          label="Send message"
          loading={loading}
          disabled={!input.trim()}
          onClick={() => send()}
        />
      </div>
    </Page>
  );
}

export default JarvisScreen;
