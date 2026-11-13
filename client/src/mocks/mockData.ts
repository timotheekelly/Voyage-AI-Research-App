import type { DocumentRecord } from "../types/document";
import type { ServerConfiguration } from "../api/guards";
import type { Workspace } from "../types/workspace";

/** Clearly fictional sample data for Demo Mode. Never served unless VITE_USE_MOCK_API=true. */

export const MOCK_WORKSPACES: Workspace[] = [
  { id: "demo-energy", name: "Energy Policy (Demo)", description: "Sample energy research library", documentCount: 4 },
  { id: "demo-climate", name: "Climate Science (Demo)", description: "Sample climate research library", documentCount: 2 },
  { id: "demo-clinical", name: "Clinical Studies (Demo)", description: "Sample clinical library", documentCount: 1 },
];

export const MOCK_DOCUMENTS: DocumentRecord[] = [
  {
    id: "demo-doc-1",
    title: "Sample Paper: Small Modular Reactors and Grid Flexibility",
    status: "ready",
    workspaceId: "demo-energy",
    fileName: "smr-grid-flexibility.pdf",
    sizeBytes: 2_400_000,
    pageCount: 28,
    uploadedAt: "2026-03-02T10:00:00Z",
    metadata: { author: "A. Researcher", publicationYear: 2024, publicationDate: "2024-06-14", documentType: "academic-paper", tags: ["nuclear", "energy"] },
  },
  {
    id: "demo-doc-2",
    title: "Sample Report: Nuclear Energy Cost Trajectories",
    status: "ready",
    workspaceId: "demo-energy",
    fileName: "nuclear-cost-trajectories.pdf",
    sizeBytes: 1_100_000,
    pageCount: 54,
    uploadedAt: "2026-03-05T14:20:00Z",
    metadata: { author: "B. Analyst", publicationYear: 2021, publicationDate: "2021-11-03", documentType: "report", tags: ["nuclear", "energy", "economics"] },
  },
  {
    id: "demo-doc-3",
    title: "Sample Brief: Long-Duration Storage Policy Options",
    status: "ready",
    workspaceId: "demo-energy",
    fileName: "storage-policy-brief.pdf",
    sizeBytes: 640_000,
    pageCount: 12,
    uploadedAt: "2026-03-11T09:45:00Z",
    metadata: { author: "C. Policy", publicationYear: 2025, publicationDate: "2025-02-20", documentType: "policy-brief", tags: ["energy", "storage"] },
  },
  {
    id: "demo-doc-4",
    title: "Sample Paper: Capacity Factors Across Reactor Fleets",
    status: "processing",
    workspaceId: "demo-energy",
    fileName: "capacity-factors.pdf",
    sizeBytes: 1_800_000,
    uploadedAt: "2026-03-12T16:05:00Z",
    metadata: { author: "D. Engineer", publicationYear: 2019, documentType: "academic-paper", tags: ["nuclear"] },
  },
  {
    id: "demo-doc-5",
    title: "Sample Paper: Regional Warming Attribution Methods",
    status: "ready",
    workspaceId: "demo-climate",
    fileName: "warming-attribution.pdf",
    sizeBytes: 3_100_000,
    pageCount: 40,
    uploadedAt: "2026-02-18T08:00:00Z",
    metadata: { author: "E. Climatologist", publicationYear: 2023, documentType: "academic-paper", tags: ["climate"] },
  },
  {
    id: "demo-doc-6",
    title: "Sample Dataset Note: Ocean Heat Content",
    status: "failed",
    workspaceId: "demo-climate",
    fileName: "ocean-heat.docx",
    uploadedAt: "2026-02-19T11:30:00Z",
    failureReason: "Text extraction failed (demo).",
    metadata: { documentType: "report", tags: ["climate"] },
  },
  {
    id: "demo-doc-7",
    title: "Sample Trial: Dosage Response in Adults",
    status: "ready",
    workspaceId: "demo-clinical",
    fileName: "dosage-response.pdf",
    sizeBytes: 900_000,
    pageCount: 18,
    uploadedAt: "2026-01-22T13:10:00Z",
    metadata: { author: "F. Clinician", publicationYear: 2022, documentType: "academic-paper", tags: ["clinical"] },
  },
];

export interface MockChunk {
  documentId: string;
  chunkId: string;
  pageNumber: number;
  passage: string;
}

export const MOCK_CHUNKS: MockChunk[] = [
  { documentId: "demo-doc-1", chunkId: "demo-doc-1-c4", pageNumber: 7, passage: "Small modular reactors can ramp output between 40% and 100% within an hour, which the authors argue makes them compatible with grids that have a high share of variable renewable generation." },
  { documentId: "demo-doc-1", chunkId: "demo-doc-1-c11", pageNumber: 19, passage: "In the simulated scenarios, flexible nuclear dispatch reduced curtailment of wind and solar but increased per-megawatt-hour costs relative to baseload operation." },
  { documentId: "demo-doc-2", chunkId: "demo-doc-2-c2", pageNumber: 12, passage: "Historical construction costs for nuclear energy projects vary widely by region; the report attributes most variance to project management and regulatory timelines rather than reactor design." },
  { documentId: "demo-doc-2", chunkId: "demo-doc-2-c9", pageNumber: 33, passage: "Under the optimistic scenario, overnight capital costs decline by roughly one third by 2035, contingent on standardized designs and serial deployment." },
  { documentId: "demo-doc-3", chunkId: "demo-doc-3-c1", pageNumber: 3, passage: "The brief compares capacity payments, long-term procurement mandates, and tax credits as options for supporting long-duration storage, noting that no single instrument addresses all market failures." },
  { documentId: "demo-doc-5", chunkId: "demo-doc-5-c6", pageNumber: 22, passage: "Optimal-fingerprinting approaches attribute most observed regional warming since 1950 to greenhouse gas forcing, with wider uncertainty at sub-continental scales." },
  { documentId: "demo-doc-7", chunkId: "demo-doc-7-c3", pageNumber: 9, passage: "A dose-dependent response was observed up to 40 mg; higher doses showed no additional benefit and a modest increase in adverse events." },
];

/** Filter values for GET /retrieval/options (V4+). */
export const MOCK_FILTER_OPTIONS = {
  documentTypes: ["academic-paper", "report", "policy-brief"],
  tags: ["energy", "nuclear", "storage", "economics", "climate", "clinical"],
};

/** Server-shaped configurations for GET /retrieval/configurations (V5). */
export const MOCK_CONFIGURATIONS: ServerConfiguration[] = [
  { id: "default", label: "Demo embedding A, full precision", embeddingModel: "demo-model-a", quantization: "none", requiresReindex: false, requiresReembedding: false, available: true },
  { id: "demo-large", label: "Demo embedding B, scalar", embeddingModel: "demo-model-b", quantization: "scalar", requiresReindex: true, requiresReembedding: true, available: true },
  { id: "demo-binary", label: "Demo embedding B, binary", embeddingModel: "demo-model-b", quantization: "binary", requiresReindex: true, requiresReembedding: true, available: false, unavailableReason: "The index has not been created (demo)." },
];
