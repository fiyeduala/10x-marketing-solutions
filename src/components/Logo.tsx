import logoSrc from '../assets/brand/logo.png';
import { site } from '../content/site';
import styles from './Logo.module.css';

/**
 * Official logo. The supplied raster has a white background, so it always sits on
 * an intentional white backing. To upgrade, replace src/assets/brand/logo.png
 * (keep the file name) or point the import at an SVG / transparent PNG.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`${styles.plate} ${styles[size]}`}>
      <img src={logoSrc} alt={site.name} width={720} height={350} decoding="async" />
    </span>
  );
}
