import type { Project } from '../content/site';
import styles from './ProjectVisual.module.css';

/**
 * Illustrated project previews built from HTML/CSS. Purely decorative:
 * all names and figures are placeholders, not client data.
 */
export function ProjectVisual({ project, large = false }: { project: Project; large?: boolean }) {
  if (project.image) {
    return (
      <img
        className={styles.image}
        src={project.image.src}
        alt={project.image.alt}
        width={project.image.width}
        height={project.image.height}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const cls = `${styles.canvas} ${large ? styles.large : ''}`;
  switch (project.visual) {
    case 'campaign':
      return <Campaign className={cls} />;
    case 'dashboard':
      return <Dashboard className={cls} />;
    case 'commerce':
      return <Commerce className={cls} />;
  }
}

function Campaign({ className }: { className: string }) {
  return (
    <div className={`${className} ${styles.campaign}`} aria-hidden>
      <div className={styles.posterA}>
        <span className={styles.posterMeta}>Campaign 01</span>
        <span className={styles.posterHead}>
          Made
          <br />
          to move<span>.</span>
        </span>
        <span className={styles.posterArrow} />
      </div>
      <div className={styles.posterB}>
        <span className={styles.posterLoop} />
        <span className={styles.posterSmall}>Launch week</span>
      </div>
      <div className={styles.browser}>
        <div className={styles.chrome}>
          <i />
          <i />
          <i />
          <span />
        </div>
        <div className={styles.lpHero}>
          <div>
            <b />
            <b />
            <em />
          </div>
          <span className={styles.lpArt} />
        </div>
        <div className={styles.lpRow}>
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className={styles.socialTile}>
        <span />
        <b />
      </div>
    </div>
  );
}

function Dashboard({ className }: { className: string }) {
  const bars = [42, 64, 50, 78, 58, 88, 70, 94, 66, 82];
  return (
    <div className={`${className} ${styles.dashboard}`} aria-hidden>
      <div className={styles.app}>
        <aside className={styles.side}>
          <span className={styles.sideLogo} />
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={i === 1 ? styles.sideActive : undefined} />
          ))}
        </aside>
        <div className={styles.main}>
          <div className={styles.topbar}>
            <span className={styles.titleBar} />
            <span className={styles.sample}>Illustrative data</span>
          </div>
          <div className={styles.kpis}>
            {['Orders', 'Tasks', 'Stock'].map((k, i) => (
              <div key={k} className={styles.kpi}>
                <small>{k}</small>
                <b style={{ width: `${48 + i * 12}%` }} />
                <span className={i === 0 ? styles.up : undefined} />
              </div>
            ))}
          </div>
          <div className={styles.chartRow}>
            <div className={styles.chart}>
              <small>Weekly activity</small>
              <div className={styles.bars}>
                {bars.map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} className={i === 7 ? styles.barHi : undefined} />
                ))}
              </div>
            </div>
            <div className={styles.list}>
              <small>Today</small>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={styles.listItem}>
                  <i className={styles[`st${i % 3}`]} />
                  <span style={{ width: `${70 - i * 9}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Commerce({ className }: { className: string }) {
  return (
    <div className={`${className} ${styles.commerce}`} aria-hidden>
      <div className={styles.journey}>
        {['Discover', 'Product', 'Bag', 'Checkout'].map((s, i) => (
          <span key={s} className={i === 3 ? styles.journeyActive : undefined}>
            {s}
          </span>
        ))}
      </div>
      <div className={styles.phone}>
        <div className={styles.phoneBar} />
        <div className={styles.product}>
          <span className={styles.productShape} />
        </div>
        <div className={styles.productMeta}>
          <b />
          <span />
        </div>
        <div className={styles.swatches}>
          <i />
          <i />
          <i />
        </div>
        <div className={styles.addBtn}>Add to bag</div>
      </div>
      <div className={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.tile}>
            <span className={styles[`tileArt${i}`]} />
            <b />
          </div>
        ))}
      </div>
    </div>
  );
}
