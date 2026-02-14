"use client";

export default function CityScene({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`.trim()}>
      <svg
        viewBox="0 0 1200 700"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#020617" />
            <stop offset="0.45" stopColor="#0b1220" />
            <stop offset="1" stopColor="#020617" />
          </linearGradient>
          <radialGradient id="glow" cx="60%" cy="35%" r="70%">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0.14" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow2" cx="35%" cy="65%" r="70%">
            <stop offset="0" stopColor="#34d399" stopOpacity="0.10" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1200" height="700" fill="url(#bg)" />
        <rect width="1200" height="700" fill="url(#glow)" />
        <rect width="1200" height="700" fill="url(#glow2)" />

        <g opacity="0.16" stroke="#e2e8f0" strokeWidth="1">
          {Array.from({ length: 20 }).map((_, i) => (
            <path key={i} d={`M${i * 70} 0 V700`} />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M0 ${i * 55} H1200`} />
          ))}
        </g>

        <g opacity="0.55">
          <path d="M-40 520 C 200 410, 360 430, 520 520 S 860 680, 1180 560 S 1300 350, 1240 240" fill="none" stroke="#0f172a" strokeWidth="140" strokeLinecap="round" />
          <path d="M-40 520 C 200 410, 360 430, 520 520 S 860 680, 1180 560 S 1300 350, 1240 240" fill="none" stroke="#94a3b8" strokeOpacity="0.25" strokeWidth="6" strokeLinecap="round" strokeDasharray="18 22" />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-transparent to-emerald-500/10" />
    </div>
  );
}
