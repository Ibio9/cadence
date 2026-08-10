/**
 * Cadence Tailwind configuration.
 *
 * Note on the current state of the repo: Tailwind is not an installed
 * dependency and the project brief forbids adding new ones. The design system
 * therefore ships as a token driven CSS layer in src/styles/ that publishes
 * exactly the semantic class names described below (bg-surface, text-ink-muted,
 * border-hairline, bg-accent-tint, shadow-card, rounded-card, font-display,
 * font-mono, and the responsive sm: md: lg: xl: prefixes).
 *
 * This file is the mapping from those semantic names to the CSS variables in
 * src/styles/tokens.css. Installing tailwindcss and pointing PostCSS at this
 * config is a drop in: the class names in the components already match, so no
 * component needs to change. Every value resolves through a variable, so both
 * themes keep working without a dark: variant anywhere.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  theme: {
    // Replace, not extend: the palette is closed. There is no way to reach a
    // raw Tailwind colour such as blue-500 or red-600 from a component.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      bg: 'var(--bg)',
      surface: {
        DEFAULT: 'var(--surface)',
        raised: 'var(--surface-raised)',
        sunken: 'var(--surface-sunken)',
      },
      ink: {
        DEFAULT: 'var(--ink)',
        muted: 'var(--ink-muted)',
        subtle: 'var(--ink-subtle)',
        inverse: 'var(--ink-inverse)',
      },
      accent: {
        DEFAULT: 'var(--accent)',
        deep: 'var(--accent-deep)',
        soft: 'var(--accent-soft)',
        tint: 'var(--accent-tint)',
      },
      'on-accent': 'var(--on-accent)',
      success: { DEFAULT: 'var(--success)', tint: 'var(--success-tint)' },
      warning: { DEFAULT: 'var(--warning)', tint: 'var(--warning-tint)' },
      danger: { DEFAULT: 'var(--danger)', tint: 'var(--danger-tint)' },
      hover: 'var(--hover-tint)',
      active: 'var(--active-tint)',
      scrim: 'var(--overlay-scrim)',
      skeleton: 'var(--skeleton-base)',
    },

    borderColor: {
      DEFAULT: 'var(--border)',
      hairline: 'var(--border)',
      strong: 'var(--border-strong)',
      accent: 'var(--accent)',
      success: 'var(--success)',
      warning: 'var(--warning)',
      danger: 'var(--danger)',
      transparent: 'transparent',
      current: 'currentColor',
    },

    fontFamily: {
      display: 'var(--font-display)',
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },

    fontSize: {
      eyebrow: ['var(--text-eyebrow)', { lineHeight: '1.2', letterSpacing: 'var(--tracking-eyebrow)', fontWeight: '600' }],
      caption: ['var(--text-caption)', { lineHeight: 'var(--leading-normal)' }],
      sm: ['var(--text-sm)', { lineHeight: 'var(--leading-normal)' }],
      base: ['var(--text-base)', { lineHeight: 'var(--leading-body)' }],
      lg: ['var(--text-lg)', { lineHeight: 'var(--leading-body)' }],
      xl: ['var(--text-xl)', { lineHeight: 'var(--leading-snug)' }],
      '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-snug)' }],
      '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
      '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-tight)' }],
      display: ['var(--text-display)', { lineHeight: 'var(--leading-tight)' }],
    },

    lineHeight: {
      tight: 'var(--leading-tight)',
      snug: 'var(--leading-snug)',
      normal: 'var(--leading-normal)',
      body: 'var(--leading-body)',
      relaxed: 'var(--leading-relaxed)',
    },

    letterSpacing: {
      eyebrow: 'var(--tracking-eyebrow)',
      tight: 'var(--tracking-tight)',
      snug: 'var(--tracking-snug)',
      normal: 'var(--tracking-normal)',
    },

    spacing: {
      0: 'var(--space-0)',
      1: 'var(--space-1)',
      2: 'var(--space-2)',
      3: 'var(--space-3)',
      4: 'var(--space-4)',
      5: 'var(--space-5)',
      6: 'var(--space-6)',
      7: 'var(--space-7)',
      8: 'var(--space-8)',
      10: 'var(--space-10)',
      12: 'var(--space-12)',
      14: 'var(--space-14)',
      16: 'var(--space-16)',
      20: 'var(--space-20)',
      24: 'var(--space-24)',
      gutter: 'var(--shell-gutter)',
      'gutter-lg': 'var(--shell-gutter-lg)',
      'card-pad': 'var(--shell-card-pad)',
      'card-gap': 'var(--shell-card-gap)',
      control: 'var(--control-h)',
      touch: 'var(--touch-target)',
    },

    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      control: 'var(--radius-control)',
      card: 'var(--radius-card)',
      pill: 'var(--radius-pill)',
      full: '9999px',
    },

    boxShadow: {
      none: 'none',
      card: 'var(--shadow-sm)',
      'card-md': 'var(--shadow-md)',
      'card-lg': 'var(--shadow-lg)',
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
    },

    transitionTimingFunction: { DEFAULT: 'var(--ease)', ease: 'var(--ease)' },
    transitionDuration: {
      DEFAULT: 'var(--dur-base)',
      fast: 'var(--dur-fast)',
      base: 'var(--dur-base)',
      slow: 'var(--dur-slow)',
    },

    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },

    extend: {
      maxWidth: { shell: 'var(--shell-max-w)' },
      width: { sidebar: 'var(--shell-sidebar-w)' },
      zIndex: {
        sticky: 'var(--z-sticky)',
        drawer: 'var(--z-drawer)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        tooltip: 'var(--z-tooltip)',
      },
      ringColor: { DEFAULT: 'var(--accent)', accent: 'var(--accent)' },
      ringWidth: { DEFAULT: 'var(--focus-ring-w)' },
      ringOffsetWidth: { DEFAULT: 'var(--focus-ring-offset)' },
    },
  },
  plugins: [],
};
