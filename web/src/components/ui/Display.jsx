'use client';

/**
 * Badge, Avatar, Tooltip, ProgressRing.
 *
 * Badge tones always pair the colour with an icon, so status never depends on
 * colour alone and survives a greyscale check.
 */

import { useId, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import Icon from '../Icon';

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

const TONE_CLASS = {
  neutral: 'cd-badge--neutral',
  accent: 'cd-badge--accent',
  success: 'cd-badge--success',
  warning: 'cd-badge--warning',
  danger: 'cd-badge--danger',
  outline: 'cd-badge--outline',
};

const TONE_ICON = {
  success: 'checkCircle',
  warning: 'alertTriangle',
  danger: 'alertCircle',
  accent: 'info',
};

export function Badge({ tone = 'neutral', icon, mono = false, className, children, ...rest }) {
  const resolvedIcon = icon === null ? null : icon || TONE_ICON[tone];
  return (
    <span className={cn('cd-badge', TONE_CLASS[tone] || TONE_CLASS.neutral, mono && 'cd-badge--mono', className)} {...rest}>
      {resolvedIcon ? <Icon name={resolvedIcon} size={12} strokeWidth={1.8} /> : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

function initialsOf(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ name = '', src, size = 'md', className }) {
  const initials = initialsOf(name);
  return (
    <span
      className={cn('cd-avatar', size === 'sm' && 'cd-avatar--sm', size === 'lg' && 'cd-avatar--lg', className)}
      role="img"
      aria-label={name || 'User'}
    >
      {src ? <img src={src} alt="" /> : initials || <Icon name="info" size={16} />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                    */
/* Opens on hover and on keyboard focus, so it is not mouse only.             */
/* -------------------------------------------------------------------------- */

export function Tooltip({ label, placement = 'top', children, className }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timer = useRef(null);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 120);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className={cn('cd-tooltip-anchor', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
    >
      <span aria-describedby={open ? id : undefined} className="contents">
        {children}
      </span>
      {open ? (
        <span role="tooltip" id={id} className={cn('cd-tooltip', placement === 'bottom' && 'cd-tooltip--bottom')}>
          {label}
        </span>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* ProgressRing                                                               */
/* Accent fill on a hairline track, mono percentage in the middle.            */
/* -------------------------------------------------------------------------- */

export function ProgressRing({ value = 0, size = 64, stroke = 5, label, showValue = true }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const complete = pct === 100;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="rotate-90-ccw"
        role="img"
        aria-label={label || `${pct} percent complete`}
      >
        <circle className="cd-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        {/* At zero the fill is omitted entirely: a rounded cap on a zero length
            dash renders as a stray dot on the track. */}
        {pct > 0 ? (
          <circle
            className={cn('cd-ring__fill', complete && 'cd-ring__fill--done')}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        ) : null}
      </svg>
      {showValue ? (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-caption font-medium text-ink">
          {pct}
        </span>
      ) : null}
    </div>
  );
}

export default Badge;
