/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: ['class', '[data-mode="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--b50) / <alpha-value>)',
          100: 'rgb(var(--b100) / <alpha-value>)',
          200: 'rgb(var(--b200) / <alpha-value>)',
          300: 'rgb(var(--b300) / <alpha-value>)',
          400: 'rgb(var(--b400) / <alpha-value>)',
          500: 'rgb(var(--b500) / <alpha-value>)',
          600: 'rgb(var(--b600) / <alpha-value>)',
          700: 'rgb(var(--b700) / <alpha-value>)',
          800: 'rgb(var(--b800) / <alpha-value>)',
          900: 'rgb(var(--b900) / <alpha-value>)'
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)'
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      borderRadius: { xl2: '1.25rem' }
    }
  },
  plugins: []
}
