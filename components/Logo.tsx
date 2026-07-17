// Stiliseret udgave af det uploadede Ranum-logo:
// et træ af krøller og ringe i en cirkel, orange/gylden gradient.
export default function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-label="Ranum Summer School logo"
      role="img"
    >
      <defs>
        <linearGradient id="rsslogo-g" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F5B301" />
          <stop offset="1" stopColor="#E8820C" />
        </linearGradient>
      </defs>
      <g stroke="url(#rsslogo-g)" strokeLinecap="round" fill="none">
        {/* Cirklen med åbning i bunden til stammen */}
        <path
          d="M 82 190.5 A 92 92 0 1 1 118 190.5"
          strokeWidth="7"
        />
        {/* Stammen der deler sig */}
        <path d="M 88 190 L 88 145 Q 88 118 96 100" strokeWidth="7" />
        <path d="M 112 190 L 112 145 Q 112 118 104 100" strokeWidth="7" />
        {/* Kronen: krøller og ringe */}
        <g strokeWidth="6">
          <path d="M 100 92 a 11 11 0 1 1 11 11" />
          <path d="M 72 60 a 10 10 0 1 1 10 10 q -12 2 -18 12" />
          <path d="M 128 58 a 10 10 0 1 0 -10 10 q 10 4 14 14" />
          <path d="M 96 44 a 9 9 0 1 1 9 9" />
          <circle cx="140" cy="82" r="9" />
          <circle cx="60" cy="88" r="9" />
          <path d="M 148 104 a 9 9 0 1 1 -9 9 q -8 6 -8 14" />
          <path d="M 52 106 a 9 9 0 1 0 9 9 q 8 6 8 14" />
          <path d="M 78 122 a 9 9 0 1 1 9 9" />
          <path d="M 122 128 a 8 8 0 1 0 -8 8" />
          <circle cx="100" cy="66" r="7" />
          <path d="M 66 44 a 8 8 0 1 0 8 8" />
          <path d="M 134 40 a 8 8 0 1 1 -8 8" />
          <path d="M 88 78 a 7 7 0 1 0 7 7" />
          <path d="M 118 84 a 7 7 0 1 1 7 7" />
          <circle cx="80" cy="100" r="6" />
          <path d="M 108 112 a 7 7 0 1 1 7 7" />
          <path d="M 92 136 a 7 7 0 1 0 -7 7" />
          <path d="M 130 148 a 7 7 0 1 1 -7 7 q -6 4 -6 10" />
          <path d="M 70 148 a 7 7 0 1 0 7 7 q 6 4 6 10" />
        </g>
      </g>
    </svg>
  );
}
