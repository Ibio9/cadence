import './globals.css';
import { THEME_INIT_SCRIPT } from '../src/context/ThemeContext';

export const metadata = {
  title: 'Cadence',
  description: 'A personal operating system. Today, notes, timetable and Jarvis in one place.',
};

// The browser chrome colour is the one place a literal is unavoidable: a meta
// tag cannot read a CSS variable. These two mirror --bg in each theme and are
// the only literals outside src/styles/tokens.css.
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe4' },
    { media: '(prefers-color-scheme: dark)', color: '#14130f' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Sets data-theme before first paint so the stored theme is already in
          place when the page renders. The App Router has no index.html, so this
          inline script in head is the equivalent hook.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
