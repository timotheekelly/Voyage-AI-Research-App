import type { ApiVersion } from "./capabilities";

export interface ApiVersionInfo {
  id: ApiVersion;
  label: string;
  name: string;
  capability: string;
  description: string;
}

export const DEFAULT_API_VERSION: ApiVersion = "v1";

export const API_VERSION_INFO: readonly ApiVersionInfo[] = [
  {
    id: "v1",
    label: "V1",
    name: "Foundations",
    capability: "Automated embeddings and cited answers",
    description: "Ask questions about your documents and get answers with source citations.",
  },
  {
    id: "v2",
    label: "V2",
    name: "Hybrid Search",
    capability: "Vector, lexical, and hybrid retrieval",
    description: "Choose between semantic, keyword, or hybrid retrieval for each question.",
  },
  {
    id: "v3",
    label: "V3",
    name: "Reranking",
    capability: "Native Voyage reranking",
    description: "Retrieve a wider candidate set, then rerank to the most relevant passages.",
  },
  {
    id: "v4",
    label: "V4",
    name: "Multi-Tenant Retrieval",
    capability: "Workspace and metadata filtering",
    description: "Scope retrieval to a workspace and filter by year, document type, and tags.",
  },
  {
    id: "v5",
    label: "V5",
    name: "Optimization",
    capability: "Retrieval quality, cost, and latency",
    description: "Tune embeddings and quantization, and inspect retrieval diagnostics.",
  },
];

export function getVersionInfo(version: ApiVersion): ApiVersionInfo {
  const info = API_VERSION_INFO.find((v) => v.id === version);
  if (!info) throw new Error(`Unknown API version: ${version}`);
  return info;
}

/** Path prefix for a version, e.g. `/api/v3`. */
export function apiPrefix(version: ApiVersion): string {
  return `/api/${version}`;
}

/** The routes the frontend expects, per version. Used by Settings and the README. */
export function expectedEndpoints(version: ApiVersion): { method: string; path: string; purpose: string }[] {
  const p = apiPrefix(version);
  return [
    { method: "POST", path: `${p}/chat`, purpose: "Ask a question" },
    { method: "GET", path: `${p}/conversations`, purpose: "List conversations" },
    { method: "GET", path: `${p}/conversations/:id`, purpose: "Load a conversation" },
    { method: "DELETE", path: `${p}/conversations/:id`, purpose: "Delete a conversation" },
    { method: "GET", path: `${p}/documents`, purpose: "List documents" },
    { method: "POST", path: `${p}/documents`, purpose: "Upload a document (multipart)" },
    { method: "GET", path: `${p}/documents/:id`, purpose: "Document details" },
    { method: "DELETE", path: `${p}/documents/:id`, purpose: "Delete a document" },
    { method: "GET", path: `${p}/workspaces`, purpose: "List workspaces" },
    { method: "GET", path: `${p}/retrieval/options`, purpose: "Filter and model options (V4+)" },
  ];
}

export function isMockApiEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCK_API === "true";
}

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
}

export function getHealthPath(): string | null {
  const p = import.meta.env.VITE_HEALTH_PATH?.trim();
  return p ? (p.startsWith("/") ? p : `/${p}`) : null;
}
