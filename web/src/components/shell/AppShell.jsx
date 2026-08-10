'use client';

/**
 * The app shell, built once.
 *
 * Sidebar sits on --bg, not on a card. Active item is a soft --accent-tint
 * pill with --ink text. Inactive items are --ink-muted with line icons and a
 * warm neutral hover, never blue.
 *
 * Page gutters, max content width and the vertical rhythm between cards live
 * here in .cd-page and are never overridden by a screen. Under 768px the
 * sidebar becomes a bottom bar carrying the same active state language.
 *
 * Navigation is the app's existing client side view state. No route changes.
 */

import { cn } from '../../lib/cn';
import Icon from '../Icon';
import { Avatar } from '../ui/Display';
import { useTheme } from '../../context/ThemeContext';

export const VIEWS = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'notes', label: 'Notes', icon: 'notes' },
  { id: 'timetable', label: 'Timetable', icon: 'timetable' },
  { id: 'jarvis', label: 'Jarvis', icon: 'jarvis' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const goingDark = theme !== 'dark-blue';
  const label = goingDark ? 'Switch to dark blue' : 'Switch to light blue';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn('cd-navitem', compact && 'justify-center')}
      aria-label={label}
    >
      <Icon name={goingDark ? 'moon' : 'sun'} size={18} className="cd-navitem__icon" />
      {compact ? null : <span>{goingDark ? 'Dark blue' : 'Light blue'}</span>}
    </button>
  );
}

export function AppShell({ view, onViewChange, user = 'Ibrahim', children }) {
  return (
    <div className="cd-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav className="cd-sidebar" aria-label="Primary">
        <p className="cd-wordmark">Cadence</p>

        <ul className="flex flex-col gap-1 flex-1 list-none">
          {VIEWS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="cd-navitem"
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => onViewChange(item.id)}
              >
                <Icon name={item.icon} size={18} className="cd-navitem__icon" />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 pt-4">
          <ThemeToggle />
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar name={user} size="sm" />
            <span className="text-sm text-ink font-medium truncate">{user}</span>
          </div>
        </div>
      </nav>

      <main id="main" className="cd-main">
        {children}
      </main>

      <nav className="cd-mobilenav" aria-label="Primary">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="cd-mobilenav__item"
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => onViewChange(item.id)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * The page container every screen composes into. Gutters, max width and card
 * spacing come from tokens and are identical on every screen.
 */
export function Page({ className, children }) {
  return <div className={cn('cd-page', className)}>{children}</div>;
}

export default AppShell;
