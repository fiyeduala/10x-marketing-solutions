import { nav, site } from '../content/site';
import { Logo } from './Logo';
import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Logo size="sm" />
          <p className={styles.statement}>{site.positioning}</p>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.links}>
            {nav.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ul>
        </nav>
      </div>
      <div className={`container ${styles.base}`}>
        <p>
          © {year} {site.name}. All rights reserved.
        </p>
        <a href="#top" className={styles.top}>
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
