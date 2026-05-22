/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wc: {
          red: '#E61D25',      // Canada Red
          green: '#3CAC3B',    // Mexico Green
          blue: '#2A398D',     // USA Blue
          gold: '#F3C623',     // Trophy Gold
          dark: '#08080a',     // Foundational Dark Base
          card: '#121217',     // Premium Card Base
          border: '#1f1f27',   // Premium Card Border
        }
      }
    },
  },
  plugins: [],
}

