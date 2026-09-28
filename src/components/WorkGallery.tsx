import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { projects, work, type Discipline, type Project } from '../content/site';
import { ProjectDialog } from './ProjectDialog';
import { ProjectVisual } from './ProjectVisual';
import { Reveal } from './Reveal';
import styles from './WorkGallery.module.css';

type Filter = 'all' | Discipline;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'software', label: 'Software' },
];

export function WorkGallery() {
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const visible = useMemo(
    () => projects.filter((p) => filter === 'all' || p.disciplines.includes(filter)),
    [filter],
  );
  const current = projects.find((p) => p.id === openId) ?? null;

  return (
    <section id="work" className={styles.work} aria-labelledby="work-title">
      <div className="container">
        <div className={styles.head}>
          <Reveal>
            <p className={`index-label ${styles.index}`}>03 — Selected work</p>
            <h2 id="work-title" className={styles.title}>
              {work.heading.replace(/\.$/, '')}
              <span className="dot">.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className={styles.headSide}>
            <p className={styles.intro}>{work.intro}</p>
            <div className={styles.filters} role="group" aria-label="Filter projects">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={styles.filter}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <p className="visually-hidden" aria-live="polite">
          Showing {visible.length} {visible.length === 1 ? 'project' : 'projects'}
        </p>

        <motion.ul className={styles.grid} layout={!reduce}>
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((project, i) => (
              <motion.li
                key={project.id}
                layout={!reduce}
                className={`${styles.item} ${styles[slot(i, visible.length)]}`}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <ProjectCard project={project} index={projects.indexOf(project)} onOpen={() => setOpenId(project.id)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>

      <ProjectDialog project={current} open={openId !== null} onClose={() => setOpenId(null)} />
    </section>
  );
}

function slot(i: number, count: number) {
  if (count === 1 || i === 0) return 'feature';
  return i === 1 ? 'wide' : 'narrow';
}

function ProjectCard({ project, index, onOpen }: { project: Project; index: number; onOpen: () => void }) {
  const titleId = `project-${project.id}-title`;
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.visual}>
        <ProjectVisual project={project} />
        {project.isConcept && <span className={`concept-tag ${styles.tag}`}>Concept project</span>}
      </div>
      <div className={styles.meta}>
        <span className={styles.num} aria-hidden>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className={styles.metaText}>
          <p className={styles.category}>{project.category}</p>
          <h3 id={titleId} className={styles.cardTitle}>
            {project.title}
          </h3>
          <p className={styles.summary}>{project.summary}</p>
        </div>
        <button type="button" className={styles.open} onClick={onOpen} aria-haspopup="dialog">
          <span className="visually-hidden">View details: {project.title}</span>
          <ArrowUpRight size={22} aria-hidden />
        </button>
      </div>
    </article>
  );
}
