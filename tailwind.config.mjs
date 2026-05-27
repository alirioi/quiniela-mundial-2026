/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--color-white) / <alpha-value>)',
        'true-white': '#ffffff',
        wc: {
          red: 'rgb(var(--color-wc-red) / <alpha-value>)',      // Canada Red (Dynamic contrast)
          green: 'rgb(var(--color-wc-green) / <alpha-value>)',    // Mexico Green
          blue: 'rgb(var(--color-wc-blue) / <alpha-value>)',     // USA Blue
          gold: 'rgb(var(--color-wc-gold) / <alpha-value>)',     // Trophy Gold
          dark: 'rgb(var(--color-wc-dark) / <alpha-value>)',     // Foundational Dark Base
          card: 'rgb(var(--color-wc-card) / <alpha-value>)',     // Premium Card Base
          border: 'rgb(var(--color-wc-border) / <alpha-value>)',   // Premium Card Border
        },
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          350: 'rgb(var(--color-slate-350) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          450: 'rgb(var(--color-slate-450) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          950: 'rgb(var(--color-slate-950) / <alpha-value>)',
        }
      }
    },
  },
  plugins: [],
}

