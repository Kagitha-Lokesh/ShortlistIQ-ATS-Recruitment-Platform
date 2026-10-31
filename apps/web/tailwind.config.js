/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core shadcn semantic tokens
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)'
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)'
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          foreground: 'var(--primary-foreground)'
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          hover: 'var(--secondary-hover)',
          foreground: 'var(--secondary-foreground)'
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)'
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)'
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          rule: 'var(--rule)'
        },
        input: 'var(--input)',
        ring: 'var(--ring)',

        // Achromatic ledger shorthands
        ground: 'var(--background)',
        surface: {
          DEFAULT: 'var(--surface)',
          subtle: 'var(--surface-subtle)',
          hover: 'var(--surface-hover)'
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)'
        },
        slate: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          border: 'var(--border)'
        },
        brand: {
          DEFAULT: 'var(--primary)',
          indigo: '#3730A3',
          hover: 'var(--primary-hover)',
          accent: 'var(--brand-accent)',
          accentSubtle: 'var(--brand-accent-subtle)'
        },

        // High-stakes recruitment decision states
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
          danger: 'var(--state-failed-text)'
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)'
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
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        soft: 'var(--shadow-soft)',
        raised: 'var(--shadow-raised)'
      }
    },
  },
  plugins: [],
}
