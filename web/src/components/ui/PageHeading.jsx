'use client';

/**
 * PageHeading.
 *
 * The one heading pattern in the app: small uppercase letterspaced eyebrow in
 * --ink-subtle, a large Playfair heading in --ink, then a second Playfair line
 * in italic --accent. Once per screen, never twice. Built as a component so it
 * cannot drift.
 *
 * `accent` is the italic line. `accentLoading` renders a skeleton in its place
 * so the heading keeps its height while the line is still resolving, and
 * `accentError` renders the failure inline instead of blanking the heading.
 */

import { cn } from '../../lib/cn';
import { Skeleton } from './Skeleton';

export function PageHeading({
  eyebrow,
  title,
  accent,
  accentLoading = false,
  accentError = null,
  actions,
  level = 1,
  className,
}) {
  const Tag = `h${level}`;
  return (
    <header className={cn('cd-heading', className)}>
      <div className="cd-heading__row">
        <div className="min-w-0">
          {eyebrow ? <p className="cd-heading__eyebrow">{eyebrow}</p> : null}
          <Tag className="cd-heading__title">{title}</Tag>

          {accentLoading ? (
            <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
              <Skeleton width="min(38rem, 100%)" height="0.9rem" rounded="pill" />
              <Skeleton width="min(24rem, 80%)" height="0.9rem" rounded="pill" />
            </div>
          ) : accentError ? (
            <p className="cd-heading__accent not-italic text-ink-muted font-sans text-sm">{accentError}</p>
          ) : accent ? (
            <p className="cd-heading__accent">{accent}</p>
          ) : null}
        </div>

        {actions ? <div className="cd-heading__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export default PageHeading;
