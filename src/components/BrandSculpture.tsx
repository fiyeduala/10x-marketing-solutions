import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import sculpture from '../assets/sculpture/sculpture.webp';
import styles from './BrandSculpture.module.css';

/**
 * The supplied 3D render of the brand sculpture, shown as-is (square, never
 * stretched). It floats gently and tilts a few degrees with the pointer on
 * mouse/trackpad devices. Static when reduced motion is on or when paused.
 */
export function BrandSculpture() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { margin: '0px 0px -10% 0px' });
  const [paused, setPaused] = useState(false);
  const [finePointer, setFinePointer] = useState(false);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 50, damping: 18, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 50, damping: 18, mass: 0.7 });
  const rotateY = useTransform(sx, [-1, 1], [-4, 4]);
  const rotateX = useTransform(sy, [-1, 1], [3, -3]);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine) and (hover: hover)');
    const update = () => setFinePointer(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const moving = !reduce && !paused;
  const interactive = finePointer && moving;

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

  const floating = moving && inView;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.light} aria-hidden />
      <motion.div className={styles.stage} style={interactive ? { rotateX, rotateY } : undefined}>
        <motion.img
          className={styles.img}
          src={sculpture}
          alt=""
          width={1254}
          height={1254}
          decoding="async"
          fetchPriority="high"
          animate={floating ? { y: [0, -10, 0] } : { y: 0 }}
          transition={floating ? { duration: 7, ease: 'easeInOut', repeat: Infinity } : { duration: 0.6 }}
        />
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
