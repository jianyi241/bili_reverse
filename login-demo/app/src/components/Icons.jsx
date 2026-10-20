/**
 * 自绘 SVG 图标集（禁止引图标库，保证描边一致）
 * 统一：viewBox 24×24 / fill none / stroke currentColor / strokeWidth 1.8 / 圆角端点
 */
const base = (size, props) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
})

export const Icon = {
  Home: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  ),
  Compass: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  ),
  Grid: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Trending: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M4 16.5 9 11l3.5 3.5L20 7" />
      <path d="M15 7h5v5" />
    </svg>
  ),
  Search: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  ),
  Upload: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 16v3.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </svg>
  ),
  Bell: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15z" />
      <path d="M10 21h4" />
    </svg>
  ),
  User: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  ),
  Play: ({ size = 18, ...p }) => (
    <svg {...base(size, p)} fill="currentColor" stroke="none">
      <path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.2-6.8c.6-.4.6-1.4 0-1.8L9.6 4.3C8.9 3.9 8 4.4 8 5.2z" />
    </svg>
  ),
  Pause: ({ size = 18, ...p }) => (
    <svg {...base(size, p)} fill="currentColor" stroke="none">
      <rect x="7" y="4.5" width="3.6" height="15" rx="1.2" />
      <rect x="13.4" y="4.5" width="3.6" height="15" rx="1.2" />
    </svg>
  ),
  Volume: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M5 10v4h3l4 3.5v-11L8 10z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" />
    </svg>
  ),
  VolumeOff: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M5 10v4h3l4 3.5v-11L8 10z" />
      <path d="m16 10 4 4M20 10l-4 4" />
    </svg>
  ),
  Expand: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
    </svg>
  ),
  Shrink: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5" />
    </svg>
  ),
  Pip: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="12" y="12" width="7" height="5.5" rx="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  Download: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 20h14" />
    </svg>
  ),
  Heart: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3C19.5 15.4 12 20 12 20z" />
    </svg>
  ),
  Star: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" />
    </svg>
  ),
  Share: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="m8.8 10.8 6.4-3.5M8.8 13.2l6.4 3.5" />
    </svg>
  ),
  Coin: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 10h4a1.8 1.8 0 0 1 0 3.6h-4" />
    </svg>
  ),
  Message: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M20.5 12a8 8 0 0 1-8 8H8l-4 2.5V13A8 8 0 0 1 12 4h.5a8 8 0 0 1 8 8z" />
    </svg>
  ),
  ChevronLeft: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </svg>
  ),
  ChevronRight: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  ),
  Music: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  ),
  Film: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M7.5 4.5v15M16.5 4.5v15M3 9.5h4.5M16.5 9.5H21M3 14.5h4.5M16.5 14.5H21" />
    </svg>
  ),
  Sparkles: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="m12 3.5 1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  ),
  Check: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  ),
  Settings: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.5-1H1.4a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8.4 3H8.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 9h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 2z" />
    </svg>
  ),
  Clock: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  Eye: ({ size = 18, ...p }) => (
    <svg {...base(size, p)}>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
}

/** 品牌 Logo：耳机 + 小电视 */
export function Logo({ size = 32 }) {
  return (
    <span
      className="grid place-items-center rounded-lg bg-gradient-to-br from-brand to-indigo-600 text-white shadow-[0_4px_18px_rgba(124,92,255,.45)]"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 40 40"
        width={size * 0.72}
        height={size * 0.72}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 21v-4.5a11.5 11.5 0 0 1 23 0V21" />
        <rect x="4.5" y="19" width="5.5" height="9.5" rx="2.75" fill="currentColor" stroke="none" />
        <rect x="30" y="19" width="5.5" height="9.5" rx="2.75" fill="currentColor" stroke="none" />
        <rect x="11" y="20" width="18" height="13" rx="3.6" />
        <path d="M15.5 20 13 15.6M24.5 20 27 15.6" />
        <circle cx="16.6" cy="26.4" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="23.4" cy="26.4" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  )
}

export default Icon
