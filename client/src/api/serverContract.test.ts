import { describe, expect, it } from "vitest";
import { setTransport } from "./client";
import { listDocuments } from "./documents";
import { listWorkspaces } from "./workspaces";
import { getRetrievalOptions } from "./retrieval";
import { sendChat } from "./chat";
import { getConversation } from "./conversations";
import { cloneDefaultConfig } from "../config/retrievalConfig";
import { ApiError } from "./errors";

/**
 * Fixtures below are real responses captured from the Spring Boot backend (server/), so these tests fail if the
 * client's wire-format guards or mappers drift from the actual API.
 */
const workspaces = [
  { id: "workspace-001", name: "Nuclear Energy Research", description: "Academic research into nuclear power", ownerId: "user-001", memberIds: ["user-001"], createdAt: "2026-11-12T16:32:39.231Z" },
];
const document = {
  id: "document-7457631a", workspaceId: "workspace-001", title: "notes", filename: "notes.md", contentType: "text/markdown",
  author: "A. Researcher", publicationYear: 2024, documentType: "academic-paper", tags: ["energy", "nuclear"],
  processingStatus: "PROCESSING", sizeBytes: 16243, pageCount: 1, chunkCount: 14, uploadedAt: "2026-11-12T16:32:39.840Z",
};

function respond(routes: Record<string, unknown>) {
  setTransport(async (req) => {
    const body = routes[`${req.method} ${req.path}`];
    return body === undefined ? { status: 404, body: undefined } : { status: 200, body };
  });
}

describe("client ↔ server wire contract", () => {
  it("maps workspaces and documents", async () => {
    respond({ "GET /api/v3/workspaces": workspaces, "GET /api/v3/documents": [document] });
    expect(await listWorkspaces("v3")).toEqual([{ id: "workspace-001", name: "Nuclear Energy Research", description: "Academic research into nuclear power" }]);
    const [doc] = await listDocuments("v3", "workspace-001");
    expect(doc).toMatchObject({
      id: "document-7457631a", status: "processing", fileName: "notes.md", pageCount: 1,
      metadata: { author: "A. Researcher", publicationYear: 2024, documentType: "academic-paper", tags: ["energy", "nuclear"] },
    });
  });

  it("maps a chat answer: citation title, no message id from the server, diagnostics subset", async () => {
    respond({
      "POST /api/v5/chat": {
        conversationId: "conversation-1", answer: "Finding [1].",
        citations: [{ documentId: "d1", chunkId: "d1-chunk-2", title: "Doc One", pageNumber: 7, passage: "Passage.", score: 0.91 }],
        retrieval: { strategy: "hybrid", rerankingEnabled: true, candidateCount: 12, finalResultCount: 5 },
        diagnostics: { retrievalLatencyMs: 120, generationLatencyMs: 900, totalLatencyMs: 1050, candidateCount: 12, finalPassageCount: 5, strategy: "hybrid" },
      },
    });
    const res = await sendChat("v5", { question: "q", workspaceId: "w", config: cloneDefaultConfig() });
    expect(res.citations[0]).toMatchObject({ documentTitle: "Doc One", chunkId: "d1-chunk-2", pageNumber: 7 });
    expect(res.messageId).toBeTruthy();
    expect(res.diagnostics).toMatchObject({ retrievalLatencyMs: 120, totalLatencyMs: 1050 });
    expect(res.diagnostics?.rerankingLatencyMs).toBeUndefined(); // the server never invents it
    expect(res.diagnostics?.mrr).toBeUndefined();
  });

  it("maps stored conversations (uppercase roles)", async () => {
    respond({
      "GET /api/v1/conversations/c1": {
        id: "c1", workspaceId: "w", title: "T", createdAt: "2026-11-12T10:00:00Z", updatedAt: "2026-11-12T10:01:00Z",
        messages: [
          { id: "m1", role: "USER", content: "Q", createdAt: "2026-11-12T10:00:00Z" },
          { id: "m2", role: "ASSISTANT", content: "A [1]", citations: [{ documentId: "d", chunkId: "c", title: "Doc", passage: "p" }], createdAt: "2026-11-12T10:00:01Z" },
        ],
      },
    });
    const conv = await getConversation("v1", "c1");
    expect(conv.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(conv.messages[1]?.citations?.[0]?.documentTitle).toBe("Doc");
  });

  it("combines filter options (V4+) with the configuration registry (V5)", async () => {
    respond({
      "GET /api/v5/retrieval/options": { documentTypes: ["academic-paper"], tags: ["energy"] },
      "GET /api/v5/retrieval/configurations": [
        { id: "default", label: "voyage-4, full precision", embeddingModel: "voyage-4", quantization: "none", requiresReindex: false, requiresReembedding: false, available: true },
        { id: "x", label: "Other", quantization: "scalar", requiresReembedding: true, available: false, unavailableReason: "no index" },
      ],
    });
    const v5 = await getRetrievalOptions("v5", undefined);
    expect(v5.documentTypes).toEqual(["academic-paper"]);
    expect(v5.embeddingConfigs.map((c) => [c.id, c.available])).toEqual([["default", true], ["x", false]]);
    expect(v5.quantizations.map((q) => q.id)).toEqual(["none", "scalar"]);
    respond({ "GET /api/v4/retrieval/options": { documentTypes: [], tags: [] } });
    expect((await getRetrievalOptions("v4", undefined)).embeddingConfigs).toEqual([]); // no configurations call before V5
  });

  it("surfaces the server's structured 503 as a service error without inventing an answer", async () => {
    setTransport(async () => ({
      status: 503,
      body: { timestamp: "t", status: 503, error: "ATLAS_SEARCH_UNAVAILABLE", message: "Atlas Search / Vector Search is not available on this deployment.", path: "/api/v1/chat" },
    }));
    const err = await sendChat("v1", { question: "q", config: cloneDefaultConfig() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).type).toBe("SERVER_ERROR");
  });
});
