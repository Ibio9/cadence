'use client';

/**
 * Table. Hairline row dividers, no zebra striping, no vertical rules.
 * Numeric columns are mono, right aligned and tabular so decimals stack.
 * Row hover is a warm tint, a selected row is --accent-tint.
 *
 * Columns: { key, header, numeric?, width?, render? }
 * States: loading (row shaped skeletons), empty (a caption row, never a blank
 * table), error is handled by the caller with ErrorState.
 */

import { cn } from '../../lib/cn';
import { Skeleton } from './Skeleton';

export function Table({
  columns = [],
  rows = [],
  getRowId = (r, i) => r.id ?? i,
  selectedId,
  onRowClick,
  loading = false,
  loadingRows = 4,
  emptyMessage = 'Nothing here yet.',
  caption,
  className,
}) {
  return (
    <div className="cd-tablewrap">
      <table className={cn('cd-table', className)}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn(c.numeric && 'cd-num')} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: loadingRows }, (_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn(c.numeric && 'cd-num')}>
                      <Skeleton height="0.75rem" rounded="pill" width={c.numeric ? '3.5rem' : '70%'} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center text-sm text-ink-muted py-8">
                      {emptyMessage}
                    </td>
                  </tr>
                )
              : rows.map((row, i) => {
                  const id = getRowId(row, i);
                  const selected = selectedId != null && id === selectedId;
                  return (
                    <tr
                      key={id}
                      className={cn(onRowClick && 'is-interactive', selected && 'is-selected')}
                      aria-selected={selected || undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={
                        onRowClick
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onRowClick(row);
                              }
                            }
                          : undefined
                      }
                    >
                      {columns.map((c) => (
                        <td key={c.key} className={cn(c.numeric && 'cd-num')}>
                          {c.render ? c.render(row) : row[c.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
