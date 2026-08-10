'use client';

/**
 * Tabs. Underline (default) and pill variants.
 *
 * Follows the tablist pattern: one tab stop for the whole set, Left and Right
 * (or Up and Down) move between tabs, Home and End jump to the ends.
 */

import { useRef } from 'react';
import { cn } from '../../lib/cn';
import Icon from '../Icon';

export function Tabs({ items = [], value, onChange, variant = 'underline', label = 'Sections', className }) {
  const refs = useRef([]);

  const move = (from, delta) => {
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + delta + enabled.length) % enabled.length];
    onChange?.(items[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e, index) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(index, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(-1, 1);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(0, -1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('cd-tabs', variant === 'underline' ? 'cd-tabs--underline' : 'cd-tabs--pill', className)}
    >
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            aria-controls={item.panelId}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange?.(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="cd-tab"
          >
            {item.icon ? <Icon name={item.icon} size={16} /> : null}
            <span>{item.label}</span>
            {item.count != null ? <span className="font-mono text-caption text-ink-subtle">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
