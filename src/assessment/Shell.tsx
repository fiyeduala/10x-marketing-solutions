import type { ReactNode } from 'react';
import logoSrc from '../assets/brand/logo.png';
import { CONTACT_EMAIL } from './format';
import { Link, paths } from './router';
import styles from './Shell.module.css';

/** Standalone portal chrome: no marketing-site navigation. */
export function Shell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  return (
    <>
      <a className="p-skip" href="#main">
        Skip to content
      </a>
      <header className={`${styles.header} p-noprint`}>
        <div className={`p-wrap ${styles.bar}`}>
          <Link href={paths.home} className={styles.brand} aria-label="10X Customer Support Professional Assessment, overview">
            <span className={styles.plate}>
              <img src={logoSrc} alt="" width={720} height={350} />
            </span>
            <span className={styles.name}>
              Customer Support
              <br />
              Professional Assessment
            </span>
          </Link>
          {!bare && (
            <nav aria-label="Assessment" className={styles.nav}>
              <Link href={paths.handbook}>Handbook</Link>
              <Link href={paths.verify()}>Verify</Link>
              <Link href={paths.dashboard}>My assessment</Link>
            </nav>
          )}
        </div>
      </header>
      <main id="main" className="p-main">
        {children}
      </main>
      {!bare && (
        <footer className={`${styles.footer} p-noprint`}>
          <div className={`p-wrap ${styles.footRow}`}>
            <p>
              Run by 10X Marketing Solutions. Questions:{' '}
              <a className="p-link" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </p>
            <nav aria-label="Policies" className={styles.footNav}>
              <Link href={paths.privacy}>Privacy notice</Link>
              <Link href={paths.terms}>Assessment terms</Link>
              <Link href={paths.verify()}>Verify a certificate</Link>
            </nav>
          </div>
        </footer>
      )}
    </>
  );
}
