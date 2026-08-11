/**
 * The icon set. One family, line style only, 24 unit grid, 1.5 stroke, round
 * caps and joins. Colour is always inherited so icons pick up the token on the
 * element around them. No emoji anywhere in the UI.
 *
 * Usage: <Icon name="check" size={16} />
 */

const PATHS = {
  // navigation
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  today: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  notes: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h8L19 7.5v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M14 3v5h5M8.5 13h7M8.5 17h4" />
    </>
  ),
  timetable: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  jarvis: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),

  // actions
  check: <path d="M4.5 12.5l5 5 10-11" />,
  play: <path d="M7 4.8v14.4a1 1 0 0 0 1.53.85l11.2-7.2a1 1 0 0 0 0-1.7L8.53 3.95A1 1 0 0 0 7 4.8z" />,
  pause: <path d="M9 4.5v15M15 4.5v15" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  send: <path d="M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 10z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20.5 20.5l-4.2-4.2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </>
  ),
  edit: <path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17V20zM15 6.5l2.5 2.5" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-.8 4.5" />
      <path d="M20 5v6h-6" />
    </>
  ),
  sparkle: <path d="M12 3l2.1 5.6L20 10.5l-5.9 1.9L12 18l-2.1-5.6L4 10.5l5.9-1.9z" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  chevronUp: <path d="M6 14.5l6-6 6 6" />,
  chevronLeft: <path d="M14.5 6l-6 6 6 6" />,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  chevronsLeft: <path d="M17 6l-6 6 6 6M11 6l-6 6 6 6" />,
  chevronsRight: <path d="M7 6l6 6-6 6M13 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,

  // status. Every status colour is paired with one of these so meaning is
  // never carried by colour alone.
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.7 2.7L16 9.5" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M10.6 4.2L2.9 17.5A1.6 1.6 0 0 0 4.3 20h15.4a1.6 1.6 0 0 0 1.4-2.5L13.4 4.2a1.6 1.6 0 0 0-2.8 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 8h.01" />
    </>
  ),
  cloudOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M17.6 17.9H7a4 4 0 0 1-.6-8A6 6 0 0 1 8 7.4M11.3 6.1A6 6 0 0 1 18 11.2a3.9 3.9 0 0 1 2.4 5.3" />
    </>
  ),

  // content
  inbox: (
    <>
      <path d="M3.5 13.5h4l1.5 3h6l1.5-3h4" />
      <path d="M5.4 5.2A1.5 1.5 0 0 1 6.8 4.2h10.4a1.5 1.5 0 0 1 1.4 1l2.4 8.3v4a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 17.5v-4z" />
    </>
  ),
  flame: <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.7.8-3 1.6-4 .2 1.2.9 2 1.9 2 1.4 0 1.5-1.6 1.5-3 0-2 0-4 0-4z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  calendarPlus: (
    <>
      <path d="M21 11V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7" />
      <path d="M3 11h18M8 4v4M16 4v4M17.5 15v6M14.5 18h6" />
    </>
  ),
  download: <path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5M4 19.5h16" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3z" />
      <path d="M7.5 12h.01M9.8 8.3h.01M14.2 7.5h.01" />
    </>
  ),
};

export function Icon({ name, size = 20, strokeWidth = 1.5, className = '', title, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {d}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS);
export default Icon;
