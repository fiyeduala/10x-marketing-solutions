import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { approach } from '../content/site';
import { useMediaQuery } from '../lib';
import { Reveal } from './Reveal';
import styles from './Approach.module.css';

export function Approach() {
  const railRef = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery('(min-width: 900px)');
  const reduce = useReducedMotion();
  // Progress fills as the rail travels through the viewport. Normal scrolling is untouched.
  const { scrollYProgress } = useScroll({ target: railRef, offset: ['start 85%', 'end 55%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section id="approach" className={styles.approach} aria-labelledby="approach-title">
      <div className="container">
        <div className={styles.head}>
          <Reveal>
            <p className={`index-label ${styles.index}`}>05 — Approach</p>
            <h2 id="approach-title" className={styles.title}>
              {approach.heading.replace(/\.$/, '')}
              <span className="dot">.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className={styles.flow}>
              {approach.stages.map((s, i) => (
                <span key={s.name}>
                  {s.name}
                  {i < approach.stages.length - 1 && <span className={styles.arrow} aria-hidden>→</span>}
                </span>
              ))}
            </p>
          </Reveal>
        </div>

        <div ref={railRef} className={styles.railWrap}>
          <span className={styles.track} aria-hidden>
            <motion.span className={styles.fill} style={reduce ? undefined : wide ? { scaleX: progress } : { scaleY: progress }} />
          </span>
          <ol className={styles.rail}>
          {approach.stages.map((stage, i) => (
            <li key={stage.name} className={styles.stage}>
              <Reveal delay={i * 0.08}>
                <span className={styles.marker} aria-hidden>
                  <span />
                </span>
                <p className={styles.step}>Stage {String(i + 1).padStart(2, '0')}</p>
                <h3 className={styles.stageTitle}>{stage.name}</h3>
                <p className={styles.stageBody}>{stage.body}</p>
              </Reveal>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
