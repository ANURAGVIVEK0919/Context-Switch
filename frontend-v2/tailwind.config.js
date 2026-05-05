/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-dim': 'var(--color-surface-dim)',
        outline: 'var(--color-outline)',
        'outline-strong': 'var(--color-outline-strong)',
        'on-background': 'var(--color-on-background)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        primary: 'var(--color-primary)',
        'primary-container': 'var(--color-primary-container)',
        secondary: 'var(--color-secondary)',
        tertiary: 'var(--color-tertiary)',
        error: 'var(--color-error)',
      },
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        DEFAULT: '2px',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      spacing: {
        'sidebar-width': '220px',
        'component-padding-y': '6px',
        'component-padding-x': '12px',
        'container-padding': '24px',
        gutter: '12px',
        'item-gap': '8px',
      },
      fontFamily: {
        'headline-sm': ['Space Grotesk', 'sans-serif'],
        'display-mono': ['Space Grotesk', 'monospace'],
        'code-snippet': ['SF Mono', 'Fira Code', 'monospace'],
        'label-mono-xs': ['Space Grotesk', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'headline-sm': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '600' }],
        'display-mono': ['18px', { lineHeight: '24px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'code-snippet': ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'label-mono-xs': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '500' }],
        'body-md': ['13px', { lineHeight: '20px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
}
