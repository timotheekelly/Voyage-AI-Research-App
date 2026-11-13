import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApiVersion } from "../hooks/useApiVersion";
import type { Citation } from "../types/chat";

export interface CitationContextValue {
  selected: Citation | null;
  open: (citation: Citation) => void;
  close: () => void;
}

const CitationContext = createContext<CitationContextValue | null>(null);

export function CitationProvider({ children }: { children: ReactNode }) {
  const { version } = useApiVersion();
  const [selected, setSelected] = useState<Citation | null>(null);
  const open = useCallback((c: Citation) => setSelected(c), []);
  const close = useCallback(() => setSelected(null), []);

  // Citations from one API version are stale in another.
  useEffect(() => setSelected(null), [version]);

  const value = useMemo(() => ({ selected, open, close }), [selected, open, close]);
  return <CitationContext.Provider value={value}>{children}</CitationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCitation(): CitationContextValue {
  const ctx = useContext(CitationContext);
  if (!ctx) throw new Error("useCitation must be used inside CitationProvider");
  return ctx;
}
