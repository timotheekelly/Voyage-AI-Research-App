import type { VersionCapabilities } from "./capabilities";
import type { ConfigValidationIssue, RetrievalConfig, RetrievalStrategy } from "../types/retrieval";

export const CANDIDATE_COUNT_OPTIONS = [10, 20, 30, 50, 100] as const;
export const FINAL_COUNT_OPTIONS = [3, 5, 8, 10, 15, 20] as const;
export const RETRIEVAL_STRATEGIES: { value: RetrievalStrategy; label: string }[] = [
  { value: "vector", label: "Semantic Search" },
  { value: "text", label: "Keyword Search" },
  { value: "hybrid", label: "Hybrid Search" },
];

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  retrievalStrategy: "hybrid",
  reranking: { enabled: true, candidateCount: 30, finalResultCount: 5 },
  filters: { documentTypes: [], tags: [] },
  optimization: { diagnostics: false },
};

export function cloneDefaultConfig(): RetrievalConfig {
  return {
    retrievalStrategy: DEFAULT_RETRIEVAL_CONFIG.retrievalStrategy,
    reranking: { ...DEFAULT_RETRIEVAL_CONFIG.reranking },
    filters: { documentTypes: [], tags: [] },
    optimization: { diagnostics: false },
  };
}

/**
 * Clears values the version cannot use (reset to defaults) and keeps values it can.
 * V1→V3 keeps strategy; V4→V3 drops filters; V5→V4 drops optimization settings.
 */
export function sanitizeConfigForVersion(config: RetrievalConfig, caps: VersionCapabilities): RetrievalConfig {
  const defaults = cloneDefaultConfig();
  return {
    retrievalStrategy: caps.hybridSearch ? config.retrievalStrategy : defaults.retrievalStrategy,
    reranking: caps.reranking ? { ...config.reranking } : defaults.reranking,
    filters: caps.metadataFiltering
      ? { ...config.filters, documentTypes: [...config.filters.documentTypes], tags: [...config.filters.tags] }
      : defaults.filters,
    optimization: caps.optimization ? { ...config.optimization } : defaults.optimization,
  };
}

export function validateRetrievalConfig(config: RetrievalConfig, caps: VersionCapabilities): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  if (caps.reranking && config.reranking.enabled) {
    const { candidateCount, finalResultCount } = config.reranking;
    if (!Number.isInteger(candidateCount) || candidateCount < 1) {
      issues.push({ field: "candidateCount", message: "Candidate count must be a positive whole number." });
    }
    if (!Number.isInteger(finalResultCount) || finalResultCount < 1) {
      issues.push({ field: "finalResultCount", message: "Final result count must be a positive whole number." });
    }
    if (finalResultCount > candidateCount) {
      issues.push({ field: "finalResultCount", message: "Final result count cannot exceed candidate count." });
    }
  }
  if (caps.metadataFiltering) {
    const { yearMin, yearMax } = config.filters;
    if (yearMin !== undefined && yearMax !== undefined && yearMin > yearMax) {
      issues.push({ field: "publicationYear", message: "Minimum year cannot be later than maximum year." });
    }
  }
  return issues;
}

/** Update candidate count and clamp the final count so it can never exceed it. */
export function withCandidateCount(config: RetrievalConfig, candidateCount: number): RetrievalConfig {
  return {
    ...config,
    reranking: {
      ...config.reranking,
      candidateCount,
      finalResultCount: Math.min(config.reranking.finalResultCount, candidateCount),
    },
  };
}

export function withFinalResultCount(config: RetrievalConfig, finalResultCount: number): RetrievalConfig {
  return {
    ...config,
    reranking: {
      ...config.reranking,
      finalResultCount: Math.min(finalResultCount, config.reranking.candidateCount),
    },
  };
}

/** Parse a persisted value defensively; anything malformed falls back to defaults. */
export function parseStoredConfig(value: unknown): RetrievalConfig {
  const base = cloneDefaultConfig();
  if (typeof value !== "object" || value === null) return base;
  const v = value as Record<string, unknown>;
  const strat = v.retrievalStrategy;
  if (strat === "vector" || strat === "text" || strat === "hybrid") base.retrievalStrategy = strat;
  const r = v.reranking as Record<string, unknown> | undefined;
  if (r && typeof r === "object") {
    if (typeof r.enabled === "boolean") base.reranking.enabled = r.enabled;
    if (typeof r.candidateCount === "number" && r.candidateCount >= 1) base.reranking.candidateCount = r.candidateCount;
    if (typeof r.finalResultCount === "number" && r.finalResultCount >= 1) {
      base.reranking.finalResultCount = Math.min(r.finalResultCount, base.reranking.candidateCount);
    }
  }
  const f = v.filters as Record<string, unknown> | undefined;
  if (f && typeof f === "object") {
    if (typeof f.yearMin === "number") base.filters.yearMin = f.yearMin;
    if (typeof f.yearMax === "number") base.filters.yearMax = f.yearMax;
    if (Array.isArray(f.documentTypes)) base.filters.documentTypes = f.documentTypes.filter((x): x is string => typeof x === "string");
    if (Array.isArray(f.tags)) base.filters.tags = f.tags.filter((x): x is string => typeof x === "string");
  }
  const o = v.optimization as Record<string, unknown> | undefined;
  if (o && typeof o === "object") {
    if (typeof o.embeddingConfigId === "string") base.optimization.embeddingConfigId = o.embeddingConfigId;
    if (typeof o.quantization === "string") base.optimization.quantization = o.quantization;
    if (typeof o.diagnostics === "boolean") base.optimization.diagnostics = o.diagnostics;
  }
  return base;
}
