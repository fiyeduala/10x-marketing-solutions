import { about } from '../content/site';
import { Reveal } from './Reveal';
import styles from './About.module.css';

export function About() {
  return (
    <section id="about" className={styles.about} aria-labelledby="about-title">
      <div className="container">
        <div className={styles.top}>
          <Reveal>
            <p className={`index-label ${styles.index}`}>06 — About</p>
            <h2 id="about-title" className={styles.title}>
              Creative thinking<span className="dot">.</span>
              <br />
              <span className={styles.soft}>Practical execution.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className={styles.copyCol}>
            <p className={styles.body}>{about.body}</p>
            <div className={styles.mark} aria-hidden>
              <span className={styles.markLoop} />
              <span className={styles.markArrow} />
            </div>
          </Reveal>
        </div>

        <ol className={styles.principles} aria-label="Working principles">
          {about.principles.map((p, i) => (
            <li key={p.title}>
              <Reveal delay={i * 0.08}>
                <span className={styles.pNum} aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className={styles.pTitle}>{p.title}</h3>
                <p className={styles.pBody}>{p.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
