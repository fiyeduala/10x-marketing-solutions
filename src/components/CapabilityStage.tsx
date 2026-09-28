import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { capabilityStage, type Need } from '../content/site';
import { useEnquiry } from '../context/EnquiryContext';
import { CapabilityDiagram } from './CapabilityDiagram';
import { Reveal } from './Reveal';
import styles from './CapabilityStage.module.css';

export function CapabilityStage() {
  const { tabs, defaultTab, heading, body } = capabilityStage;
  const [active, setActive] = useState<Need>(defaultTab);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotion();
  const { open } = useEnquiry();

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActive(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className={styles.stage} aria-labelledby="capabilities-title">
      <div className={`container ${styles.inner}`}>
        <div className={styles.intro}>
          <Reveal>
            <p className={`index-label ${styles.index}`}>02 — Capabilities</p>
            <h2 id="capabilities-title" className={styles.title}>
              {heading.replace(/\.$/, '')}
              <span className="dot">.</span>
            </h2>
            <p className={styles.body}>{body}</p>
          </Reveal>

          <Reveal delay={0.1}>
            <div role="tablist" aria-label="Choose a capability" className={styles.tabs}>
              {tabs.map((tab, i) => {
                const selected = tab.id === active;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    role="tab"
                    type="button"
                    id={`cap-tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls={`cap-panel-${tab.id}`}
                    tabIndex={selected ? 0 : -1}
                    className={styles.tab}
                    onClick={() => setActive(tab.id)}
                    onKeyDown={(e) => onKeyDown(e, i)}
                  >
                    {selected && (
                      <motion.span
                        layoutId="cap-tab-pill"
                        className={styles.pill}
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
                      />
                    )}
                    <span className={styles.tabLabel}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>

        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <div
              key={tab.id}
              role="tabpanel"
              id={`cap-panel-${tab.id}`}
              aria-labelledby={`cap-tab-${tab.id}`}
              hidden={!selected}
              tabIndex={0}
              className={styles.panel}
            >
              {selected && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab.id}
                    className={styles.panelGrid}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className={styles.panelCopy}>
                      <p className={styles.kicker}>{tab.label === 'Both' ? 'Marketing + Software' : tab.label}</p>
                      <h3 className={styles.panelTitle}>
                        {tab.title.replace(/\.$/, '')}
                        <span className="dot">.</span>
                      </h3>
                      <p className={styles.panelBody}>{tab.body}</p>
                      <ul className={styles.services} aria-label={`${tab.label} services`}>
                        {tab.services.map((s, i) => (
                          <li key={s}>
                            <span aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                      <button type="button" className={`text-link ${styles.link}`} onClick={() => open({ need: tab.id })}>
                        Discuss {tab.id === 'both' ? 'a combined project' : `a ${tab.label.toLowerCase()} project`}
                        <ArrowRight size={17} aria-hidden />
                      </button>
                    </div>
                    <div className={styles.diagram}>
                      <CapabilityDiagram mode={tab.id} />
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
