export type ApiVersion = "v1" | "v2" | "v3" | "v4" | "v5";

export interface VersionCapabilities {
  hybridSearch: boolean;
  reranking: boolean;
  metadataFiltering: boolean;
  optimization: boolean;
  diagnostics: boolean;
}

export const VERSION_CAPABILITIES: Record<ApiVersion, VersionCapabilities> = {
  v1: { hybridSearch: false, reranking: false, metadataFiltering: false, optimization: false, diagnostics: false },
  v2: { hybridSearch: true, reranking: false, metadataFiltering: false, optimization: false, diagnostics: false },
  v3: { hybridSearch: true, reranking: true, metadataFiltering: false, optimization: false, diagnostics: false },
  v4: { hybridSearch: true, reranking: true, metadataFiltering: true, optimization: false, diagnostics: false },
  v5: { hybridSearch: true, reranking: true, metadataFiltering: true, optimization: true, diagnostics: true },
};

export const API_VERSIONS: readonly ApiVersion[] = ["v1", "v2", "v3", "v4", "v5"];

export function isApiVersion(value: unknown): value is ApiVersion {
  return typeof value === "string" && (API_VERSIONS as readonly string[]).includes(value);
}

/** True if the version exposes any retrieval control beyond the plain question input. */
export function hasRetrievalControls(caps: VersionCapabilities): boolean {
  return Object.values(caps).some(Boolean);
}
