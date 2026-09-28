import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that labels the dialog */
  labelledBy: string;
  describedBy?: string;
  variant?: 'center' | 'sheet' | 'menu';
  className?: string;
  /** Element to focus when opened. Defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Return focus to the previously focused element on close (default true). */
  restoreFocus?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let lockCount = 0;
function lockScroll() {
  if (lockCount++ === 0) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
  }
}
function unlockScroll() {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.documentElement.style.overflow = '';
    document.body.style.paddingRight = '';
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Accessible modal built on the native <dialog> element:
 * top-layer rendering + inert background, focus trap, initial focus,
 * Escape to dismiss, scroll locking and focus return.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  variant = 'center',
  className,
  initialFocusRef,
  restoreFocus = true,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  const restoreRef = useRef(restoreFocus);
  restoreRef.current = restoreFocus;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      setClosing(false);
      el.showModal();
      lockScroll();
      const target = initialFocusRef?.current ?? el.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
      return;
    }

    if (!open && el.open) {
      const finish = () => {
        el.close();
        setClosing(false);
        unlockScroll();
        const back = returnTo.current;
        if (restoreRef.current && back && document.contains(back)) back.focus();
      };
      if (reducedMotion()) {
        finish();
        return;
      }
      setClosing(true);
      const t = window.setTimeout(finish, 200);
      return () => window.clearTimeout(t);
    }
  }, [open, initialFocusRef]);

  // Safety: release scroll lock if unmounted while open
  useEffect(
    () => () => {
      if (ref.current?.open) unlockScroll();
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return;
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (n) => n.offsetParent !== null || n === document.activeElement,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles[variant]} ${className ?? ''}`}
      data-closing={closing || undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel)
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={styles.panel}>{children}</div>
    </dialog>
  );
}
