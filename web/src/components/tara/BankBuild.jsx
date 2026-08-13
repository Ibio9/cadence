'use client';

/**
 * The bank writing itself, made visible.
 *
 * This is background work, so the strip is written to be read at a glance and
 * then ignored: one line of plain English, one hairline of progress, and no
 * controls unless something is genuinely wrong. It never blocks anything —
 * every screen it appears on is fully usable while it runs.
 *
 * It is one of the few things allowed to emit, on the same grounds Jarvis is:
 * something is genuinely happening. The light sits on the filled part of the
 * bar and nowhere else, and it breathes only while the build is running.
 */

import { Button } from '../ui';
import Icon from '../Icon';

/** "Critical Thinking assumptions, and two others" rather than a list of six. */
function writingLine(names) {
  if (!names?.length) return 'Starting.';
  if (names.length === 1) return `Writing ${names[0]}.`;
  if (names.length === 2) return `Writing ${names[0]} and ${names[1]}.`;
  return `Writing ${names[0]} and ${names.length - 1} others.`;
}

export function BankBuild({ state, onStart, starting }) {
  if (!state) return null;

  const { running, kind, target, written, rejected, writing, remaining, short, lastError } = state;

  /* Nothing running and nothing owed: say nothing at all. A permanent "the bank
     is full" banner is a status light for a thing that is true almost always,
     which is the definition of noise. */
  if (!running && !short && !lastError) return null;

  if (!running) {
    // Owed but stopped. Either there is no key, or a build ran out of retries.
    return (
      <aside className="cd-bankbuild cd-bankbuild--stalled" role="status">
        <div className="cd-bankbuild__head">
          <p className="cd-bankbuild__line">
            {short
              ? `${short} question ${short === 1 ? 'type is' : 'types are'} short of a full set.`
              : 'The bank stopped writing itself.'}
          </p>
          {onStart ? (
            <Button variant="secondary" size="sm" icon="sparkle" loading={starting} onClick={onStart}>
              Write them now
            </Button>
          ) : null}
        </div>
        {lastError ? (
          <p className="cd-bankbuild__problem">
            <Icon name="alertCircle" size={13} />
            {lastError}
          </p>
        ) : null}
      </aside>
    );
  }

  const pct = target > 0 ? Math.min(100, (written / target) * 100) : 0;

  return (
    <aside className="cd-bankbuild" role="status" aria-live="polite">
      <div className="cd-bankbuild__head">
        <p className="cd-bankbuild__line">
          {kind === 'seed' ? 'Stocking the bank.' : 'Topping the bank up.'} {writingLine(writing)}
        </p>
        <p className="cd-bankbuild__count">
          <span className="cd-bankbuild__written">{written}</span>
          <span className="cd-bankbuild__of">of {target}</span>
        </p>
      </div>

      {/* The same rail as everywhere else, horizontal. The head of the fill is
          the only thing lit. */}
      <div
        className="cd-bankbuild__rail"
        style={{ '--progress': `${pct.toFixed(1)}%` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={written}
        aria-valuetext={`${written} of ${target} questions written`}
      >
        <span className="cd-bankbuild__fill cd-breathes" />
      </div>

      <p className="cd-bankbuild__foot">
        {remaining} {remaining === 1 ? 'type' : 'types'} to go. Drill anything that already has questions — this
        keeps going while you do.
        {rejected ? ` ${rejected} thrown out for failing the checks.` : ''}
      </p>
    </aside>
  );
}

export default BankBuild;
