'use client';

/**
 * Retention, per project.
 *
 * Every topic you have worked on, as a curve, ordered by how far it has
 * slipped. The ones below the line are what needs revising — and the honest
 * claim this screen makes is that ordering, not any number on it.
 */

import { useMemo } from 'react';
import { Page } from '../components/shell/AppShell';
import Curve from '../components/Curve';
import Icon from '../components/Icon';
import { Badge, ButtonLink, EmptyState, ErrorState, PageHeading, Skeleton } from '../components/ui';
import { agoLabel, halfLifeLabel, standingOf, useRetention } from '../lib/retention';

function RetentionSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="7rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(16rem, 60%)" height="2.4rem" rounded="pill" />
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height="9rem" rounded="card" />
      ))}
    </Page>
  );
}

function TopicRow({ topic, thresholds }) {
  const s = standingOf(topic.strength, thresholds);
  const half = halfLifeLabel(topic.half);

  return (
    <li className="cd-topicrow">
      <div className="cd-topicrow__body">
        <p className="cd-topicrow__name">{topic.label}</p>
        <p className="cd-topicrow__meta">
          <span>Last worked {agoLabel(topic.daysSince)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {topic.sessions} {topic.sessions === 1 ? 'session' : 'sessions'}
          </span>
          {half ? (
            <>
              <span aria-hidden="true">·</span>
              <span>half gone in {half}</span>
            </>
          ) : null}
        </p>
      </div>
      <Curve topic={topic} width={200} height={48} lit={topic.strength < (thresholds?.faded ?? 0.35)} />
      <Badge tone={s.tone}>{s.label}</Badge>
    </li>
  );
}

export function RetentionScreen() {
  const { data, status, error, reload } = useRetention();

  const byProject = useMemo(() => {
    if (!data) return [];
    const names = Object.fromEntries(data.projects.map((p) => [p.id, p.name]));
    const groups = new Map();
    for (const t of data.topics) {
      const id = t.projectId || 'other';
      if (!groups.has(id)) groups.set(id, { id, name: names[id] || 'Everything else', topics: [] });
      groups.get(id).topics.push(t);
    }
    // Worst project first: the one with most topics under the line is the one
    // to open, and burying it under an alphabetical list would be a choice to
    // make it harder to find.
    return [...groups.values()].sort(
      (a, b) =>
        b.topics.filter((t) => t.strength < data.thresholds.revise).length -
        a.topics.filter((t) => t.strength < data.thresholds.revise).length,
    );
  }, [data]);

  if (status === 'loading' && !data) return <RetentionSkeleton />;
  if (status === 'error' && !data) {
    return (
      <Page>
        <ErrorState
          title="Retention did not load"
          body="The server did not answer. Nothing here is stored in this browser — it is computed from the blocks you have held. Check your connection and try again."
          detail={error}
          onRetry={reload}
        />
      </Page>
    );
  }

  const needing = data.topics.filter((t) => t.strength < data.thresholds.revise);

  return (
    <Page>
      <PageHeading
        eyebrow="Decay"
        title="Retention"
        lead="Everything you have worked on, and how long ago. A topic hit three times over three weeks holds far longer than one hit once — the spacing does the work, not the hours."
      />

      {data.topics.length === 0 ? (
        <EmptyState
          title="Hold a block and this fills in"
          body="Every block you mark held becomes a session on a curve, and every TARA set you sit becomes one too. Nothing needs tagging — a topic is a block's own title, so this works backwards over days you have already done."
          action={{ label: 'Open today', href: '/', icon: 'today' }}
        />
      ) : (
        <>
          <section className="cd-revise">
            <p className="cd-eyebrow">What to revise</p>
            {needing.length === 0 ? (
              <p className="cd-revise__none">Nothing is under the line. Everything you have worked on is still holding.</p>
            ) : (
              <ol className="cd-revise__list list-none">
                {needing.slice(0, 5).map((t, i) => (
                  <li key={t.key} className="cd-revise__item">
                    <span className="cd-revise__n">{i + 1}</span>
                    <span className="cd-revise__name">{t.label}</span>
                    <span className="cd-revise__ago">{agoLabel(t.daysSince)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {byProject.map((group) => (
            <section key={group.id} className="cd-section" aria-label={group.name}>
              <h2 className="cd-section__title">{group.name}</h2>
              <ul className="cd-topiclist list-none">
                {group.topics.map((t) => (
                  <TopicRow key={t.key} topic={t} thresholds={data.thresholds} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {/* Said in the interface, not only in a comment nobody reads. A screen
          that shows a curve and stays quiet about what the curve is would be
          inviting a number to be believed. */}
      <aside className="cd-holdback">
        <Icon name="info" size={16} className="cd-holdback__icon" />
        <p>
          <strong>This is a model, not a measurement.</strong> {data.model.caveat.split('. ').slice(1).join('. ')} The
          shape is right — spaced work lasts, crammed work does not — and the order is worth acting on. The height of
          any one line is a guess with a decimal point on it, which is why this screen never prints one.
        </p>
      </aside>

      <p className="cd-poolline">
        <ButtonLink variant="tertiary" icon="jarvis" href="/jarvis">
          Ask Jarvis to plan around this
        </ButtonLink>
      </p>
    </Page>
  );
}

export default RetentionScreen;
