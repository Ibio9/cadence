'use client';

/**
 * Card and its parts.
 *
 * Page ground is --bg, a card is --surface, an overlay is --surface-raised.
 * Card padding and radius come from the shell tokens and are never overridden
 * per screen. Pass `as="section"` when the card is a landmark region.
 */

import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export const Card = forwardRef(function Card(
  { as: Tag = 'div', variant = 'default', interactive = false, selected = false, className, children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn(
        'cd-card',
        variant === 'raised' && 'cd-card--raised',
        variant === 'flat' && 'cd-card--flat',
        interactive && 'cd-card--interactive',
        selected && 'cd-card--selected',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export function CardHeader({ title, eyebrow, description, actions, className, children }) {
  return (
    <div className={cn('cd-card__header', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-eyebrow text-ink-subtle">{eyebrow}</p> : null}
        {title ? (
          <h2 className={cn('font-display text-xl text-ink tracking-tight', eyebrow && 'mt-2')}>{title}</h2>
        ) : null}
        {description ? <p className="text-sm text-ink-muted mt-1">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children, ...rest }) {
  return (
    <div className={cn('cd-card__body', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children }) {
  return <div className={cn('cd-card__footer', className)}>{children}</div>;
}

export function CardDivider({ className }) {
  return <hr className={cn('cd-card__divider', className)} />;
}

export default Card;
