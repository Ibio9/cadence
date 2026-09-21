'use client';

/**
 * Spinner, Button, IconButton.
 *
 * Button variants: primary, secondary, tertiary, ghost, danger, danger-solid.
 * Sizes: sm, md (default), lg.
 * States: rest, hover, active, focus, disabled, loading.
 *
 * Loading swaps the leading icon for a spinner and keeps the label in place,
 * so the button never changes width and nothing on the row shifts. A button
 * with no leading icon reserves the spinner slot while loading, which is the
 * only width the label can lose, so the reserved slot is added to both states.
 */

import Link from 'next/link';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';
import Icon from '../Icon';

const SPINNER_SIZE = { sm: 14, md: 16, lg: 18 };

export function Spinner({ size = 'md', label = 'Loading', className }) {
  const px = SPINNER_SIZE[size] || SPINNER_SIZE.md;
  return (
    <span className={cn('cd-spinner', className)} role="status" aria-live="polite">
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
        <path
          className="cd-spinner__track"
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

const VARIANTS = {
  primary: 'cd-btn--primary',
  // The verb that starts something. The only button in the app that emits,
  // and only because starting is the meaning the whole screen is built round.
  go: 'cd-btn--go',
  secondary: 'cd-btn--secondary',
  tertiary: 'cd-btn--tertiary',
  ghost: 'cd-btn--ghost',
  danger: 'cd-btn--danger',
  'danger-solid': 'cd-btn--danger-solid',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    iconEnd,
    loading = false,
    disabled = false,
    block = false,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  const showLeadingSlot = Boolean(icon) || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'cd-btn',
        VARIANTS[variant] || VARIANTS.primary,
        size === 'sm' && 'cd-btn--sm',
        size === 'lg' && 'cd-btn--lg',
        block && 'cd-btn--block',
        loading && 'is-loading',
        className,
      )}
      {...rest}
    >
      {showLeadingSlot ? (
        <span className="cd-btn__icon" aria-hidden={loading ? undefined : 'true'}>
          {loading ? <Spinner size={size} /> : <Icon name={icon} size={16} />}
        </span>
      ) : null}
      <span className="cd-btn__label">{children}</span>
      {iconEnd && !loading ? (
        <span className="cd-btn__icon" aria-hidden="true">
          <Icon name={iconEnd} size={16} />
        </span>
      ) : null}
    </button>
  );
});

/**
 * A button that is really a link.
 *
 * Somewhere to go is not the same as something to do. Rendering navigation as
 * a <button> loses the middle-click, the copy-address, the open-in-new-tab and
 * the "link" announcement — so anything that changes the URL uses this, and
 * anything that acts on the page uses Button. They are the same object to look
 * at and different objects to use.
 */
export const ButtonLink = forwardRef(function ButtonLink(
  { href, variant = 'primary', size = 'md', icon, iconEnd, block = false, className, children, ...rest },
  ref,
) {
  return (
    <Link
      ref={ref}
      href={href}
      className={cn(
        'cd-btn',
        VARIANTS[variant] || VARIANTS.primary,
        size === 'sm' && 'cd-btn--sm',
        size === 'lg' && 'cd-btn--lg',
        block && 'cd-btn--block',
        'no-underline',
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span className="cd-btn__icon" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <span className="cd-btn__label">{children}</span>
      {iconEnd ? (
        <span className="cd-btn__icon" aria-hidden="true">
          <Icon name={iconEnd} size={16} />
        </span>
      ) : null}
    </Link>
  );
});

const ICON_VARIANTS = {
  ghost: '',
  primary: 'cd-iconbtn--primary',
  secondary: 'cd-iconbtn--secondary',
  danger: 'cd-iconbtn--danger',
};

/** Icon only control. `label` is required and becomes the accessible name. */
export const IconButton = forwardRef(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', loading = false, disabled = false, type = 'button', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('cd-iconbtn', ICON_VARIANTS[variant], size === 'sm' && 'cd-iconbtn--sm', className)}
      {...rest}
    >
      {loading ? <Spinner size={size} label={label} /> : <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
});

export default Button;
