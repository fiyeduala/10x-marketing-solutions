import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Plus } from 'lucide-react';
import { services, type Discipline, type Service } from '../content/site';
import { useEnquiry } from '../context/EnquiryContext';
import { Reveal } from './Reveal';
import styles from './ServiceList.module.css';

const GROUPS: { id: Discipline; label: string; blurb: string }[] = [
  { id: 'marketing', label: 'Marketing', blurb: 'Brand, content and performance marketing that connect you with the right audience.' },
  { id: 'software', label: 'Software', blurb: 'Custom software and digital products built around real business goals.' },
];

export function ServiceList() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section id="services" className={styles.services} aria-labelledby="services-title">
      <div className="container">
        <div className={styles.head}>
          <Reveal>
            <p className={`index-label ${styles.index}`}>04 — Services</p>
            <h2 id="services-title" className={styles.title}>
              Two disciplines, one direction<span className="dot">.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className={styles.intro}>
              Choose a single service or combine them. Open any row to see what it typically includes.
            </p>
          </Reveal>
        </div>

        <div className={styles.columns}>
          {GROUPS.map((group) => {
            const items = services.filter((s) => s.discipline === group.id);
            return (
              <div key={group.id} className={styles.group}>
                <Reveal className={styles.groupHead}>
                  <span className={`${styles.glyph} ${styles[group.id]}`} aria-hidden />
                  <h3 className={styles.groupTitle}>{group.label}</h3>
                  <p className={styles.groupBlurb}>{group.blurb}</p>
                </Reveal>
                <ul className={styles.list}>
                  {items.map((service) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      number={services.indexOf(service) + 1}
                      open={expanded === service.id}
                      onToggle={() => setExpanded((e) => (e === service.id ? null : service.id))}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ServiceRow({
  service,
  number,
  open,
  onToggle,
}: {
  service: Service;
  number: number;
  open: boolean;
  onToggle: () => void;
}) {
  const reduce = useReducedMotion();
  const { open: openEnquiry } = useEnquiry();
  const panelId = `service-${service.id}-details`;
  const buttonId = `service-${service.id}-button`;

  return (
    <li className={styles.row} data-open={open || undefined}>
      <h4 className={styles.rowHeading}>
        <button
          id={buttonId}
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className={styles.num}>{String(number).padStart(2, '0')}</span>
          <span className={styles.name}>{service.name}</span>
          <span className={styles.icon} aria-hidden>
            <Plus size={20} />
          </span>
        </button>
      </h4>
      <p className={styles.outcome}>{service.outcome}</p>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            className={styles.details}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.detailsInner}>
              <p className={styles.scopeLabel}>Typical scope</p>
              <ul className={styles.scope}>
                {service.scope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => openEnquiry({ need: service.discipline, serviceId: service.id })}
              >
                Discuss this service <ArrowRight size={17} aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
