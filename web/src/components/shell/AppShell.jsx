'use client';

/**
 * The app shell, built once.
 *
 * Navigation is real routing: every item is a link to a URL, so the back
 * button, a bookmark and a pasted address all work. The active item is derived
 * from the path rather than held anywhere.
 *
 * Page gutters, max content width and the vertical rhythm between cards live
 * here in .cd-page and are never overridden by a screen. Under 768px the
 * sidebar becomes a bottom bar — carrying the five routes that are worth a
 * thumb, not all eight, because a nine-pixel label is not navigation.
 *
 * Focus is deliberately not in here. It is a route without a shell, because
 * the whole point of it is that nothing else is on the screen.
 *
 * The nav is chrome, so nothing in it ever glows.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/cn';
import Icon from '../Icon';
import { Avatar } from '../ui/Display';

export const VIEWS = [
  { href: '/', label: 'Today', icon: 'today', thumb: true },
  { href: '/timetable', label: 'Timetable', icon: 'timetable', thumb: true },
  { href: '/tara', label: 'TARA', icon: 'drill', thumb: true },
  { href: '/interview', label: 'Interview', icon: 'mic', thumb: true },
  { href: '/notes', label: 'Notes', icon: 'notes' },
  { href: '/jarvis', label: 'Jarvis', icon: 'jarvis', thumb: true },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

const THUMB = VIEWS.filter((v) => v.thumb);

const isActive = (pathname, href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

export function AppShell({ user = 'Ibrahim', children }) {
  const pathname = usePathname() || '/';

  return (
    <div className="cd-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav className="cd-sidebar" aria-label="Primary">
        <p className="cd-wordmark">Cadence</p>

        <ul className="flex flex-col gap-1 flex-1 list-none">
          {VIEWS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="cd-navitem"
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              >
                <Icon name={item.icon} size={18} className="cd-navitem__icon" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 px-3 py-2 pt-4">
          <Avatar name={user} size="sm" />
          <span className="text-sm text-ink font-medium truncate">{user}</span>
        </div>
      </nav>

      <main id="main" className="cd-main">
        {children}
      </main>

      <nav className="cd-mobilenav" aria-label="Primary">
        {THUMB.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="cd-mobilenav__item"
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </Link>
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
