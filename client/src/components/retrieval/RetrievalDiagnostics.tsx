import { ChevronDown, Gauge } from "lucide-react";
import { useId, useState } from "react";
import type { RetrievalDiagnostics as Diagnostics } from "../../types/retrieval";
import { formatCost, formatMs } from "../../utils/format";

interface Props {
  diagnostics?: Diagnostics;
}

const NA = "Not available";

function num(n: number | undefined, digits = 3): string | null {
  return n === undefined ? null : n.toFixed(digits);
}

export function RetrievalDiagnostics({ diagnostics }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const d = diagnostics;

  // Only values the backend actually returned are shown; everything else says "Not available".
  const rows: [string, string | null][] = [
    ["Retrieval latency", formatMs(d?.retrievalLatencyMs) ?? null],
    ["Reranking latency", formatMs(d?.rerankingLatencyMs) ?? null],
    ["Answer generation latency", formatMs(d?.generationLatencyMs) ?? null],
    ["Total response latency", formatMs(d?.totalLatencyMs) ?? null],
    ["Retrieved candidates", d?.candidateCount?.toString() ?? null],
    ["Final passages", d?.finalPassageCount?.toString() ?? null],
    [d?.recallK !== undefined ? `Recall@${d.recallK}` : "Recall@K", num(d?.recallAtK, 2)],
    ["MRR", num(d?.mrr)],
    ["Estimated cost", formatCost(d?.estimatedCostUsd) ?? null],
  ];

  return (
    <div className="mt-3 rounded-md border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted hover:text-ink"
      >
        <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
        Retrieval diagnostics
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="border-t border-line px-3 py-2.5">
          {!d && <p className="mb-2 text-xs text-muted">The backend did not return diagnostics for this response.</p>}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className={value ? "font-medium tabular-nums text-ink" : "text-muted"}>{value ?? NA}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
