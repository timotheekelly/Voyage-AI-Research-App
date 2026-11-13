import { ArrowUp, Square, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  /** Blocks submission (e.g. invalid retrieval configuration). */
  blockedReason?: string;
  /** Retrieval controls; omit for versions without any. */
  settings?: ReactNode;
  focusSignal?: number;
}

export function ChatInput({ value, onChange, onSubmit, onCancel, pending, blockedReason, settings, focusSignal }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSubmit = value.trim().length > 0 && !pending && !blockedReason;

  // Auto-grow up to a limit.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "";
    if (value) el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (focusSignal) ref.current?.focus();
  }, [focusSignal]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      {settings && settingsOpen && (
        <div
          id={settingsId}
          className="mb-2 max-h-[45vh] overflow-y-auto rounded-lg border border-line bg-surface p-4"
        >
          {settings}
        </div>
      )}
      <div className="rounded-lg border border-line bg-surface transition-colors focus-within:border-accent/60">
        <label htmlFor="chat-question" className="sr-only">
          Ask a question about your documents
        </label>
        <textarea
          id="chat-question"
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question about your documents…"
          className="block max-h-[200px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[15px] outline-none placeholder:text-muted/70 focus-visible:outline-none"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div>
            {settings && (
              <button
                type="button"
                aria-expanded={settingsOpen}
                aria-controls={settingsId}
                onClick={() => setSettingsOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Retrieval settings
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline">Enter to send · Shift+Enter for newline</span>
            {pending ? (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Stop generating"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-sidebar"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                aria-label="Send question"
                title={blockedReason}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
      {blockedReason && (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {blockedReason}
        </p>
      )}
    </form>
  );
}
