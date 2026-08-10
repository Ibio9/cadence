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

import { cn } from '../../lib/cn';
import Icon from '../Icon';
import { Button } from './Button';

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
          {secondaryAction ? (
            <Button variant="secondary" icon={secondaryAction.icon} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          {action ? (
            <Button variant="primary" icon={action.icon} onClick={action.onClick} loading={action.loading}>
              {action.label}
            </Button>
          ) : null}
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
      {onRetry ? (
        <div className="cd-state__actions">
          <Button variant="secondary" icon="refresh" onClick={onRetry} loading={retrying}>
            {retryLabel}
          </Button>
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
        <button type="button" className="cd-btn cd-btn--sm cd-btn--tertiary text-danger" onClick={onRetry} disabled={retrying}>
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
