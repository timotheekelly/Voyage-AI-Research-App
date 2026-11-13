import type { UseApiResourceResult } from "../../hooks/useApiResource";
import type { ConfigValidationIssue, RetrievalConfig, RetrievalOptions } from "../../types/retrieval";
import { describeError } from "../../api/errors";
import { ChipMultiSelect } from "../common/ChipMultiSelect";
import { Field } from "../common/Field";
import { inputClass } from "../common/styles";

interface Props {
  config: RetrievalConfig;
  update: (updater: (c: RetrievalConfig) => RetrievalConfig) => void;
  issues: ConfigValidationIssue[];
  options: UseApiResourceResult<RetrievalOptions>;
}

function parseYear(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

export function MetadataFilters({ config, update, issues, options }: Props) {
  const { yearMin, yearMax, documentTypes, tags } = config.filters;
  const yearError = issues.find((i) => i.field === "publicationYear")?.message;
  const unavailable = options.error !== null;
  const setFilters = (patch: Partial<RetrievalConfig["filters"]>) =>
    update((c) => ({ ...c, filters: { ...c.filters, ...patch } }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Published from (year)" htmlFor="year-min" error={yearError}>
          <input
            id="year-min"
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="Any"
            value={yearMin ?? ""}
            onChange={(e) => setFilters({ yearMin: parseYear(e.target.value) })}
          />
        </Field>
        <Field label="Published to (year)" htmlFor="year-max">
          <input
            id="year-max"
            type="number"
            inputMode="numeric"
            className={inputClass}
            placeholder="Any"
            value={yearMax ?? ""}
            onChange={(e) => setFilters({ yearMax: parseYear(e.target.value) })}
          />
        </Field>
      </div>
      {unavailable && (
        <p className="text-xs text-muted">Document type and tag options could not be loaded: {describeError(options.error)}</p>
      )}
      <ChipMultiSelect
        legend="Document type"
        options={options.data?.documentTypes ?? []}
        selected={documentTypes}
        onChange={(next) => setFilters({ documentTypes: next })}
        disabled={options.loading || unavailable}
        emptyText={options.loading ? "Loading…" : "No document types reported by the backend."}
      />
      <ChipMultiSelect
        legend="Tags"
        options={options.data?.tags ?? []}
        selected={tags}
        onChange={(next) => setFilters({ tags: next })}
        disabled={options.loading || unavailable}
        emptyText={options.loading ? "Loading…" : "No tags reported by the backend."}
      />
      <p className="text-xs text-muted">Filters narrow retrieval. Access control is enforced by the backend, not these filters.</p>
    </div>
  );
}
