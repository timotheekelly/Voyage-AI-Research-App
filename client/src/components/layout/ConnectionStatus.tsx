import { useConnection } from "../../context/ConnectionContext";
import type { ConnectionState } from "../../types/api";

const LABELS: Record<ConnectionState, { text: string; dot: string; hint: string }> = {
  checking: { text: "Checking", dot: "bg-muted/60 pulse-soft", hint: "Waiting for the first response from the API." },
  connected: { text: "Connected", dot: "bg-accent", hint: "The API server responded. Individual endpoints may still be unavailable." },
  unavailable: { text: "Unavailable", dot: "bg-danger", hint: "The API could not be reached." },
};

export function ConnectionStatus() {
  const { status, mockMode } = useConnection();
  if (mockMode) return null; // Demo Mode badge takes its place
  const { text, dot, hint } = LABELS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={hint} role="status" aria-label={`API connection: ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}
