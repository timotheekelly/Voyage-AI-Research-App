import { ChevronDown, FileText, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { DocumentRecord } from "../../types/document";
import { formatBytes, formatDate } from "../../utils/format";
import { StatusBadge } from "./StatusBadge";

interface Props {
  document: DocumentRecord;
  onDelete: (doc: DocumentRecord) => void;
}

export function DocumentRow({ document: doc, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const uploaded = formatDate(doc.uploadedAt);
  const m = doc.metadata;

  return (
    <li className="border-b border-line last:border-0">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`${open ? "Hide" : "Show"} details for ${doc.title}`}
          onClick={() => setOpen((o) => !o)}
          className="rounded p-1 text-muted hover:bg-ink/5"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
        </button>
        <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{doc.title}</p>
          <p className="truncate text-xs text-muted">
            {[m?.author, m?.publicationYear, m?.documentType].filter(Boolean).join(" · ") || doc.fileName || "No metadata"}
          </p>
        </div>
        <span className="hidden text-xs text-muted sm:block">{uploaded}</span>
        <StatusBadge status={doc.status} />
        <button
          type="button"
          onClick={() => onDelete(doc)}
          aria-label={`Delete ${doc.title}`}
          className="rounded p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <dl id={detailsId} className="grid gap-x-8 gap-y-2 bg-canvas px-12 py-3 text-xs sm:grid-cols-2">
          {[
            ["File name", doc.fileName],
            ["Size", formatBytes(doc.sizeBytes)],
            ["Pages", doc.pageCount?.toString()],
            ["Author", m?.author],
            ["Published", m?.publicationDate ? formatDate(m.publicationDate) : m?.publicationYear?.toString()],
            ["Type", m?.documentType],
            ["Tags", m?.tags?.join(", ")],
            ["Document ID", doc.id],
            ["Failure reason", doc.failureReason],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
        </dl>
      )}
    </li>
  );
}
