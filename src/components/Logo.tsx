import logoSrc from '../assets/brand/logo.png';
import logoOnDarkSrc from '../assets/brand/logo-on-dark.png';
import { site } from '../content/site';
import styles from './Logo.module.css';

/**
 * Official logo on a transparent background. `tone="dark"` is for dark
 * backgrounds: the same artwork with the black "Solutions" lettering in white.
 */
export function Logo({ size = 'md', tone = 'light' }: { size?: 'sm' | 'md'; tone?: 'light' | 'dark' }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <img src={tone === 'dark' ? logoOnDarkSrc : logoSrc} alt={site.name} width={720} height={350} decoding="async" />
    </span>
  );
}
