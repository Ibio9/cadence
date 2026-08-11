import './globals.css';
import { THEME_INIT_SCRIPT } from '../src/context/ThemeContext';
import { Providers } from './providers';

export const metadata = {
  title: 'Cadence',
  description: 'The day, one block at a time.',
};

// The browser chrome colour is the one place a literal is unavoidable: a meta
// tag cannot read a CSS variable. These two mirror --paper in each theme and
// are the only literals outside src/styles/tokens.css.
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#efeae1' },
    { media: '(prefers-color-scheme: dark)', color: '#14130e' },
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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
