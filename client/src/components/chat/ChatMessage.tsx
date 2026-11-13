import { AlertCircle, FileText, RotateCw } from "lucide-react";
import { useApiVersion } from "../../hooks/useApiVersion";
import { useCitation } from "../../context/CitationContext";
import type { ChatMessage as Message } from "../../types/chat";
import { buttonSecondary } from "../common/styles";
import { RetrievalDiagnostics } from "../retrieval/RetrievalDiagnostics";
import { AnswerMarkdown } from "./AnswerMarkdown";

interface Props {
  message: Message;
  onRetry?: (messageId: string) => void;
  retryDisabled?: boolean;
}

export function ChatMessage({ message, onRetry, retryDisabled }: Props) {
  const { capabilities } = useApiVersion();
  const { open } = useCitation();

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-sidebar px-3.5 py-2 text-[15px] whitespace-pre-wrap">{message.content}</div>
      </div>
    );
  }

  const citations = message.citations ?? [];
  const showDiagnostics = capabilities.diagnostics && (message.diagnostics !== undefined || message.diagnosticsRequested);

  return (
    <article className="flex gap-3" aria-label="Assistant response" aria-busy={message.status === "pending"}>
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-[11px] font-bold text-white" aria-hidden="true">
        V
      </div>
      <div className="min-w-0 flex-1">
        {message.status === "pending" && (
          <p className="pulse-soft text-sm text-muted" role="status">
            Searching your documents…
          </p>
        )}

        {message.status === "cancelled" && (
          <div className="flex items-center gap-3 text-sm text-muted" role="status">
            Request cancelled.
            {onRetry && (
              <button type="button" className={`${buttonSecondary} !px-2 !py-1 text-xs`} disabled={retryDisabled} onClick={() => onRetry(message.id)}>
                <RotateCw className="h-3 w-3" aria-hidden="true" /> Retry
              </button>
            )}
          </div>
        )}

        {message.status === "error" && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{message.error ?? "Something went wrong."}</span>
            {onRetry && (
              <button type="button" className={`${buttonSecondary} !px-2 !py-1 text-xs`} disabled={retryDisabled} onClick={() => onRetry(message.id)}>
                <RotateCw className="h-3 w-3" aria-hidden="true" /> Retry
              </button>
            )}
          </div>
        )}

        {message.status === "complete" && (
          <>
            <AnswerMarkdown content={message.content} citations={citations} onCitationClick={open} />
            {citations.length > 0 && (
              <section aria-label="Sources" className="mt-4">
                <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Sources</h3>
                <ol className="flex flex-wrap gap-1.5">
                  {citations.map((c, i) => (
                    <li key={`${c.chunkId}-${i}`}>
                      <button
                        type="button"
                        onClick={() => open(c)}
                        className="flex max-w-[260px] items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink transition-colors hover:border-accent/50 hover:bg-accent-soft/40"
                      >
                        <span className="font-semibold text-accent-strong">{i + 1}</span>
                        <FileText className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
                        <span className="truncate">{c.documentTitle}</span>
                        {c.pageNumber !== undefined && <span className="shrink-0 text-muted">p. {c.pageNumber}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {showDiagnostics && <RetrievalDiagnostics diagnostics={message.diagnostics} />}
          </>
        )}
      </div>
    </article>
  );
}
