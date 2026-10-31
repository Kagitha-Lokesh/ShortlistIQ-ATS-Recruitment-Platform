/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        card: '#FFFFFF',
        slate: {
          primary: '#0F172A',
          secondary: '#475569',
          border: '#E2E8F0'
        },
        brand: {
          indigo: '#3730A3',
          DEFAULT: '#3730A3',
          hover: '#312E81'
        },
        state: {
          success: '#15803D',
          warning: '#B45309',
          danger: '#B91C1C'
        }
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '8px',
        lg: '8px'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)'
      }
    },
  },
  plugins: [],
}

