'use client';

/**
 * Pagination. Mono page numbers, current page on --accent-tint, truncation
 * with a gap marker once the range gets long.
 */

import { cn } from '../../lib/cn';
import Icon from '../Icon';

function pageRange(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'gap', total];
  if (page >= total - 3) return [1, 'gap', total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'gap', page - 1, page, page + 1, 'gap-end', total];
}

export function Pagination({ page = 1, total = 1, onChange, label = 'Pagination', className }) {
  if (total <= 1) return null;
  const go = (p) => onChange?.(Math.max(1, Math.min(total, p)));

  return (
    <nav className={cn('cd-pagination', className)} aria-label={label}>
      <button type="button" className="cd-pagebtn" onClick={() => go(1)} disabled={page === 1} aria-label="First page">
        <Icon name="chevronsLeft" size={15} />
      </button>
      <button type="button" className="cd-pagebtn" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page">
        <Icon name="chevronLeft" size={15} />
      </button>

      {pageRange(page, total).map((p) =>
        typeof p === 'number' ? (
          <button
            key={p}
            type="button"
            className="cd-pagebtn"
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            onClick={() => go(p)}
          >
            {p}
          </button>
        ) : (
          <span key={p} className="cd-pagebtn cd-pagebtn--gap" aria-hidden="true">
            ...
          </span>
        ),
      )}

      <button type="button" className="cd-pagebtn" onClick={() => go(page + 1)} disabled={page === total} aria-label="Next page">
        <Icon name="chevronRight" size={15} />
      </button>
      <button type="button" className="cd-pagebtn" onClick={() => go(total)} disabled={page === total} aria-label="Last page">
        <Icon name="chevronsRight" size={15} />
      </button>
    </nav>
  );
}

export default Pagination;
