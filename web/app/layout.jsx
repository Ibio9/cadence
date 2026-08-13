import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Cadence',
  description: 'The day, one block at a time.',
};

// The browser chrome colour is the one place a literal is unavoidable: a meta
// tag cannot read a CSS variable. This mirrors --paper and is the only literal
// outside src/styles/tokens.css. One value, because there is one theme.
export const viewport = {
  themeColor: '#0b0d12',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    // One theme, so the substrate is a fact about the document rather than
    // something read from storage before first paint. There is no theme init
    // script here any more, and so no flash to prevent.
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
