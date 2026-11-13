interface ChipMultiSelectProps {
  legend: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  emptyText?: string;
}

export function ChipMultiSelect({ legend, options, selected, onChange, disabled, emptyText }: ChipMultiSelectProps) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  return (
    <fieldset disabled={disabled} className="space-y-1.5">
      <legend className="text-xs font-medium text-ink">{legend}</legend>
      {options.length === 0 ? (
        <p className="text-xs text-muted">{emptyText ?? "No options available."}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <label
                key={opt}
                className={`inline-flex cursor-pointer items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  on ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-muted hover:text-ink"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(opt)} />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
