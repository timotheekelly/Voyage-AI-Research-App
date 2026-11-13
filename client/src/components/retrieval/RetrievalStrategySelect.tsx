import { RETRIEVAL_STRATEGIES } from "../../config/retrievalConfig";
import type { RetrievalStrategy } from "../../types/retrieval";
import { Field } from "../common/Field";
import { inputClass } from "../common/styles";

interface Props {
  value: RetrievalStrategy;
  onChange: (value: RetrievalStrategy) => void;
}

export function RetrievalStrategySelect({ value, onChange }: Props) {
  return (
    <Field label="Retrieval strategy" htmlFor="retrieval-strategy">
      <select
        id="retrieval-strategy"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value as RetrievalStrategy)}
      >
        {RETRIEVAL_STRATEGIES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
