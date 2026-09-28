import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { hero } from '../content/site';
import { useEnquiry } from '../context/EnquiryContext';
import { BrandSculpture } from './BrandSculpture';
import styles from './Hero.module.css';

export function Hero() {
  const { open } = useEnquiry();
  const reduce = useReducedMotion();

  const container: Variants = { show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
  const item: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
      };

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.grid}`}>
        <motion.div className={styles.copy} variants={container} initial="hidden" animate="show">
          <motion.p className={`index-label ${styles.index}`} variants={item}>
            01 — Studio
          </motion.p>
          <motion.p className="eyebrow" variants={item}>
            Marketing <span aria-hidden className={styles.times}>×</span>
            <span className="visually-hidden">and</span> Software
          </motion.p>
          <motion.h1 id="hero-title" className={styles.title} variants={item}>
            {hero.headline.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </motion.h1>
          <motion.p className={styles.body} variants={item}>
            {hero.body}
          </motion.p>
          <motion.div className={styles.actions} variants={item}>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => open()}>
              {hero.primaryCta} <ArrowRight size={20} aria-hidden />
            </button>
            <a href="#work" className="text-link">
              {hero.secondaryCta}
            </a>
          </motion.div>
        </motion.div>

        <div className={styles.art}>
          <BrandSculpture />
        </div>
      </div>
    </section>
  );
}
