import { motion, useReducedMotion } from 'motion/react';
import type { Need } from '../content/site';

/** Decorative, illustrative diagrams for the capability stage. Not data. */
export function CapabilityDiagram({ mode }: { mode: Need }) {
  const reduce = useReducedMotion();
  const draw = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
        };
  const pop = (delay = 0, y = 14) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  const showMarketing = mode === 'marketing' || mode === 'both';
  const showSoftware = mode === 'software' || mode === 'both';
  const both = mode === 'both';

  // Horizontal offsets so the two systems share the stage when combined
  const mx = both ? 0 : 60;
  const sx = both ? 250 : 110;

  return (
    <svg viewBox="0 0 600 440" width="600" height="440" role="presentation" focusable="false" aria-hidden>
      <defs>
        <linearGradient id="cd-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#39b2ac" stopOpacity="0.34" />
          <stop offset="1" stopColor="#1fa8d4" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="cd-glass-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fa8d4" stopOpacity="0.3" />
          <stop offset="1" stopColor="#39b2ac" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id="cd-sun" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffe48a" />
          <stop offset="1" stopColor="#f2b705" />
        </radialGradient>
        <filter id="cd-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>

      {/* Ambient light */}
      <circle cx={both ? 300 : 320} cy="250" r="120" fill="#39b2ac" opacity="0.16" filter="url(#cd-glow)" />
      <circle cx={both ? 190 : 260} cy="300" r="70" fill="#ffd044" opacity={showMarketing ? 0.2 : 0.08} filter="url(#cd-glow)" />

      {/* Connecting loop (Both only) */}
      {both && (
        <motion.path
          d="M120 360 C 120 420, 470 420, 480 330 C 490 250, 470 120, 420 90"
          fill="none"
          stroke="#39b2ac"
          strokeWidth="1.5"
          strokeDasharray="4 7"
          {...draw(0.4)}
        />
      )}

      {showMarketing && (
        <g transform={`translate(${mx} 0)`}>
          {/* Strategy → Campaigns → Conversion */}
          <motion.path
            d={both ? 'M60 110 L150 110 L150 230 L230 230' : 'M40 120 L200 120 L200 240 L340 240'}
            fill="none"
            stroke="#39b2ac"
            strokeWidth="1.5"
            {...draw(0.1)}
          />
          {/* Strategy: target */}
          <motion.g {...pop(0.05)}>
            <circle cx={both ? 60 : 40} cy={both ? 110 : 120} r="30" fill="none" stroke="#f4f3ee" strokeOpacity="0.5" />
            <circle cx={both ? 60 : 40} cy={both ? 110 : 120} r="17" fill="none" stroke="#f4f3ee" strokeOpacity="0.7" />
            <circle cx={both ? 60 : 40} cy={both ? 110 : 120} r="6" fill="#ffd044" />
          </motion.g>
          {/* Campaigns: stacked creative panels */}
          <motion.g {...pop(0.2)} transform={both ? 'translate(90 150) scale(0.82)' : 'translate(130 160)'}>
            <rect x="0" y="16" width="120" height="150" rx="10" fill="url(#cd-glass-2)" stroke="#fff" strokeOpacity="0.18" />
            <rect x="22" y="0" width="120" height="150" rx="10" fill="url(#cd-glass)" stroke="#fff" strokeOpacity="0.28" />
            <rect x="36" y="18" width="92" height="56" rx="6" fill="#39b2ac" opacity="0.35" />
            <circle cx="100" cy="46" r="22" fill="url(#cd-sun)" opacity="0.95" />
            <rect x="36" y="88" width="70" height="7" rx="3.5" fill="#f4f3ee" opacity="0.7" />
            <rect x="36" y="102" width="52" height="7" rx="3.5" fill="#f4f3ee" opacity="0.35" />
            <rect x="36" y="124" width="44" height="14" rx="7" fill="#ffd044" />
          </motion.g>
          {/* Conversion: narrowing funnel into focal point */}
          <motion.g {...pop(0.35)} transform={both ? 'translate(200 200) scale(0.7)' : 'translate(330 190)'}>
            <path d="M0 0 H110 L72 50 V92 H38 V50 Z" fill="url(#cd-glass)" stroke="#fff" strokeOpacity="0.3" />
            <path d="M14 14 H96" stroke="#f4f3ee" strokeOpacity="0.35" />
            <path d="M30 34 H80" stroke="#f4f3ee" strokeOpacity="0.35" />
            <circle cx="55" cy="118" r="12" fill="#ffd044" />
          </motion.g>
        </g>
      )}

      {showSoftware && (
        <g transform={`translate(${sx} 0)`}>
          {/* Interface layers */}
          <motion.g {...pop(both ? 0.25 : 0.05, 20)} transform={both ? 'translate(20 40) scale(0.78)' : 'translate(40 40)'}>
            <g transform="skewY(-8)">
              <rect x="80" y="110" width="210" height="150" rx="12" fill="url(#cd-glass-2)" stroke="#fff" strokeOpacity="0.14" />
              <rect x="50" y="80" width="210" height="150" rx="12" fill="url(#cd-glass)" stroke="#fff" strokeOpacity="0.2" />
              <rect x="20" y="50" width="210" height="150" rx="12" fill="#0f1c1f" fillOpacity="0.7" stroke="#39b2ac" strokeOpacity="0.8" />
              {/* window chrome */}
              <circle cx="38" cy="66" r="4" fill="#ffd044" />
              <circle cx="52" cy="66" r="4" fill="#39b2ac" />
              <circle cx="66" cy="66" r="4" fill="#1fa8d4" />
              <rect x="34" y="84" width="46" height="100" rx="5" fill="#fff" opacity="0.07" />
              <rect x="92" y="84" width="124" height="44" rx="6" fill="#39b2ac" opacity="0.25" />
              <rect x="92" y="138" width="58" height="46" rx="6" fill="#fff" opacity="0.08" />
              <rect x="158" y="138" width="58" height="46" rx="6" fill="#1fa8d4" opacity="0.22" />
              <text x="120" y="114" fill="#f4f3ee" fontFamily="ui-monospace, monospace" fontSize="20" opacity="0.9">
                {'</>'}
              </text>
            </g>
          </motion.g>
          {/* Connected modules */}
          {!both && (
            <g>
              <motion.path d="M320 110 H390 V180" fill="none" stroke="#39b2ac" strokeWidth="1.5" {...draw(0.3)} />
              <motion.path d="M320 300 H390 V240" fill="none" stroke="#39b2ac" strokeWidth="1.5" {...draw(0.4)} />
              <motion.path d="M390 210 H440" fill="none" stroke="#ffd044" strokeWidth="1.5" {...draw(0.5)} />
              {[
                [300, 92],
                [300, 282],
                [372, 192],
                [440, 192],
              ].map(([x, y], i) => (
                <motion.rect
                  key={i}
                  x={x}
                  y={y}
                  width="36"
                  height="36"
                  rx="8"
                  fill={i === 3 ? '#ffd044' : '#0f1c1f'}
                  stroke={i === 3 ? 'none' : '#39b2ac'}
                  {...pop(0.35 + i * 0.08, 8)}
                />
              ))}
            </g>
          )}
          {both && (
            <g>
              <motion.path d="M240 300 H300 V360" fill="none" stroke="#39b2ac" strokeWidth="1.5" {...draw(0.5)} />
              <motion.rect x="282" y="352" width="36" height="36" rx="8" fill="#ffd044" {...pop(0.6, 8)} />
              <motion.rect x="222" y="282" width="36" height="36" rx="8" fill="#0f1c1f" stroke="#39b2ac" {...pop(0.55, 8)} />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
