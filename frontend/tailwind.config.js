/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Montserrat', 'Inter', 'sans-serif'],
      },
      colors: {
        ner: {
          primary: '#0F284E',       // Deep Government Navy
          'primary-dark': '#0A1C36',
          'primary-light': '#1A3E75',
          secondary: '#2563EB',     // Professional Blue
          'secondary-dark': '#1D4ED8',
          'secondary-light': '#EFF6FF',
          slate: '#475569',
          surface: '#FFFFFF',
          background: '#F8FAFC',    // Light Neutral Off-White
          subtle: '#F1F5F9',
          text: '#0F172A',          // Dark Charcoal
          'text-secondary': '#334155',
          muted: '#64748B',
          border: '#E2E8F0',
          'border-strong': '#CBD5E1',
          open: '#16A34A',          // Status Green
          'open-bg': '#F0FDF4',
          restricted: '#D97706',    // Status Amber
          'restricted-bg': '#FFFBEB',
          blocked: '#DC2626',       // Status Red
          'blocked-bg': '#FEF2F2',
          info: '#2563EB',          // Status Blue
          'info-bg': '#EFF6FF',
          // ── NER88 LIGHT GREEN BRAND NAVIGATION TOKENS ──
          nav: {
            bg: '#DDEFE3',           // Primary Navigation Light Green
            'bg-tonal': '#D6EBDD',   // Tonal Light Green for Navbar
            border: '#C7DCCB',       // Navigation Subtle Separator
            active: '#B9DCC3',       // Active Item Background
            text: '#173D2A',         // Primary Dark Green Navigation Text
            brand: '#123C27',        // Brand Logo Dark Green
            muted: '#4F6B59',        // Muted Green Secondary Text
            'search-bg': '#F7FAF7',  // Search Input Surface
            'search-border': '#BDD5C3', // Search Input Border
            'status-live': '#258A52' // Operational LIVE Status Dot
          },
          workspace: '#F7F8F6'       // Light Neutral Command Canvas
        }
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px'
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15, 23, 42, 0.05)',
        subtle: '0 1px 3px rgba(15, 23, 42, 0.08)',
        elevated: '0 4px 12px rgba(15, 23, 42, 0.08)',
        panel: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)'
      }
    },
  },
  plugins: [],
}
