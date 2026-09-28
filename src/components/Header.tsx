import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { nav } from '../content/site';
import { useEnquiry } from '../context/EnquiryContext';
import { goToSection } from '../lib';
import { Dialog } from './Dialog';
import { Logo } from './Logo';
import styles from './Header.module.css';

export function Header() {
  const { open: openEnquiry } = useEnquiry();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [restoreFocus, setRestoreFocus] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the menu if the viewport grows past the mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const openMenu = () => {
    setRestoreFocus(true);
    setMenuOpen(true);
  };

  const navigateFromMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setRestoreFocus(false);
    setMenuOpen(false);
    // Wait for the dialog to close and release scroll lock before scrolling
    window.setTimeout(() => goToSection(id), 220);
  };

  return (
    <header className={styles.header} data-scrolled={scrolled || undefined}>
      <div className={`container ${styles.inner}`}>
        <a href="#top" className={styles.brand} aria-label="10X Marketing Solutions — back to top">
          <Logo />
        </a>

        <nav aria-label="Primary" className={styles.desktopNav}>
          <ul>
            {nav.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openEnquiry()}>
            Start a project <ArrowRight size={18} aria-hidden />
          </button>
        </nav>

        <button
          type="button"
          className={styles.menuButton}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={openMenu}
        >
          <Menu size={22} aria-hidden />
          <span className="visually-hidden">Open menu</span>
        </button>
      </div>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy="mobile-menu-title"
        variant="menu"
        initialFocusRef={closeRef}
        restoreFocus={restoreFocus}
      >
        <div className={styles.menu}>
          <div className={`container ${styles.inner}`}>
            <Logo />
            <button ref={closeRef} type="button" className={styles.menuButton} onClick={() => setMenuOpen(false)}>
              <X size={22} aria-hidden />
              <span className="visually-hidden">Close menu</span>
            </button>
          </div>
          <nav aria-labelledby="mobile-menu-title" className={`container ${styles.menuNav}`}>
            <h2 id="mobile-menu-title" className="index-label">
              Menu
            </h2>
            <ul>
              {nav.map((item, i) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} onClick={(e) => navigateFromMenu(e, item.id)}>
                    <span className={styles.num}>0{i + 1}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                setRestoreFocus(false);
                setMenuOpen(false);
                window.setTimeout(() => openEnquiry(), 220);
              }}
            >
              Start a project <ArrowRight size={20} aria-hidden />
            </button>
          </nav>
          <div className={styles.menuArt} aria-hidden>
            <span />
            <span />
          </div>
        </div>
      </Dialog>
    </header>
  );
}
