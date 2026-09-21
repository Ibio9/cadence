'use client';

/**
 * Skeleton. Warm neutral, shaped like the real layout it stands in for.
 * There are no full page spinners anywhere in the app.
 */

import { cn } from '../../lib/cn';

const ROUNDED = {
  sm: '',
  pill: 'cd-skeleton--circle',
  card: 'cd-skeleton--card',
  circle: 'cd-skeleton--circle',
};

export function Skeleton({ width = '100%', height = '1rem', rounded = 'sm', className, style }) {
  return (
    <span
      aria-hidden="true"
      className={cn('cd-skeleton', ROUNDED[rounded], className)}
      style={{ width, height, ...style }}
    />
  );
}

/** A paragraph shaped run of skeleton lines, last line short like real text. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <span className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height="0.75rem" rounded="pill" width={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </span>
  );
}

export default Skeleton;
