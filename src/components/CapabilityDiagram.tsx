import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import type { Need } from '../content/site';
import marketing from '../assets/capability/marketing.webp';
import software from '../assets/capability/software.webp';
import styles from './CapabilityStage.module.css';

/**
 * Supplied glass-panel renders for the capability stage, shown as-is
 * (square, never stretched). Decorative. They tilt a few degrees with the
 * pointer on mouse/trackpad devices; no continuous motion.
 */
export function CapabilityDiagram({ mode }: { mode: Need }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [finePointer, setFinePointer] = useState(false);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 50, damping: 18, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 50, damping: 18, mass: 0.7 });
  const rotateY = useTransform(sx, [-1, 1], [-5, 5]);
  const rotateX = useTransform(sy, [-1, 1], [3, -3]);

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
    const scope = ref.current?.closest('section') ?? window;
    const onMove = (e: Event) => {
      const { clientX, clientY } = e as PointerEvent;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      px.set(Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / (window.innerWidth / 2))));
      py.set(Math.max(-1, Math.min(1, (clientY - (r.top + r.height / 2)) / (window.innerHeight / 2))));
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

  const images =
    mode === 'both'
      ? [
          { src: marketing, key: 'marketing' },
          { src: software, key: 'software' },
        ]
      : [{ src: mode === 'marketing' ? marketing : software, key: mode }];

  return (
    <div ref={ref} className={styles.art} data-both={mode === 'both' || undefined}>
      {images.map((img, i) => (
        <motion.div
          key={img.key}
          className={styles.artItem}
          style={interactive ? { rotateX, rotateY } : undefined}
          initial={reduce ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={img.src} alt="" width={1254} height={1254} loading="lazy" decoding="async" />
        </motion.div>
      ))}
    </div>
  );
}
