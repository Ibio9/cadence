'use client';

/**
 * EmptyState and ErrorState.
 *
 * Empty is written as an invitation to start: one short Playfair line, one
 * sentence of guidance, one primary action.
 *
 * Error says in plain language what happened and what to do next, and always
 * offers a retry. It never shows a bare status code as the whole message.
 */

import Link from 'next/link';
import { cn } from '../../lib/cn';
import Icon from '../Icon';
import { Button } from './Button';

/**
 * An action on a state is either something that happens here (`onClick`) or
 * somewhere to go (`href`). A link is rendered as a link, so it opens in a new
 * tab, copies its address and reads as navigation to a screen reader — all of
 * which a button styled to look like one would break.
 */
function StateAction({ action, variant = 'primary' }) {
  if (!action) return null;
  if (action.href) {
    return (
      <Link href={action.href} className={cn('cd-btn', `cd-btn--${variant}`, 'no-underline')}>
        {action.icon ? (
          <span className="cd-btn__icon" aria-hidden="true">
            <Icon name={action.icon} size={16} />
          </span>
        ) : null}
        <span className="cd-btn__label">{action.label}</span>
      </Link>
    );
  }
  return (
    <Button variant={variant} icon={action.icon} onClick={action.onClick} loading={action.loading}>
      {action.label}
    </Button>
  );
}

export function EmptyState({ icon = 'sparkle', title, body, action, secondaryAction, className }) {
  return (
    <div className={cn('cd-state', className)}>
      <span className="cd-state__mark">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="cd-state__title">{title}</h3>
      {body ? <p className="cd-state__body">{body}</p> : null}
      {action || secondaryAction ? (
        <div className="cd-state__actions">
          <StateAction action={secondaryAction} variant="secondary" />
          <StateAction action={action} variant="primary" />
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = 'That did not load',
  body = 'The request did not come back. Check your connection and try again.',
  detail,
  onRetry,
  retryLabel = 'Try again',
  retrying = false,
  action,
  className,
}) {
  return (
    <div className={cn('cd-state', className)} role="alert">
      <span className="cd-state__mark cd-state__mark--danger">
        <Icon name="cloudOff" size={22} />
      </span>
      <h3 className="cd-state__title">{title}</h3>
      <p className="cd-state__body">{body}</p>
      {detail ? <p className="font-mono text-caption text-ink-subtle break-words max-w-prose">{detail}</p> : null}
      {onRetry || action ? (
        <div className="cd-state__actions">
          {onRetry ? (
            <Button variant="secondary" icon="refresh" onClick={onRetry} loading={retrying}>
              {retryLabel}
            </Button>
          ) : null}
          <StateAction action={action} variant="primary" />
        </div>
      ) : null}
    </div>
  );
}

/** Inline failure inside a card that still has usable content around it. */
export function InlineError({ children, onRetry, retryLabel = 'Try again', retrying = false, className }) {
  return (
    <div className={cn('cd-inline-error', className)} role="alert">
      <Icon name="alertCircle" size={16} />
      <div className="flex-1 min-w-0">{children}</div>
      {onRetry ? (
        <button type="button" className="cd-btn cd-btn--sm cd-btn--tertiary text-alarm" onClick={onRetry} disabled={retrying}>
          <span className="cd-btn__label">{retryLabel}</span>
        </button>
      ) : null}
    </div>
  );
}

/** Partial data notice: what loaded, what did not, stated plainly. */
export function PartialNotice({ children, className }) {
  return (
    <div className={cn('cd-inline-note', className)} role="status">
      <Icon name="alertTriangle" size={14} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default EmptyState;
