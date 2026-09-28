import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, useInView } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import styles from './BrandSculpture.module.css';

/**
 * Decorative sculpture inspired by the logo's arrow-through-loop geometry.
 * Deliberately separate from the official logo artwork.
 */

// Stadium (elongated loop) path helper
const stadium = (x: number, y: number, w: number, h: number) => {
  const r = w / 2;
  return `M${x} ${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x} ${y + h - r} Z`;
};

const LOOP_OUTER = stadium(300, 40, 200, 500);
const LOOP_INNER = stadium(358, 98, 84, 384);
const RING = `${LOOP_OUTER} ${LOOP_INNER}`;

export function BrandSculpture() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { margin: '0px 0px -10% 0px' });
  const [paused, setPaused] = useState(false);
  const [finePointer, setFinePointer] = useState(false);

  // Pointer response: normalised -1..1, smoothed with springs
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 0.6 });
  const rotateY = useTransform(sx, [-1, 1], [-7, 7]);
  const rotateX = useTransform(sy, [-1, 1], [5, -5]);
  const loopX = useTransform(sx, [-1, 1], [-10, 10]);
  const loopY = useTransform(sy, [-1, 1], [-6, 6]);
  const arrowX = useTransform(sx, [-1, 1], [-4, 4]);
  const arrowY = useTransform(sy, [-1, 1], [-3, 3]);
  const tipX = useTransform(sx, [-1, 1], [-14, 14]);
  const shadowX = useTransform(sx, [-1, 1], [12, -12]);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine) and (hover: hover)');
    const update = () => setFinePointer(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const interactive = finePointer && !reduce;

  useEffect(() => {
    if (!interactive) {
      px.set(0);
      py.set(0);
      return;
    }
    const scope = wrapRef.current?.closest('section') ?? window;
    const onMove = (e: Event) => {
      const { clientX, clientY } = e as PointerEvent;
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const nx = (clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      const ny = (clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
      px.set(Math.max(-1, Math.min(1, nx)));
      py.set(Math.max(-1, Math.min(1, ny)));
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };
    scope.addEventListener('pointermove', onMove);
    scope.addEventListener('pointerleave', onLeave);
    return () => {
      scope.removeEventListener('pointermove', onMove);
      scope.removeEventListener('pointerleave', onLeave);
    };
  }, [interactive, px, py]);

  const floating = !reduce && !paused && inView;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.glow} aria-hidden />
      <motion.div
        className={styles.stage}
        style={interactive ? { rotateX, rotateY } : undefined}
        aria-hidden
      >
        <motion.div
          className={styles.float}
          animate={floating ? { y: [0, -12, 0] } : { y: 0 }}
          transition={floating ? { duration: 7, ease: 'easeInOut', repeat: Infinity } : { duration: 0.6 }}
        >
          <svg viewBox="0 0 560 600" className={styles.svg} role="presentation" focusable="false">
            <defs>
              <linearGradient id="bs-loop" x1="0" y1="0" x2="1" y2="0.15">
                <stop offset="0" stopColor="#6fd3f5" />
                <stop offset="0.28" stopColor="#27b0e0" />
                <stop offset="0.7" stopColor="#1596d1" />
                <stop offset="1" stopColor="#0c6fb0" />
              </linearGradient>
              <linearGradient id="bs-loop-side" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#0d6aa6" />
                <stop offset="1" stopColor="#084c7c" />
              </linearGradient>
              <linearGradient id="bs-loop-sheen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
                <stop offset="0.45" stopColor="#fff" stopOpacity="0.1" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="bs-top" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffe68f" />
                <stop offset="0.55" stopColor="#ffd044" />
                <stop offset="1" stopColor="#f4b400" />
              </linearGradient>
              <linearGradient id="bs-bottom" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#f3b000" />
                <stop offset="0.6" stopColor="#ffc933" />
                <stop offset="1" stopColor="#ffdd6b" />
              </linearGradient>
              <linearGradient id="bs-panel" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4fcdc1" />
                <stop offset="0.5" stopColor="#39b2ac" />
                <stop offset="1" stopColor="#1f8b86" />
              </linearGradient>
              <linearGradient id="bs-face" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fffdf6" />
                <stop offset="1" stopColor="#efe7cf" />
              </linearGradient>
              <linearGradient id="bs-tip" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4fcdc1" />
                <stop offset="1" stopColor="#1f8b86" />
              </linearGradient>
              <filter id="bs-soft" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="14" />
              </filter>
              <filter id="bs-drop" x="-20%" y="-20%" width="150%" height="150%">
                <feDropShadow dx="10" dy="16" stdDeviation="12" floodColor="#0d2a33" floodOpacity="0.22" />
              </filter>
              <filter id="bs-inner" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
              <clipPath id="bs-ring-clip">
                <path d={RING} fillRule="evenodd" />
              </clipPath>
            </defs>

            {/* Floor shadow */}
            <motion.g style={{ x: shadowX }}>
              <ellipse cx="300" cy="566" rx="220" ry="18" fill="#0d2a33" opacity="0.2" filter="url(#bs-soft)" />
              <ellipse cx="400" cy="560" rx="96" ry="9" fill="#0d2a33" opacity="0.22" filter="url(#bs-soft)" />
            </motion.g>

            {/* Arrow ribbon (behind the loop) */}
            <motion.g style={{ x: arrowX, y: arrowY }}>
            <motion.g
              initial={reduce ? false : { opacity: 0, x: -36 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <g filter="url(#bs-drop)">
                {/* inner face */}
                <path d="M114 191 L265 290 L114 389 Z" fill="url(#bs-face)" />
                {/* teal panel */}
                <path d="M70 100 L114 191 L114 389 L70 480 Z" fill="url(#bs-panel)" />
                <path d="M70 100 L80 121 L80 459 L70 480 Z" fill="#fff" opacity="0.28" />
                {/* bands */}
                <path d="M70 100 L360 290 L265 290 L114 191 Z" fill="url(#bs-top)" />
                <path d="M70 480 L360 290 L265 290 L114 389 Z" fill="url(#bs-bottom)" />
                {/* fold shading */}
                <path d="M70 100 L114 191 L132 203 Z" fill="#c78f00" opacity="0.28" />
                <path d="M70 480 L114 389 L132 377 Z" fill="#8e6600" opacity="0.25" />
                {/* specular edge */}
                <path d="M70 100 L360 290" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" />
                <path d="M265 290 L114 389" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
              </g>
            </motion.g>
            </motion.g>

            {/* Loop (front) */}
            <motion.g style={{ x: loopX, y: loopY }}>
            <motion.g
              initial={reduce ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* extrusion / depth */}
              <path d={RING} transform="translate(18 12)" fill="url(#bs-loop-side)" fillRule="evenodd" />
              <path d={RING} fill="url(#bs-loop)" fillRule="evenodd" />
              {/* tube shading inside the ring */}
              <g clipPath="url(#bs-ring-clip)">
                <path d={LOOP_INNER} fill="none" stroke="#063d63" strokeOpacity="0.45" strokeWidth="18" filter="url(#bs-inner)" />
                <path d={LOOP_OUTER} fill="none" stroke="#0a4f80" strokeOpacity="0.35" strokeWidth="16" transform="translate(8 0)" filter="url(#bs-inner)" />
                <path d={stadium(312, 52, 176, 476)} fill="none" stroke="url(#bs-loop-sheen)" strokeWidth="6" strokeOpacity="0.9" filter="url(#bs-inner)" />
              </g>
              <path d={LOOP_OUTER} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
            </motion.g>
            </motion.g>

            {/* Teal tip emerging through the loop */}
            <motion.g
              style={{ x: tipX }}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <path d="M364 256 L404 290 L364 324 Z" fill="url(#bs-tip)" />
              <path d="M364 256 L404 290" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" />
            </motion.g>
          </svg>
        </motion.div>
      </motion.div>

      {!reduce && (
        <button
          type="button"
          className={styles.pause}
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
          <span className="visually-hidden">{paused ? 'Play' : 'Pause'} background animation</span>
        </button>
      )}
    </div>
  );
}
