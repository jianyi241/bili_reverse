/**
 * coze-style Tailwind preset
 * 用法：tailwind.config.js
 *   module.exports = {
 *     presets: [require('../.agents/skills/coze-style/tailwind.preset.cjs')],
 *     content: ['./index.html', './src/**\/*.{vue,js,ts}'],
 *   }
 */
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          0: rgb('coze-brand-0'),
          1: rgb('coze-brand-1'),
          2: rgb('coze-brand-2'),
          3: rgb('coze-brand-3'),
          5: rgb('coze-brand-5'),
          6: rgb('coze-brand-6'),
          7: rgb('coze-brand-7'),
          DEFAULT: rgb('coze-brand-5'),
        },
        bg: {
          0: rgb('coze-bg-0'),
          1: rgb('coze-bg-1'),
          2: rgb('coze-bg-2'),
          3: rgb('coze-bg-3'),
          hover: rgb('coze-bg-hover'),
          DEFAULT: rgb('coze-bg-1'),
        },
        fg: {
          1: rgb('coze-fg-1'),
          2: rgb('coze-fg-2'),
          3: rgb('coze-fg-3'),
          4: rgb('coze-fg-4'),
          revert: rgb('coze-fg-revert'),
          DEFAULT: rgb('coze-fg-4'),
        },
        stroke: {
          DEFAULT: rgb('coze-stroke-opaque'),
          opaque: rgb('coze-stroke-opaque'),
        },
        danger: rgb('coze-red-5'),
        success: rgb('coze-green-5'),
        warn: rgb('coze-yellow-5'),
        info: rgb('coze-cyan-5'),
      },
      borderRadius: {
        tiny: 'var(--coze-r-tiny)',
        mini: 'var(--coze-r-mini)',
        small: 'var(--coze-r-small)',
        normal: 'var(--coze-r-normal)',
        DEFAULT: 'var(--coze-r-normal)',
        m: 'var(--coze-r-m)',
        md: 'var(--coze-r-md)',
        xl: 'var(--coze-r-xl)',
        xxl: 'var(--coze-r-xxl)',
        ultra: 'var(--coze-r-ultra)',
      },
      boxShadow: {
        sm: 'var(--coze-shadow-sm)',
        DEFAULT: 'var(--coze-shadow-normal)',
        normal: 'var(--coze-shadow-normal)',
        lg: 'var(--coze-shadow-lg)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        mini: ['10px', { lineHeight: '14px' }],
        base: ['12px', { lineHeight: '18px' }],
        lg: ['14px', { lineHeight: '21px' }],
        xl: ['15px', { lineHeight: '22px' }],
        xxl: ['16px', { lineHeight: '24px' }],
        '18px': ['18px', { lineHeight: '25px' }],
        '20px': ['20px', { lineHeight: '28px' }],
        '24px': ['24px', { lineHeight: '31px' }],
      },
      maxWidth: { content: '1080px' },
      height: { topbar: '56px' },
    },
  },
  plugins: [],
};
