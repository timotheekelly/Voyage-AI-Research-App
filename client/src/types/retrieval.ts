export type RetrievalStrategy = "vector" | "text" | "hybrid";

export interface RerankingConfig {
  enabled: boolean;
  candidateCount: number;
  finalResultCount: number;
}

export interface FilterConfig {
  yearMin?: number;
  yearMax?: number;
  documentTypes: string[];
  tags: string[];
}

export interface OptimizationConfig {
  embeddingConfigId?: string;
  quantization?: string;
  diagnostics: boolean;
}

/** UI-side retrieval configuration. A superset of every version; the request builder picks what applies. */
export interface RetrievalConfig {
  retrievalStrategy: RetrievalStrategy;
  reranking: RerankingConfig;
  filters: FilterConfig;
  optimization: OptimizationConfig;
}

export interface EmbeddingConfigOption {
  id: string;
  label: string;
  model?: string;
  dimensions?: number;
  quantization?: string;
  available?: boolean;
  unavailableReason?: string;
  requiresReembedding?: boolean;
  requiresReindex?: boolean;
}

export interface QuantizationOption {
  id: string;
  label: string;
}

/** Options supplied by the backend. Nothing here is hardcoded in the frontend. */
export interface RetrievalOptions {
  documentTypes: string[];
  tags: string[];
  embeddingConfigs: EmbeddingConfigOption[];
  quantizations: QuantizationOption[];
}

export interface RetrievalDiagnostics {
  retrievalLatencyMs?: number;
  rerankingLatencyMs?: number;
  generationLatencyMs?: number;
  totalLatencyMs?: number;
  candidateCount?: number;
  finalPassageCount?: number;
  recallAtK?: number;
  recallK?: number;
  mrr?: number;
  estimatedCostUsd?: number;
}

export interface ConfigValidationIssue {
  field: string;
  message: string;
}
