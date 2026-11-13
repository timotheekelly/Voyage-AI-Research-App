import { CANDIDATE_COUNT_OPTIONS, FINAL_COUNT_OPTIONS, withCandidateCount, withFinalResultCount } from "../../config/retrievalConfig";
import type { ConfigValidationIssue, RetrievalConfig } from "../../types/retrieval";
import { Field } from "../common/Field";
import { Switch } from "../common/Switch";
import { inputClass } from "../common/styles";

interface Props {
  config: RetrievalConfig;
  update: (updater: (c: RetrievalConfig) => RetrievalConfig) => void;
  issues: ConfigValidationIssue[];
  /** V3/V4 show everything together; V5 splits the toggle and the counts into separate sections. */
  parts?: "all" | "toggle" | "counts";
}

export function RerankingControls({ config, update, issues, parts = "all" }: Props) {
  const { enabled, candidateCount, finalResultCount } = config.reranking;
  const finalError = issues.find((i) => i.field === "finalResultCount")?.message;
  const candidateError = issues.find((i) => i.field === "candidateCount")?.message;

  // Include the current value even if it is not one of the presets (e.g. restored from storage).
  const candidateOptions = [...new Set([...CANDIDATE_COUNT_OPTIONS, candidateCount])].sort((a, b) => a - b);
  const finalOptions = [...new Set([...FINAL_COUNT_OPTIONS, finalResultCount])]
    .filter((n) => n <= candidateCount)
    .sort((a, b) => a - b);

  return (
    <>
      {parts !== "counts" && (
        <Switch
          id="reranking-enabled"
          label="Enable reranking"
          checked={enabled}
          onChange={(on) => update((c) => ({ ...c, reranking: { ...c.reranking, enabled: on } }))}
        />
      )}
      {parts !== "toggle" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Candidate count" htmlFor="candidate-count" error={candidateError} hint="Passages retrieved before reranking">
            <select
              id="candidate-count"
              className={inputClass}
              value={candidateCount}
              disabled={!enabled}
              onChange={(e) => update((c) => withCandidateCount(c, Number(e.target.value)))}
            >
              {candidateOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Final result count" htmlFor="final-count" error={finalError} hint="Passages sent to the model (max: candidates)">
            <select
              id="final-count"
              className={inputClass}
              value={finalResultCount}
              disabled={!enabled}
              onChange={(e) => update((c) => withFinalResultCount(c, Number(e.target.value)))}
            >
              {finalOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </>
  );
}
