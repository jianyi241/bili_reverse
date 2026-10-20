/** 戴耳机的可爱小电视 */
export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="听影 Logo">
      <path d="M19 11.5 15.5 6.5M29 11.5l3.5-5" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="15" cy="6" r="2" fill="var(--accent)" />
      <circle cx="33" cy="6" r="2" fill="var(--sage)" />
      <path d="M8 26V22a16 16 0 0 1 32 0v4" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="10" y="13" width="28" height="24" rx="8" fill="var(--accent-soft)" stroke="var(--ink)" strokeWidth="2" />
      <rect x="14" y="17" width="20" height="15" rx="5" fill="var(--surface)" />
      <circle cx="20" cy="23.5" r="1.6" fill="var(--ink)" />
      <circle cx="28" cy="23.5" r="1.6" fill="var(--ink)" />
      <path d="M22 27a2.4 2.4 0 0 0 4 0" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="17.5" cy="27" rx="1.6" ry="1" fill="var(--accent)" opacity=".55" />
      <ellipse cx="30.5" cy="27" rx="1.6" ry="1" fill="var(--accent)" opacity=".55" />
      <rect x="4.5" y="22" width="7" height="11" rx="3.5" fill="var(--sage)" stroke="var(--ink)" strokeWidth="2" />
      <rect x="36.5" y="22" width="7" height="11" rx="3.5" fill="var(--sage)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M17 37v3M31 37v3" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
