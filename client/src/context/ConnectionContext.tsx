import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { checkHealth, subscribeToActivity } from "../api/client";
import { getHealthPath, isMockApiEnabled } from "../config/apiVersions";
import type { ConnectionState } from "../types/api";

export interface ConnectionContextValue {
  status: ConnectionState;
  /** Increments on every Retry; data hooks include it in their dependencies. */
  retryToken: number;
  retry: () => void;
  mockMode: boolean;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionState>("checking");
  const [retryToken, setRetryToken] = useState(0);
  const mockMode = isMockApiEnabled();

  // Status is derived from real requests: any HTTP response (even 404) means the server is up.
  useEffect(
    () =>
      subscribeToActivity((outcome) => setStatus(outcome === "reachable" ? "connected" : "unavailable")),
    [],
  );

  // Optional one-shot health probe on load and on retry (never polled).
  useEffect(() => {
    const path = getHealthPath();
    if (!path) return;
    const controller = new AbortController();
    setStatus("checking");
    void checkHealth(path, controller.signal).then((ok) => {
      if (!controller.signal.aborted) setStatus(ok ? "connected" : "unavailable");
    });
    return () => controller.abort();
  }, [retryToken]);

  const retry = useCallback(() => {
    setStatus("checking");
    setRetryToken((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ status, retryToken, retry, mockMode }), [status, retryToken, retry, mockMode]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used inside ConnectionProvider");
  return ctx;
}
