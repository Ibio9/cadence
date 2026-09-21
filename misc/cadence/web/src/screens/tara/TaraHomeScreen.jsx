'use client';

/**
 * TARA Drill — the three modules.
 *
 * The tree is the diagnosis: every node carries its own accuracy, so the way
 * in tells you where you are weak before you have opened anything. Nothing
 * here is averaged across modules — a strong Problem Solving score must not be
 * allowed to hide a weak Critical Thinking one.
 */

import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { Page } from '../../components/shell/AppShell';
import Icon from '../../components/Icon';
import BankBuild from '../../components/tara/BankBuild';
import { Badge, ButtonLink, EmptyState, ErrorState, PageHeading, Skeleton, useToast } from '../../components/ui';
import { pct, standing, useBankBuild, useTaraState } from '../../lib/tara';

function HomeSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="7rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(16rem, 60%)" height="2.4rem" rounded="pill" />
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height="7rem" rounded="card" />
      ))}
    </Page>
  );
}

/** The one number that matters, said plainly. */
function Readiness({ readiness }) {
  const rows = Object.values(readiness || {});
  if (!rows.some((r) => r.answered)) return null;

  return (
    <section className="cd-readiness" aria-label="Readiness">
      <p className="cd-eyebrow">Against the target — 20 of 22, under time</p>
      <ul className="cd-readiness__list list-none">
        {rows.map((r) => {
          const ready = r.projected != null && r.projected >= r.target && r.onPace;
          return (
            <li key={r.module} className="cd-readiness__row">
              <span className="cd-readiness__name">{r.name}</span>
              {r.answered === 0 ? (
                <span className="cd-readiness__none">Nothing answered yet</span>
              ) : (
                <>
                  <span className="cd-readiness__score">
                    {r.projected}
                    <span className="cd-readiness__of">/22</span>
                  </span>
                  <Badge tone={ready ? 'success' : r.projected >= r.target - 3 ? 'warning' : 'danger'}>
                    {ready ? 'On target' : r.onPace ? 'Short on accuracy' : 'Over time'}
                  </Badge>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ModuleCard({ module }) {
  const s = standing(module.accuracy);
  const empty = module.kind === 'mcq' && module.bank === 0;

  return (
    <li>
      <Link href={`/tara/${module.id}`} className="cd-modulecard">
        <span className="cd-modulecard__head">
          <span className="cd-modulecard__name">{module.name}</span>
          {module.kind === 'mcq' ? (
            <span className="cd-modulecard__acc">
              <span className="cd-modulecard__pct">{pct(module.accuracy)}</span>
              <Badge tone={s.tone}>{s.label}</Badge>
            </span>
          ) : (
            <Badge tone="neutral">Essay</Badge>
          )}
        </span>
        <span className="cd-modulecard__blurb">{module.blurb}</span>
        <span className="cd-modulecard__meta">
          {module.kind === 'mcq' ? (
            <>
              <span>{module.bank} in the bank</span>
              <span>{module.asked} answered</span>
              <span>{module.subcategories.length} types</span>
            </>
          ) : (
            <span>{module.minutes} minutes · {module.wordLimit} words</span>
          )}
          <Icon name="chevronRight" size={15} className="cd-modulecard__go" />
        </span>
        {empty ? <span className="cd-modulecard__warn">Still being written.</span> : null}
      </Link>
    </li>
  );
}

export function TaraHomeScreen() {
  const { data, status, error, reload } = useTaraState();
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);

  // When a build finishes, the counts on this screen are stale by exactly the
  // number of questions it just wrote, so pull them again.
  const build = useBankBuild({ onDone: reload });

  const startBuild = async () => {
    setStarting(true);
    try {
      await api.tara.buildBank();
    } catch (e) {
      toast({ tone: 'danger', title: 'The bank did not start writing', description: e.message });
    }
    setStarting(false);
  };

  if (status === 'loading' && !data) return <HomeSkeleton />;
  if (status === 'error' && !data) {
    return (
      <Page>
        <ErrorState
          title="TARA did not load"
          body="The server did not answer. Your bank is on it, so nothing is lost. Check your connection and try again."
          detail={error}
          onRetry={reload}
        />
      </Page>
    );
  }

  const totalBank = data.modules.reduce((n, m) => n + m.bank, 0);

  return (
    <Page>
      <PageHeading
        eyebrow="Exam prep"
        title="TARA Drill"
        lead="Three modules. Pick a type, drill it, and read where you are weak off the tree."
        actions={
          <div className="flex items-center gap-1">
            <ButtonLink variant="secondary" icon="target" href="/tara/progress">
              Progress
            </ButtonLink>
            <ButtonLink variant="secondary" icon="notes" href="/tara/reference">
              Reference
            </ButtonLink>
          </div>
        }
      />

      <Readiness readiness={data.readiness} />

      {/* From cold, the empty state below already offers to start it, and two
          identical buttons on one screen is one button too many. So the strip
          keeps the diagnosis and gives up the verb. */}
      <BankBuild
        state={build}
        onStart={totalBank === 0 ? undefined : startBuild}
        starting={starting}
      />

      {totalBank === 0 && !build?.running ? (
        <EmptyState
          title="The bank fills itself"
          body="Fifteen questions for every type, written from that type's own construction rules and checked before they go in. It runs on the server and takes about half an hour from cold. Nothing here needs you — come back later, or start it now if it has not begun."
          action={{ label: 'Write them now', onClick: startBuild, icon: 'sparkle', loading: starting }}
          secondaryAction={{ label: 'Add a past-paper question', href: '/tara/bank', icon: 'plus' }}
        />
      ) : (
        <ul className="cd-modules list-none">
          {data.modules.map((m) => (
            <ModuleCard key={m.id} module={m} />
          ))}
        </ul>
      )}

      {/* The two official practice tests are the only material that mirrors the
          real software. Spending them early wastes the one honest rehearsal
          available, so the app says so rather than leaving it to memory. */}
      <aside className="cd-holdback">
        <Icon name="info" size={16} className="cd-holdback__icon" />
        <p>
          <strong>Save the two official practice tests.</strong> They are on the Pearson VUE landing page and
          mirror the live software. Do not open them for drilling — sit them under real conditions in the final
          phase, when they are worth something. Everything here is practice for that.
        </p>
      </aside>

      <p className="cd-bankline">
        <Link href="/tara/bank">{totalBank} questions in the bank — browse, filter or add your own</Link>
      </p>
    </Page>
  );
}

export default TaraHomeScreen;
