'use client';

/**
 * PageHeading.
 *
 * The one heading pattern in the app: a small uppercase letterspaced eyebrow,
 * a large display heading, then one supporting line in body type. Once per
 * screen, never twice. Built as a component so it cannot drift.
 *
 * `lead` is the supporting line. `leadLoading` renders a skeleton in its place
 * so the heading keeps its height while the line is still resolving, and
 * `leadError` renders the failure inline instead of blanking the heading.
 */

import { cn } from '../../lib/cn';
import { Skeleton } from './Skeleton';

export function PageHeading({
  eyebrow,
  title,
  lead,
  leadLoading = false,
  leadError = null,
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

          {leadLoading ? (
            <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
              <Skeleton width="min(38rem, 100%)" height="0.9rem" rounded="pill" />
              <Skeleton width="min(24rem, 80%)" height="0.9rem" rounded="pill" />
            </div>
          ) : leadError ? (
            <p className="cd-heading__accent text-alarm text-sm">{leadError}</p>
          ) : lead ? (
            <p className="cd-heading__accent">{lead}</p>
          ) : null}
        </div>

        {actions ? <div className="cd-heading__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export default PageHeading;
