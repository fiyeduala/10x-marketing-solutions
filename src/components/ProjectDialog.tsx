import { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Need, Project } from '../content/site';
import { useEnquiry } from '../context/EnquiryContext';
import { Dialog } from './Dialog';
import { ProjectVisual } from './ProjectVisual';
import styles from './ProjectDialog.module.css';

export function ProjectDialog({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { open: openEnquiry } = useEnquiry();
  // Keep the last project rendered while the dialog animates closed
  const [shown, setShown] = useState<Project | null>(project);
  useEffect(() => {
    if (project) setShown(project);
  }, [project]);

  const p = project ?? shown;

  const need: Need | undefined = p
    ? p.disciplines.length > 1
      ? 'both'
      : p.disciplines[0]
    : undefined;

  return (
    <Dialog
      open={open && !!p}
      onClose={onClose}
      labelledBy="project-dialog-title"
      describedBy="project-dialog-brief"
      initialFocusRef={closeRef}
    >
      {p && (
        <div className={styles.layout}>
          <div className={styles.visual}>
            <ProjectVisual project={p} large />
          </div>
          <div className={styles.body}>
            <div className={styles.topRow}>
              {p.isConcept ? <span className="concept-tag">Concept project</span> : <span />}
              <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
                <X size={20} aria-hidden />
                <span className="visually-hidden">Close project details</span>
              </button>
            </div>
            <p className={styles.category}>{p.category}</p>
            <h2 id="project-dialog-title" className={styles.title}>
              {p.title}
            </h2>
            <p id="project-dialog-brief" className={styles.brief}>
              {p.brief}
            </p>

            <div className={styles.columns}>
              <div>
                <h3 className={styles.listTitle}>Scope</h3>
                <ul className={styles.list}>
                  {p.scope.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={styles.listTitle}>Deliverables</h3>
                <ul className={styles.list}>
                  {p.deliverables.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {p.isConcept && (
              <p className={styles.note}>
                This is an illustrative concept showing how we would approach this kind of project. It is not a
                client case study.
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                window.setTimeout(() => openEnquiry({ need }), 220);
              }}
            >
              Discuss a similar project <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
