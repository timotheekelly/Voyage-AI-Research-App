import type { Transport, TransportRequest, TransportResponse } from "../api/client";
import { createCancellation } from "../api/errors";
import type { ServerChatResponse, ServerCitation, ServerConversation, ServerDocument } from "../api/guards";
import { API_VERSIONS, VERSION_CAPABILITIES, type ApiVersion } from "../config/capabilities";
import type { ChatRequestPayload } from "../types/chat";
import type { DocumentRecord } from "../types/document";
import type { RetrievalDiagnostics } from "../types/retrieval";
import { MOCK_CHUNKS, MOCK_CONFIGURATIONS, MOCK_DOCUMENTS, MOCK_FILTER_OPTIONS, MOCK_WORKSPACES } from "./mockData";

/**
 * Development-only mock transport. It lives outside the production API modules and is installed explicitly by
 * main.tsx when VITE_USE_MOCK_API=true. Responses use the same wire format as the real backend. State is kept
 * per API version on purpose: nothing created under one version exists under another.
 */

interface VersionState {
  documents: DocumentRecord[];
  conversations: ServerConversation[];
}
const state = new Map<ApiVersion, VersionState>();
function stateFor(v: ApiVersion): VersionState {
  let s = state.get(v);
  if (!s) {
    s = { documents: structuredClone(MOCK_DOCUMENTS), conversations: [] };
    state.set(v, s);
  }
  return s;
}

export function resetMockState(): void {
  state.clear();
}

const json = (status: number, body?: unknown): TransportResponse => ({ status, body });

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(createCancellation());
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(createCancellation());
      },
      { once: true },
    );
  });
}

function visibleWorkspaces(version: ApiVersion) {
  // Multi-tenant workspaces only exist from V4.
  return VERSION_CAPABILITIES[version].metadataFiltering ? MOCK_WORKSPACES : MOCK_WORKSPACES.slice(0, 1);
}

function toServerDocument(d: DocumentRecord): ServerDocument {
  return {
    id: d.id,
    workspaceId: d.workspaceId,
    title: d.title,
    filename: d.fileName,
    author: d.metadata?.author,
    publicationYear: d.metadata?.publicationYear,
    documentType: d.metadata?.documentType,
    tags: d.metadata?.tags,
    processingStatus: d.status.toUpperCase(),
    failureReason: d.failureReason,
    sizeBytes: d.sizeBytes,
    pageCount: d.pageCount,
    uploadedAt: d.uploadedAt,
  };
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
}

function matchesFilters(doc: DocumentRecord, filters: ChatRequestPayload["filters"]): boolean {
  if (!filters) return true;
  const m = doc.metadata;
  const year = m?.publicationYear;
  const { min, max } = filters.publicationYear ?? {};
  if (min !== undefined && (year === undefined || year < min)) return false;
  if (max !== undefined && (year === undefined || year > max)) return false;
  if (filters.documentTypes?.length && (!m?.documentType || !filters.documentTypes.includes(m.documentType))) return false;
  if (filters.tags?.length && !filters.tags.some((t) => m?.tags?.includes(t))) return false;
  return true;
}

function handleChat(version: ApiVersion, payload: ChatRequestPayload): ServerChatResponse {
  const caps = VERSION_CAPABILITIES[version];
  const s = stateFor(version);
  const workspaceId = payload.workspaceId ?? visibleWorkspaces(version)[0]?.id;

  const eligible = s.documents.filter(
    (d) => d.status === "ready" && (!caps.metadataFiltering || d.workspaceId === workspaceId) && matchesFilters(d, caps.metadataFiltering ? payload.filters : undefined),
  );
  const eligibleIds = new Set(eligible.map((d) => d.id));
  const q = tokens(payload.question);
  const strategy = caps.hybridSearch ? (payload.retrievalStrategy ?? "hybrid") : "vector";
  const rerankOn = caps.reranking && payload.reranking?.enabled === true;
  const candidateCount = rerankOn ? (payload.reranking?.candidateCount ?? 30) : 30;
  const finalCount = rerankOn ? (payload.reranking?.finalResultCount ?? 5) : 3;

  const scored = MOCK_CHUNKS.filter((c) => eligibleIds.has(c.documentId)).map((c, i) => {
    const lexical = q.filter((w) => c.passage.toLowerCase().includes(w)).length;
    const semantic = 1 / (i + 1);
    const score = strategy === "text" ? lexical : strategy === "vector" ? semantic : lexical + semantic;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored.slice(0, Math.min(finalCount, 4)).map((x) => x.c);

  const citations: ServerCitation[] = chosen.map((c) => ({
    documentId: c.documentId,
    chunkId: c.chunkId,
    title: s.documents.find((d) => d.id === c.documentId)?.title ?? "Untitled",
    pageNumber: c.pageNumber,
    passage: c.passage,
  }));

  let answer: string;
  if (citations.length === 0) {
    answer = "I couldn't find anything in the documents available to you that answers this question, so I can't answer it reliably.\n\n_Demo response._";
  } else {
    const bullets = citations.map((c, i) => `- ${c.passage.split(". ")[0]?.replace(/\.$/, "")}. [${i + 1}]`).join("\n");
    const notes = [
      caps.hybridSearch ? `Retrieval strategy: **${strategy}**.` : undefined,
      rerankOn ? `Reranked ${candidateCount} candidates down to ${citations.length} passages.` : undefined,
      caps.metadataFiltering && payload.filters ? "Metadata filters were applied before retrieval." : undefined,
    ].filter(Boolean);
    answer = [
      `## Summary`,
      `Across the retrieved sources, the main points relevant to your question are:`,
      bullets,
      `| Source | Page |\n| --- | --- |\n${citations.map((c, i) => `| [${i + 1}] ${c.title} | ${c.pageNumber ?? "–"} |`).join("\n")}`,
      notes.join(" "),
      `_Demo response generated from sample data, not from a real backend._`,
    ].join("\n\n");
  }

  let diagnostics: RetrievalDiagnostics | undefined;
  if (caps.diagnostics && payload.optimization?.diagnosticsEnabled) {
    // Only values a real backend could measure; reranking latency, recall and MRR are intentionally absent.
    diagnostics = {
      retrievalLatencyMs: 142,
      generationLatencyMs: 1190,
      totalLatencyMs: 1380,
      candidateCount: scored.length,
      finalPassageCount: citations.length,
    };
  }

  const now = new Date().toISOString();
  let conv = s.conversations.find((c) => c.id === payload.conversationId);
  if (!conv) {
    conv = {
      id: `demo-conv-${s.conversations.length + 1}-${Date.now()}`,
      title: payload.question.slice(0, 60),
      updatedAt: now,
      createdAt: now,
      workspaceId,
      messages: [],
    };
    s.conversations.unshift(conv);
  }
  const messageId = `demo-msg-${Date.now()}`;
  conv.updatedAt = now;
  conv.messages.push(
    { id: `${messageId}-q`, role: "USER", content: payload.question },
    { id: messageId, role: "ASSISTANT", content: answer, citations },
  );
  return { conversationId: conv.id, answer, citations, diagnostics };
}

async function route(req: TransportRequest): Promise<TransportResponse> {
  const version = req.version;
  // Unversioned routes (health check).
  if (!version) return json(200, { status: "ok", mode: "demo" });

  const sub = req.path.replace(`/api/${version}`, "");
  const [resource, id] = sub.split("/").filter(Boolean);
  const s = stateFor(version);
  const caps = VERSION_CAPABILITIES[version];
  const wsId = req.query?.workspaceId ? String(req.query.workspaceId) : undefined;

  switch (resource) {
    case "workspaces":
      return req.method === "GET" ? json(200, visibleWorkspaces(version)) : json(405);

    case "retrieval":
      // Filter options are V4+, the configuration registry is V5; earlier versions have no such routes.
      if (id === "options" && caps.metadataFiltering) return json(200, MOCK_FILTER_OPTIONS);
      if (id === "configurations" && caps.optimization) return json(200, MOCK_CONFIGURATIONS);
      return json(404);

    case "documents": {
      if (!id) {
        if (req.method === "GET") {
          const docs = s.documents.filter((d) => !wsId || !caps.metadataFiltering || d.workspaceId === wsId);
          return json(200, docs.map(toServerDocument));
        }
        if (req.method === "POST") {
          const file = req.formData?.get("file");
          if (!(file instanceof File)) return json(400);
          const doc: DocumentRecord = {
            id: `demo-doc-up-${Date.now()}`,
            title: file.name.replace(/\.[^.]+$/, ""),
            status: "processing",
            workspaceId: (req.formData?.get("workspaceId") as string | null) ?? undefined,
            fileName: file.name,
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
          };
          s.documents.unshift(doc);
          return json(201, toServerDocument(doc));
        }
        return json(405);
      }
      const doc = s.documents.find((d) => d.id === id);
      if (!doc) return json(404);
      if (req.method === "GET") return json(200, toServerDocument(doc));
      if (req.method === "DELETE") {
        s.documents = s.documents.filter((d) => d.id !== id);
        return json(204);
      }
      return json(405);
    }

    case "conversations": {
      if (!id) {
        if (req.method !== "GET") return json(405);
        return json(200, s.conversations.map(({ messages: _m, ...summary }) => summary));
      }
      const conv = s.conversations.find((c) => c.id === id);
      if (!conv) return json(404);
      if (req.method === "GET") return json(200, conv);
      if (req.method === "DELETE") {
        s.conversations = s.conversations.filter((c) => c.id !== id);
        return json(204);
      }
      return json(405);
    }

    case "chat": {
      if (req.method !== "POST") return json(405);
      const body = req.body as ChatRequestPayload | undefined;
      if (!body || typeof body.question !== "string" || !body.question.trim()) return json(400);
      return json(200, handleChat(version, body));
    }

    default:
      return json(404);
  }
}

export const mockTransport: Transport = async (req) => {
  await delay(350 + Math.random() * 400, req.signal);
  return route(req);
};

export const MOCK_VERSIONS = API_VERSIONS;
