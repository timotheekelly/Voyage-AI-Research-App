import { AlertCircle, RotateCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { describeError } from "../../api/errors";
import { useDocuments } from "../../hooks/useDocuments";
import type { DocumentRecord, DocumentStatus } from "../../types/document";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Notice } from "../common/Notice";
import { buttonSecondary, inputClass } from "../common/styles";
import { DocumentRow } from "./DocumentRow";
import { DocumentUpload } from "./DocumentUpload";
import { StatusBadge } from "./StatusBadge";

export function DocumentLibrary() {
  const lib = useDocuments();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "all">("all");
  const [toDelete, setToDelete] = useState<DocumentRecord | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lib.documents.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!q) return true;
      const hay = [d.title, d.fileName, d.metadata?.author, d.metadata?.documentType, ...(d.metadata?.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [lib.documents, query, status]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    await lib.remove(toDelete.id);
    setToDelete(null);
  };

  return (
    <div className="mx-auto h-full w-full max-w-4xl overflow-y-auto px-4 py-8 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Document library</h1>
          <p className="mt-1 text-sm text-muted">Upload and organize the documents your questions are answered from.</p>
        </div>
        <button type="button" onClick={lib.reload} disabled={lib.loading} className={`${buttonSecondary} shrink-0`}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
        </button>
      </div>
      {lib.documents.some((d) => d.status === "processing") && (
        <p className="mt-3 text-xs text-muted">
          Some documents are still processing. They become searchable once embedding finishes; use Refresh to check.
        </p>
      )}

      <div className="mt-6">
        <DocumentUpload onFiles={lib.upload} />
      </div>

      {lib.uploads.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Uploads in progress">
          {lib.uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{u.fileName}</p>
                {u.error && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-danger" role="alert">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    Upload failed. {u.error}
                  </p>
                )}
              </div>
              <StatusBadge status={u.status === "failed" ? "failed" : "uploading"} />
              {u.status === "failed" && (
                <>
                  <button type="button" className={`${buttonSecondary} !px-2 !py-1 text-xs`} onClick={() => lib.retryUpload(u.id)}>
                    <RotateCw className="h-3 w-3" aria-hidden="true" /> Retry
                  </button>
                  <button type="button" aria-label={`Dismiss ${u.fileName}`} className="rounded p-1 text-muted hover:bg-ink/5" onClick={() => lib.dismissUpload(u.id)}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-muted" aria-hidden="true" />
          <label htmlFor="doc-search" className="sr-only">
            Search documents
          </label>
          <input id="doc-search" type="search" className={`${inputClass} pl-8`} placeholder="Search title, author, tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label htmlFor="doc-status" className="sr-only">
          Filter by status
        </label>
        <select id="doc-status" className={`${inputClass} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus | "all")}>
          <option value="all">All statuses</option>
          <option value="processing">Processing</option>
          <option value="ready">Ready</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {lib.deleteError && (
        <div className="mt-3">
          <Notice tone="error">Could not delete the document. {lib.deleteError}</Notice>
        </div>
      )}

      <section aria-label="Documents" className="mt-3 rounded-lg border border-line bg-surface">
        {lib.loading ? (
          <p className="pulse-soft p-6 text-center text-sm text-muted" role="status">
            Loading documents…
          </p>
        ) : lib.error ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium">Documents are unavailable</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{describeError(lib.error)}</p>
            <button type="button" onClick={lib.reload} className={`${buttonSecondary} mt-3`}>
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
            </button>
          </div>
        ) : lib.documents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No documents yet</p>
            <p className="mt-1 text-sm text-muted">Upload a document above to start building your library.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No documents match your search.</p>
        ) : (
          <ul>
            {filtered.map((d) => (
              <DocumentRow key={d.id} document={d} onDelete={setToDelete} />
            ))}
          </ul>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Delete document?"
          description={`“${toDelete.title}” will be permanently removed and can no longer be cited. This cannot be undone.`}
          confirmLabel="Delete"
          busy={lib.deletingId === toDelete.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
