import { describeError } from "../../api/errors";
import type { UseApiResourceResult } from "../../hooks/useApiResource";
import type { RetrievalConfig, RetrievalOptions } from "../../types/retrieval";
import { Field } from "../common/Field";
import { Switch } from "../common/Switch";
import { inputClass } from "../common/styles";

interface Props {
  config: RetrievalConfig;
  update: (updater: (c: RetrievalConfig) => RetrievalConfig) => void;
  options: UseApiResourceResult<RetrievalOptions>;
}

export function OptimizationControls({ config, update, options }: Props) {
  const { embeddingConfigId, quantization, diagnostics } = config.optimization;
  const embeddings = options.data?.embeddingConfigs ?? [];
  // Quantization is part of a configuration (each is its own index), so only the selected one's value is offered.
  const selected = embeddings.find((e) => e.id === (embeddingConfigId ?? "default")) ?? null;
  const quants = (options.data?.quantizations ?? []).filter((q) => !selected?.quantization || q.id === selected.quantization);
  const embeddingsDisabled = options.loading || options.error !== null || embeddings.length === 0;
  const quantsDisabled = options.loading || options.error !== null || quants.length === 0;

  const reason = options.loading
    ? "Loading options from the backend…"
    : options.error
      ? `Unavailable: ${describeError(options.error)}`
      : embeddings.length === 0 && quants.length === 0
        ? "The backend did not report any alternative configurations."
        : null;

  const setOpt = (patch: Partial<RetrievalConfig["optimization"]>) =>
    update((c) => ({ ...c, optimization: { ...c.optimization, ...patch } }));
  const chooseConfig = (id: string) => setOpt({ embeddingConfigId: id || undefined, quantization: undefined });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Embedding configuration" htmlFor="embedding-config">
          <select
            id="embedding-config"
            className={inputClass}
            disabled={embeddingsDisabled}
            value={embeddingConfigId ?? ""}
            onChange={(e) => chooseConfig(e.target.value)}
          >
            <option value="">Backend default</option>
            {embeddings.map((e) => (
              <option key={e.id} value={e.id} disabled={e.available === false}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantization" htmlFor="quantization">
          <select
            id="quantization"
            className={inputClass}
            disabled={quantsDisabled}
            value={quantization ?? ""}
            onChange={(e) => setOpt({ quantization: e.target.value || undefined })}
          >
            <option value="">Backend default</option>
            {quants.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {reason && <p className="text-xs text-muted">{reason}</p>}
      {selected?.requiresReembedding && (
        <p className="text-xs text-warn">This configuration only applies to documents that have been re-embedded with it.</p>
      )}
      <p className="text-xs text-muted">
        Configurations are defined by the backend. A configuration only applies to documents that were indexed with it.
      </p>
      <Switch
        id="diagnostics-enabled"
        label="Enable diagnostics"
        checked={diagnostics}
        onChange={(on) => setOpt({ diagnostics: on })}
      />
    </div>
  );
}
