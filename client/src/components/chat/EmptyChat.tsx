export const EXAMPLE_PROMPTS = [
  "Summarize the main findings across my documents.",
  "Compare the conclusions of these studies.",
  "Find documents discussing nuclear energy.",
  "What evidence supports this argument?",
] as const;

interface Props {
  onPick: (prompt: string) => void;
}

export function EmptyChat({ onPick }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Your research, understood.</h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">
        Explore your documents, uncover connections, and find answers grounded in your sources.
      </p>
      <div className="mt-8 grid gap-2 text-left sm:grid-cols-2" role="list" aria-label="Example prompts">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            role="listitem"
            type="button"
            onClick={() => onPick(p)}
            className="rounded-md border border-line bg-surface px-3.5 py-2.5 text-left text-sm text-ink transition-colors hover:border-accent/50 hover:bg-accent-soft/40"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
