'use client';

/**
 * The writing task.
 *
 * Three prompts, pick one, write, get marked. Both limits are real: the word
 * count stops accepting new words at 750 and the clock submits at forty
 * minutes, because a limit you can quietly exceed while practising is a limit
 * you will discover in the exam hall.
 *
 * The draft is saved to the server as you write, so a closed tab costs you
 * the clock and nothing else.
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import Icon from '../../components/Icon';
import { Page } from '../../components/shell/AppShell';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Modal,
  PageHeading,
  Skeleton,
  Textarea,
  useToast,
} from '../../components/ui';
import { clock, useClock } from '../../lib/tara';

const LIMIT_WORDS = 750;
const LIMIT_SECONDS = 40 * 60;

const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;

/* -------------------------------------------------------------------------- */
/* Choosing                                                                   */
/* -------------------------------------------------------------------------- */

function PromptCard({ prompt, onPick, picking }) {
  return (
    <li className="cd-prompt">
      <p className="cd-prompt__statement">{prompt.statement}</p>
      <ol className="cd-prompt__questions list-none">
        <li>{prompt.q1}</li>
        <li>{prompt.q2}</li>
        <li>{prompt.q3}</li>
      </ol>
      <div className="cd-prompt__foot">
        {prompt.essays ? <Badge tone="neutral">Written {prompt.essays}×</Badge> : null}
        <Button variant="go" icon="play" size="sm" loading={picking} onClick={() => onPick(prompt)}>
          Write this one
        </Button>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                    */
/* -------------------------------------------------------------------------- */

function Sitting({ prompt, essayId, onMarked }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [marking, setMarking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const saved = useRef('');
  const submitted = useRef(false);

  const { elapsed, remaining, expired } = useClock({ running: !marking, limitSec: LIMIT_SECONDS });
  const count = words(text);
  const atLimit = count >= LIMIT_WORDS;

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setMarking(true);
    try {
      const row = await api.tara.markEssay(essayId, { text, seconds: Math.round(elapsed) });
      onMarked(row);
    } catch (e) {
      submitted.current = false;
      setMarking(false);
      toast({ tone: 'danger', title: 'It could not be marked', description: e.message });
    }
  }, [essayId, text, elapsed, onMarked, toast]);

  // Forty minutes is forty minutes. What is on the page at that moment is what
  // gets marked, which is exactly what happens in the real thing.
  useEffect(() => {
    if (expired && !submitted.current && count >= 50) submit();
    else if (expired && !submitted.current) {
      submitted.current = true;
      setMarking(false);
      toast({
        tone: 'warning',
        title: 'Time is up',
        description: 'There is too little here to mark. Start another sitting when you are ready.',
      });
    }
  }, [expired, count, submit, toast]);

  // Autosave, so a closed tab costs the clock and not the essay.
  useEffect(() => {
    const id = setInterval(() => {
      if (text === saved.current || submitted.current) return;
      saved.current = text;
      api.tara.saveEssay({ id: essayId, text, seconds: Math.round(elapsed) }).catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [text, essayId, elapsed]);

  /** Accept deletions always; refuse anything that would push past the limit. */
  const change = (value) => {
    if (words(value) <= LIMIT_WORDS || value.length < text.length) setText(value);
  };

  if (marking) {
    return (
      <Page>
        <div className="cd-marking">
          <Icon name="sparkle" size={22} className="cd-marking__icon" />
          <h2 className="cd-marking__title">Marking</h2>
          <p>
            Against all seven criteria, then a 750-word model answer on the same prompt, then the places yours
            diverged from it. This takes a minute or so.
          </p>
          <Skeleton height="1rem" rounded="pill" />
          <Skeleton height="1rem" rounded="pill" />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <header className="cd-sitting__bar">
        <span className="cd-sitting__mode">Writing task · one sitting</span>
        <span className="cd-sitting__meters">
          <span className={atLimit ? 'cd-meter is-limit' : 'cd-meter'}>
            <strong>{count}</strong>
            <span>/{LIMIT_WORDS} words</span>
          </span>
          <span className={remaining < 300 ? 'cd-meter is-limit' : 'cd-meter'} role="timer">
            <strong>{clock(remaining)}</strong>
            <span>left</span>
          </span>
        </span>
      </header>

      <section className="cd-sitting__prompt">
        <p className="cd-sitting__statement">{prompt.statement}</p>
        <ol className="cd-sitting__questions">
          <li>{prompt.q1}</li>
          <li>{prompt.q2}</li>
          <li>{prompt.q3}</li>
        </ol>
      </section>

      <Textarea
        label="Your essay"
        hideLabel
        rows={22}
        value={text}
        placeholder="Answer all three parts, in order."
        onChange={(e) => change(e.target.value)}
        className="cd-sitting__editor"
      />

      {atLimit ? (
        <p className="cd-sitting__limit" role="status">
          You are at {LIMIT_WORDS} words. Cut something to add anything.
        </p>
      ) : null}

      <div className="cd-sitting__actions">
        <Button variant="tertiary" onClick={() => setConfirm(true)}>
          Abandon
        </Button>
        <Button variant="primary" icon="send" disabled={count < 50} onClick={submit}>
          Finish and mark it
        </Button>
      </div>
      {count < 50 ? <p className="cd-sitting__hint">At least fifty words before it can be marked.</p> : null}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Abandon this sitting?"
        description="The draft is saved, but the clock does not restart. You can start a fresh sitting on the same prompt."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Keep writing
            </Button>
            <Button variant="danger" onClick={() => onMarked(null)}>
              Abandon
            </Button>
          </>
        }
      />
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function WritingScreen({ module, state, onChange }) {
  const router = useRouter();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sitting, setSitting] = useState(null);

  const prompts = state?.writing?.prompts || [];
  const unused = prompts.filter((p) => !p.essays).slice(0, 3);
  const shown = unused.length ? unused : prompts.slice(0, 3);

  const fresh = async () => {
    setGenerating(true);
    try {
      await api.tara.newPrompts();
      await onChange?.();
      toast({ tone: 'success', title: 'Three new prompts', description: 'Pick one and start the clock.' });
    } catch (e) {
      toast({ tone: 'danger', title: 'Could not write prompts', description: e.message });
    }
    setGenerating(false);
  };

  const pick = async (prompt) => {
    setPicking(true);
    try {
      const essay = await api.tara.saveEssay({ promptId: prompt.id, text: '' });
      setSitting({ prompt, essayId: essay.id });
    } catch (e) {
      toast({ tone: 'danger', title: 'Could not start', description: e.message });
    }
    setPicking(false);
  };

  if (sitting) {
    return (
      <Sitting
        prompt={sitting.prompt}
        essayId={sitting.essayId}
        onMarked={(row) => {
          setSitting(null);
          onChange?.();
          if (row) router.push(`/tara/essay/${row.id}`);
        }}
      />
    );
  }

  return (
    <Page>
      <PageHeading
        eyebrow={<>TARA Drill · {module.minutes} minutes · {module.wordLimit} words</>}
        title={module.name}
        lead="Three prompts, pick one, write it under the clock, then have it marked hard against the official criteria."
        actions={
          <Button variant="secondary" icon="sparkle" loading={generating} onClick={fresh}>
            Three new prompts
          </Button>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon="notes"
          title="No prompts yet"
          body="Generate three in the official shape — a statement, then explain it, argue against it, and say how far you agree."
          action={{ label: 'Write three prompts', onClick: fresh, icon: 'sparkle', loading: generating }}
        />
      ) : (
        <>
          <p className="cd-eyebrow">Choose one — the real task gives you three</p>
          <ul className="cd-prompts list-none">
            {shown.map((p) => (
              <PromptCard key={p.id} prompt={p} onPick={pick} picking={picking} />
            ))}
          </ul>
        </>
      )}

      {state?.writing?.marked ? (
        <p className="cd-bankline">
          <ButtonLink variant="tertiary" size="sm" href="/tara/essays" icon="layers">
            {state.writing.marked} marked {state.writing.marked === 1 ? 'essay' : 'essays'}
          </ButtonLink>
        </p>
      ) : null}
    </Page>
  );
}

export default WritingScreen;
