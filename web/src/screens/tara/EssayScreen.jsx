'use client';

/**
 * A marked essay.
 *
 * The report is ordered the way it is most useful, not the way it is most
 * comfortable: the structural failure first if there is one, then the criteria,
 * then every typo individually, then the model answer, then the places yours
 * diverged from it with both sides quoted.
 */

import { Page } from '../../components/shell/AppShell';
import Icon from '../../components/Icon';
import { Badge, ButtonLink, ErrorState, PageHeading, Skeleton, Tabs } from '../../components/ui';
import { useResource } from '../../lib/tara';
import { api } from '../../../lib/api';
import { useState } from 'react';

const VERDICT_TONE = { met: 'success', partial: 'warning', failed: 'danger' };
const VERDICT_WORD = { met: 'Met', partial: 'Partly', failed: 'Failed' };

export function EssayScreen({ id }) {
  const { data, status, error, reload } = useResource(() => api.tara.essay(id), [id]);
  const [tab, setTab] = useState('mark');

  if (status === 'loading' && !data) {
    return (
      <Page>
        <Skeleton width="8rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(20rem,70%)" height="2.2rem" rounded="pill" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height="4rem" rounded="card" />
        ))}
      </Page>
    );
  }

  if (status === 'error' || !data) {
    return (
      <Page>
        <ErrorState
          title="That essay did not load"
          body="It was deleted, or the server did not answer. Open the writing task and pick it from the list."
          detail={error}
          onRetry={reload}
          action={{ label: 'Back to the writing task', href: '/tara/writing' }}
        />
      </Page>
    );
  }

  const mark = data.mark;
  if (!mark) {
    return (
      <Page>
        <ErrorState
          title="This one was never submitted"
          body="It is saved as a draft. Open the writing task, start a fresh sitting on the same prompt, and finish it."
          action={{ label: 'Back to the writing task', href: '/tara/writing' }}
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeading
        eyebrow="Writing task · marked"
        title={`${mark.score}/10`}
        lead={mark.verdict}
        actions={
          <ButtonLink variant="secondary" icon="arrowLeft" href="/tara/writing">
            Writing task
          </ButtonLink>
        }
      />

      <p className="cd-essaymeta">
        <span>{mark.words} words</span>
        {mark.overLimit ? <Badge tone="danger">Over the 750 limit</Badge> : null}
        <span>{Math.round((data.seconds || 0) / 60)} of 40 minutes</span>
        <span>{mark.typos.length} slips</span>
      </p>

      {mark.structuralFailure ? (
        <p className="cd-structural" role="alert">
          <Icon name="alertTriangle" size={18} />
          <span>
            <strong>Structural failure.</strong> {mark.structuralNote} This outranks everything else on the page:
            the task is three questions, and an answer that leaves one of them out cannot score well however it
            reads.
          </span>
        </p>
      ) : null}

      <Tabs
        items={[
          { value: 'mark', label: 'The mark' },
          { value: 'typos', label: `Slips (${mark.typos.length})` },
          { value: 'model', label: 'Model answer' },
          { value: 'diff', label: 'Where yours diverged' },
          { value: 'mine', label: 'What you wrote' },
        ]}
        value={tab}
        onChange={setTab}
        label="Marking"
      />

      {tab === 'mark' ? (
        <ul className="cd-criteria list-none">
          {mark.criteria.map((c) => (
            <li key={c.id} className={`cd-criterion is-${c.verdict}`}>
              <p className="cd-criterion__head">
                <Badge tone={VERDICT_TONE[c.verdict]}>{VERDICT_WORD[c.verdict]}</Badge>
                <span className="cd-criterion__name">{c.name}</span>
              </p>
              <p className="cd-criterion__evidence">{c.evidence}</p>
              {c.fix ? (
                <p className="cd-criterion__fix">
                  <span className="cd-eyebrow">Fix</span>
                  {c.fix}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'typos' ? (
        mark.typos.length === 0 ? (
          <p className="cd-empty-inline">No spelling, grammar or punctuation slips. That is rarer than it sounds.</p>
        ) : (
          <ul className="cd-typos list-none">
            {mark.typos.map((t, i) => (
              <li key={i}>
                <span className="cd-typos__quote">{t.quote}</span>
                <span className="cd-typos__problem">{t.problem}</span>
                <span className="cd-typos__fix">{t.correction}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'model' ? (
        <article className="cd-essaytext">
          {String(data.exemplar || '')
            .split(/\n{2,}/)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </article>
      ) : null}

      {tab === 'diff' ? (
        <ul className="cd-divergences list-none">
          {(data.divergences || []).map((d, i) => (
            <li key={i}>
              <p className="cd-diverge__mine">
                <span className="cd-eyebrow">You wrote</span>
                {d.mine}
              </p>
              <p className="cd-diverge__alt">
                <span className="cd-eyebrow">The model answer</span>
                {d.alternative}
              </p>
              <p className="cd-diverge__note">{d.note}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'mine' ? (
        <article className="cd-essaytext">
          <p className="cd-essaytext__prompt">{data.prompt?.statement}</p>
          {String(data.text || '')
            .split(/\n{2,}/)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </article>
      ) : null}
    </Page>
  );
}

export default EssayScreen;
