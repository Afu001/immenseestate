import { useEffect, useState } from "react";

export default function CompassRose({ className = "" }: { className?: string }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let frame: number;
    let t = 0;
    const animate = () => {
      t += 0.003;
      setRotation(Math.sin(t) * 8);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);

  return (
    <div className={className}>
      <svg viewBox="0 0 220 220" className="w-full h-full drop-shadow-[0_0_20px_rgba(255,255,255,0.08)]">
        <defs>
          <radialGradient id="compassBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="needleN" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <linearGradient id="needleS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        <g transform="translate(110,110)">
          {/* Background glow */}
          <circle r="100" fill="url(#compassBg)" />

          {/* Outer ring */}
          <circle r="95" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <circle r="85" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />

          {/* Degree ticks */}
          {ticks.map((deg) => {
            const isMajor = deg % 90 === 0;
            const isMid = deg % 45 === 0;
            const len = isMajor ? 12 : isMid ? 8 : 4;
            const sw = isMajor ? 1.5 : 0.5;
            const opacity = isMajor ? 0.6 : isMid ? 0.3 : 0.15;
            return (
              <line
                key={deg}
                x1={0} y1={-95 + len} x2={0} y2={-95}
                stroke="white" strokeWidth={sw} opacity={opacity}
                transform={`rotate(${deg})`}
              />
            );
          })}

          {/* Rotating needle group */}
          <g transform={`rotate(${rotation})`}>
            {/* 8-point rose */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const isPrimary = deg % 90 === 0;
              const len = isPrimary ? 60 : 35;
              const w = isPrimary ? 8 : 5;
              return (
                <polygon
                  key={`rose-${deg}`}
                  points={`0,${-len} ${w / 2},0 0,${len / 4} ${-w / 2},0`}
                  fill={deg === 0 ? "url(#needleN)" : `rgba(255,255,255,${isPrimary ? 0.12 : 0.06})`}
                  stroke={isPrimary ? "rgba(255,255,255,0.2)" : "none"}
                  strokeWidth="0.5"
                  transform={`rotate(${deg})`}
                />
              );
            })}

            {/* South needle */}
            <polygon
              points="0,60 4,0 0,-15 -4,0"
              fill="url(#needleS)"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
            />

            {/* Center circle */}
            <circle r="6" fill="#1e293b" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <circle r="2.5" fill="rgba(255,255,255,0.5)" />
          </g>

          {/* Cardinal labels (fixed, not rotating) */}
          {[
            { l: "N", a: 0, c: "#f87171" },
            { l: "E", a: 90, c: "rgba(255,255,255,0.5)" },
            { l: "S", a: 180, c: "rgba(255,255,255,0.5)" },
            { l: "W", a: 270, c: "rgba(255,255,255,0.5)" },
          ].map(({ l, a, c }) => {
            const r = 75;
            const rad = ((a - 90) * Math.PI) / 180;
            return (
              <text
                key={l}
                x={Math.cos(rad) * r}
                y={Math.sin(rad) * r}
                fill={c}
                fontSize="13"
                fontWeight="700"
                fontFamily="Inter, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ letterSpacing: "0.05em" }}
              >
                {l}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
