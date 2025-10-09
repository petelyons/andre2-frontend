/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/main/page.tsx',
    './src/app/globals.css',
    './src/app/login/page.tsx',
  ],
  presets: [],
  theme: {
    extend: {},
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true,
  },
} 