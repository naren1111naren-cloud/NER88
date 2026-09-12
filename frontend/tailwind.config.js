/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#6D28D9',
          violet: '#8B5CF6',
          teal: '#14B8A6',
          dark: '#171329',
          bg: '#F7F7FB',
          card: '#FFFFFF',
          text: '#1F2937',
          muted: '#6B7280',
          border: '#E5E7EB',
        },
        risk: {
          low: '#10B981',      // Emerald Green
          medium: '#F59E0B',   // Amber Yellow
          high: '#F97316',     // Orange
          critical: '#EF4444', // Crimson Red
          blocked: '#991B1B'   // Dark Red
        }
      }
    },
  },
  plugins: [],
}


