import { AlertCircle, Info, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { buttonSecondary } from "./styles";

interface NoticeProps {
  tone?: "error" | "info" | "warn";
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

const tones = {
  error: "border-danger/25 bg-danger-soft text-danger",
  warn: "border-warn/25 bg-warn-soft text-warn",
  info: "border-line bg-sidebar text-muted",
};

/** Inline, contextual message. Errors use role=alert; others role=status. */
export function Notice({ tone = "info", children, onRetry, retryLabel = "Retry" }: NoticeProps) {
  const Icon = tone === "info" ? Info : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm ${tones[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${buttonSecondary} shrink-0 !px-2 !py-1 text-xs`}>
          <RotateCw className="h-3 w-3" aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
