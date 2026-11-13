import { useWorkspace } from "../../context/WorkspaceContext";
import { useApiVersion } from "../../hooks/useApiVersion";
import type { UseApiResourceResult } from "../../hooks/useApiResource";
import type { ConfigValidationIssue, RetrievalConfig, RetrievalOptions } from "../../types/retrieval";
import { Field } from "../common/Field";
import { inputClass } from "../common/styles";
import { MetadataFilters } from "./MetadataFilters";
import { OptimizationControls } from "./OptimizationControls";
import { RerankingControls } from "./RerankingControls";
import { RetrievalStrategySelect } from "./RetrievalStrategySelect";
import type { ReactNode } from "react";

interface Props {
  config: RetrievalConfig;
  update: (updater: (c: RetrievalConfig) => RetrievalConfig) => void;
  issues: ConfigValidationIssue[];
  options: UseApiResourceResult<RetrievalOptions>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Renders only the controls the selected API version supports, driven by capabilities. */
export function SearchSettings({ config, update, issues, options }: Props) {
  const { capabilities: caps } = useApiVersion();
  const { workspaces, activeWorkspace, setActiveWorkspaceId, loading, error } = useWorkspace();

  return (
    <div className="space-y-5" data-testid="search-settings">
      {caps.metadataFiltering && (
        <Section title="Workspace">
          <Field
            label="Search in workspace"
            htmlFor="workspace-select"
            hint={error ? "Workspaces could not be loaded." : undefined}
          >
            <select
              id="workspace-select"
              className={inputClass}
              disabled={loading || workspaces.length === 0}
              value={activeWorkspace?.id ?? ""}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
            >
              {workspaces.length === 0 && <option value="">{loading ? "Loading…" : "No workspaces available"}</option>}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      )}

      {caps.hybridSearch && (
        <Section title="Search settings">
          <RetrievalStrategySelect
            value={config.retrievalStrategy}
            onChange={(retrievalStrategy) => update((c) => ({ ...c, retrievalStrategy }))}
          />
        </Section>
      )}

      {caps.reranking && (
        <Section title="Reranking">
          <RerankingControls config={config} update={update} issues={issues} parts={caps.optimization ? "toggle" : "all"} />
        </Section>
      )}

      {caps.metadataFiltering && (
        <Section title="Filters">
          <MetadataFilters config={config} update={update} issues={issues} options={options} />
        </Section>
      )}

      {caps.optimization && (
        <Section title="Advanced retrieval">
          <RerankingControls config={config} update={update} issues={issues} parts="counts" />
          <OptimizationControls config={config} update={update} options={options} />
        </Section>
      )}
    </div>
  );
}
