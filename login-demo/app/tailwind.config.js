/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: { 0: 'var(--a-bg-0)', 1: 'var(--a-bg-1)', 2: 'var(--a-bg-2)', 3: 'var(--a-bg-3)' },
        line: { DEFAULT: 'rgb(var(--a-line))', 2: 'rgb(var(--a-line-2))' },
        fg: { 1: 'var(--a-fg-1)', 2: 'var(--a-fg-2)', 3: 'var(--a-fg-3)' },
        brand: {
          DEFAULT: 'rgb(var(--a-brand-rgb) / <alpha-value>)',
          2: 'rgb(var(--a-brand-2-rgb) / <alpha-value>)',
        },
        ok: 'rgb(var(--a-ok-rgb) / <alpha-value>)',
        danger: 'rgb(var(--a-danger-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      maxWidth: { shell: '1560px' },
      boxShadow: { float: '0 8px 30px rgba(0,0,0,.45)' },
    },
  },
  plugins: [],
}
