import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Need } from '../content/site';

export interface EnquiryPreset {
  need?: Need;
  serviceId?: string;
}

interface EnquiryContextValue {
  isOpen: boolean;
  preset: EnquiryPreset | null;
  /** Increments with every open() so the form can apply a new preset */
  presetKey: number;
  open: (preset?: EnquiryPreset) => void;
  close: () => void;
}

const EnquiryContext = createContext<EnquiryContextValue | null>(null);

export function EnquiryProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [preset, setPreset] = useState<EnquiryPreset | null>(null);
  const [presetKey, setPresetKey] = useState(0);

  const open = useCallback((p?: EnquiryPreset) => {
    setPreset(p ?? null);
    setPresetKey((k) => k + 1);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ isOpen, preset, presetKey, open, close }), [isOpen, preset, presetKey, open, close]);
  return <EnquiryContext.Provider value={value}>{children}</EnquiryContext.Provider>;
}

export function useEnquiry() {
  const ctx = useContext(EnquiryContext);
  if (!ctx) throw new Error('useEnquiry must be used inside EnquiryProvider');
  return ctx;
}
