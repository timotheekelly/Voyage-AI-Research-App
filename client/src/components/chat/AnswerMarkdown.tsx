import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "../../types/chat";
import { linkifyCitations, parseCitationHref } from "../../utils/citations";

interface Props {
  content: string;
  citations: Citation[];
  onCitationClick: (citation: Citation) => void;
}

export const AnswerMarkdown = memo(function AnswerMarkdown({ content, citations, onCitationClick }: Props) {
  return (
    <div className="prose-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            const n = parseCitationHref(href);
            const citation = n ? citations[n - 1] : undefined;
            if (n && citation) {
              return (
                <button
                  type="button"
                  onClick={() => onCitationClick(citation)}
                  aria-label={`Open source ${n}: ${citation.documentTitle}`}
                  className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded bg-accent-soft px-1 align-baseline text-[11px] font-semibold text-accent-strong no-underline hover:bg-accent hover:text-white"
                >
                  {n}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {linkifyCitations(content, citations.length)}
      </ReactMarkdown>
    </div>
  );
});
