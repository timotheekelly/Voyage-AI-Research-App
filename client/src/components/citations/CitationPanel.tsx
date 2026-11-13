import { FileQuestion, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { getDocument } from "../../api/documents";
import { describeError } from "../../api/errors";
import { useCitation } from "../../context/CitationContext";
import { useApiResource } from "../../hooks/useApiResource";
import { formatDate } from "../../utils/format";
import { Notice } from "../common/Notice";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export function CitationPanel() {
  const { selected, close } = useCitation();
  const docId = selected?.documentId;
  const closeRef = useRef<HTMLButtonElement>(null);
  const doc = useApiResource(docId ? ({ version, signal }) => getDocument(version, docId, signal) : null, [docId]);

  useEffect(() => {
    if (selected) closeRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, close]);

  if (!selected) return null;

  // Prefer what the answer returned; fill gaps only from what the backend actually provides.
  const meta = { ...doc.data?.metadata, ...selected.metadata };
  const published = meta.publicationDate ? formatDate(meta.publicationDate) : meta.publicationYear?.toString();

  return (
    <aside
      aria-label="Source citation"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-line bg-surface lg:static lg:z-auto lg:w-96 lg:max-w-none"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <h2 className="text-sm font-semibold">Source</h2>
        <button ref={closeRef} type="button" onClick={close} aria-label="Close source panel" className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <h3 className="text-base leading-snug font-semibold">{selected.documentTitle}</h3>
          {selected.pageNumber !== undefined && <p className="mt-0.5 text-xs text-muted">Page {selected.pageNumber}</p>}
        </div>

        <section aria-label="Relevant passage">
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Relevant passage</h4>
          {selected.passage.trim() ? (
            <blockquote className="border-l-2 border-accent bg-accent-soft/40 py-1.5 pr-2 pl-3 text-[14px] leading-relaxed">{selected.passage}</blockquote>
          ) : (
            <p className="text-sm text-muted">The API did not return passage text for this citation.</p>
          )}
        </section>

        <section aria-label="Document metadata">
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Details</h4>
          <dl className="space-y-2.5">
            {meta.author && <Row label="Author">{meta.author}</Row>}
            {published && <Row label="Published">{published}</Row>}
            {meta.documentType && <Row label="Type">{meta.documentType}</Row>}
            {meta.tags && meta.tags.length > 0 && <Row label="Tags">{meta.tags.join(", ")}</Row>}
            <Row label="Document ID"><span className="font-mono text-xs">{selected.documentId}</span></Row>
            <Row label="Chunk ID"><span className="font-mono text-xs">{selected.chunkId}</span></Row>
          </dl>
          {!meta.author && !published && !meta.documentType && (
            <p className="mt-2 text-xs text-muted">No additional metadata was returned.</p>
          )}
        </section>

        {doc.loading && <p className="pulse-soft text-xs text-muted">Loading document details…</p>}
        {doc.error && (
          <Notice tone="info">
            <span className="flex items-start gap-1.5">
              <FileQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Full document details are unavailable. {describeError(doc.error)} The citation above is shown as the API returned it.
              </span>
            </span>
          </Notice>
        )}
      </div>
    </aside>
  );
}
