// HomePilot mark: a monoline house whose window is a four-point spark (the "pilot").
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="hp-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffb36b" />
          <stop offset="0.5" stopColor="#ff7a8a" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#hp-g)" />
      <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" fill="none" stroke="rgba(255,255,255,0.35)" />
      <path d="M10 19.5 20 11l10 8.5V29a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 10 29z" fill="none" stroke="#1a1330" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M20 18.2c.5 2.4 1.4 3.3 3.8 3.8-2.4.5-3.3 1.4-3.8 3.8-.5-2.4-1.4-3.3-3.8-3.8 2.4-.5 3.3-1.4 3.8-3.8z" fill="#1a1330" />
    </svg>
  );
}
