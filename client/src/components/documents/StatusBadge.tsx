import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import type { DocumentStatus } from "../../types/document";

const CONFIG: Record<DocumentStatus, { label: string; className: string; Icon: typeof Loader2; spin?: boolean }> = {
  uploading: { label: "Uploading", className: "bg-sidebar text-muted", Icon: UploadCloud },
  processing: { label: "Processing", className: "bg-warn-soft text-warn", Icon: Loader2, spin: true },
  ready: { label: "Ready", className: "bg-accent-soft text-accent-strong", Icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-danger-soft text-danger", Icon: AlertTriangle },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { label, className, Icon, spin } = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className={`h-3 w-3 ${spin ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
      {label}
    </span>
  );
}
