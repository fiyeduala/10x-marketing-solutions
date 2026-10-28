import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, session, type Me, type PublicConfig } from './api';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="p-wrap p-row" role="status" style={{ justifyContent: 'center', padding: '48px 0' }}>
      <span className="p-spinner" aria-hidden="true" />
      <span className="p-muted">{label}…</span>
    </div>
  );
}

export function ErrorNotice({ error, children }: { error: unknown; children?: ReactNode }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="p-notice p-notice--error" role="alert">
      <p>{message}</p>
      {children}
    </div>
  );
}

/** Loads data once (and on demand via reload). */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load(ctrl.signal).then(
      (data) => !ctrl.signal.aborted && setState({ data, loading: false }),
      (error) => !ctrl.signal.aborted && (error as Error).name !== 'AbortError' && setState({ error, loading: false }),
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

let configPromise: Promise<PublicConfig> | null = null;
export function useConfig() {
  return useResource(() => {
    configPromise ??= api<PublicConfig>('config').catch((e) => {
      configPromise = null;
      throw e;
    });
    return configPromise;
  }, []);
}

/** The signed-in candidate, or null when this browser has no session. */
export function useMe() {
  return useResource<Me | null>(async (signal) => {
    if (!session.get()) return null;
    try {
      return await api<Me>('me', { signal });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  }, []);
}

/** Accessible confirmation dialog built on <dialog>. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="p-dialog"
      aria-labelledby="p-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="p-stack">
        <h2 id="p-dialog-title" className="p-h2">
          {title}
        </h2>
        <div className="p-stack">{children}</div>
        <div className="p-row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="p-btn p-btn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={`p-btn ${danger ? 'p-btn--danger' : ''}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
