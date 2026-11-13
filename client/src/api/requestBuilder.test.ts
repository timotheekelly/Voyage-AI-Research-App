import { describe, expect, it } from "vitest";
import { API_VERSIONS } from "../config/capabilities";
import { cloneDefaultConfig } from "../config/retrievalConfig";
import type { RetrievalConfig } from "../types/retrieval";
import { buildChatPayload } from "./requestBuilder";

function fullConfig(): RetrievalConfig {
  return {
    retrievalStrategy: "text",
    reranking: { enabled: true, candidateCount: 30, finalResultCount: 5 },
    filters: { yearMin: 2020, yearMax: 2026, documentTypes: ["academic-paper"], tags: ["energy"] },
    optimization: { embeddingConfigId: "emb-1", quantization: "int8", diagnostics: true },
  };
}

describe("buildChatPayload", () => {
  const base = { question: "What are the main findings?", workspaceId: "workspace-001" };

  it("V1 sends only question and workspace, even when other settings are populated", () => {
    expect(buildChatPayload("v1", { ...base, config: fullConfig() })).toEqual({
      question: "What are the main findings?",
      workspaceId: "workspace-001",
    });
  });

  it("V2 adds the retrieval strategy", () => {
    expect(buildChatPayload("v2", { ...base, config: fullConfig() })).toEqual({
      ...base,
      retrievalStrategy: "text",
    });
  });

  it("V3 adds reranking and nothing else", () => {
    const p = buildChatPayload("v3", { ...base, config: fullConfig() });
    expect(p).toEqual({
      ...base,
      retrievalStrategy: "text",
      reranking: { enabled: true, candidateCount: 30, finalResultCount: 5 },
    });
    expect(p).not.toHaveProperty("filters");
    expect(p).not.toHaveProperty("optimization");
  });

  it("V3 sends only { enabled: false } when reranking is off", () => {
    const config = fullConfig();
    config.reranking.enabled = false;
    expect(buildChatPayload("v3", { ...base, config }).reranking).toEqual({ enabled: false });
  });

  it("V4 adds metadata filters matching the documented shape", () => {
    expect(buildChatPayload("v4", { ...base, config: fullConfig() })).toEqual({
      ...base,
      retrievalStrategy: "text",
      reranking: { enabled: true, candidateCount: 30, finalResultCount: 5 },
      filters: { publicationYear: { min: 2020, max: 2026 }, documentTypes: ["academic-paper"], tags: ["energy"] },
    });
  });

  it("omits empty filters entirely", () => {
    expect(buildChatPayload("v4", { ...base, config: cloneDefaultConfig() })).not.toHaveProperty("filters");
  });

  it("V5 adds optimization and diagnostics", () => {
    expect(buildChatPayload("v5", { ...base, config: fullConfig() }).optimization).toEqual({
      embeddingConfiguration: "emb-1",
      quantization: "int8",
      diagnosticsEnabled: true,
    });
  });

  it("includes conversationId only when continuing a conversation", () => {
    expect(buildChatPayload("v1", { ...base, config: cloneDefaultConfig() })).not.toHaveProperty("conversationId");
    expect(buildChatPayload("v1", { ...base, conversationId: "c1", config: cloneDefaultConfig() }).conversationId).toBe("c1");
  });

  it("never includes a field the version does not support", () => {
    const forbidden: Record<string, string[]> = {
      v1: ["retrievalStrategy", "reranking", "filters", "optimization"],
      v2: ["reranking", "filters", "optimization"],
      v3: ["filters", "optimization"],
      v4: ["optimization"],
      v5: [],
    };
    for (const v of API_VERSIONS) {
      const payload = buildChatPayload(v, { ...base, config: fullConfig() });
      for (const key of forbidden[v] ?? []) expect(payload).not.toHaveProperty(key);
    }
  });
});
