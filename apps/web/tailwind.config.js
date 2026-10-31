/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ground: 'var(--ground)',
        surface: {
          DEFAULT: 'var(--surface)',
          subtle: 'var(--surface-subtle)',
          hover: 'var(--surface-hover)'
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          rule: 'var(--rule)'
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)'
        },
        // Backward-compatible slate mapping
        slate: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          border: 'var(--border)'
        },
        // Primary brand action (Ink)
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          foreground: 'var(--primary-foreground)'
        },
        brand: {
          DEFAULT: 'var(--primary)',
          indigo: '#3730A3',
          hover: 'var(--primary-hover)',
          accent: 'var(--brand-accent)',
          accentSubtle: 'var(--brand-accent-subtle)'
        },
        // Recruitment decision states
        decision: {
          shortlistBg: 'var(--state-shortlist-bg)',
          shortlistText: 'var(--state-shortlist-text)',
          shortlistBorder: 'var(--state-shortlist-border)',
          reviewBg: 'var(--state-review-bg)',
          reviewText: 'var(--state-review-text)',
          reviewBorder: 'var(--state-review-border)',
          unshortlistedBg: 'var(--state-unshortlisted-bg)',
          unshortlistedText: 'var(--state-unshortlisted-text)',
          unshortlistedBorder: 'var(--state-unshortlisted-border)'
        },
        state: {
          success: 'var(--state-shortlist-text)',
          warning: 'var(--state-review-text)',
          danger: 'var(--state-danger-text)'
        }
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)'
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        soft: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        raised: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
      }
    },
  },
  plugins: [],
}
