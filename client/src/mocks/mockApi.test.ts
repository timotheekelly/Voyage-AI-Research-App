import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendChat } from "../api/chat";
import { setTransport } from "../api/client";
import { ApiError } from "../api/errors";
import { listWorkspaces } from "../api/workspaces";
import { getRetrievalOptions } from "../api/retrieval";
import { isMockApiEnabled } from "../config/apiVersions";
import { cloneDefaultConfig } from "../config/retrievalConfig";
import { mockTransport, resetMockState } from "./mockApi";

/** Runs a call that uses the mock's artificial latency under fake timers. */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  const p = fn();
  p.catch(() => undefined); // avoid an unhandled rejection while timers advance
  await vi.advanceTimersByTimeAsync(1500);
  return p;
}

describe("mock mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMockState();
    setTransport(mockTransport);
  });
  afterEach(() => vi.useRealTimers());

  it("is only enabled by the explicit env flag", () => {
    expect(isMockApiEnabled()).toBe(false);
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    expect(isMockApiEnabled()).toBe(true);
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    expect(isMockApiEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("demonstrates version differences in workspaces and options", async () => {
    expect(await run(() => listWorkspaces("v1"))).toHaveLength(1);
    expect((await run(() => listWorkspaces("v4"))).length).toBeGreaterThan(1);
    await expect(run(() => getRetrievalOptions("v2", undefined))).rejects.toMatchObject({ type: "NOT_FOUND" });
    expect((await run(() => getRetrievalOptions("v5", undefined))).embeddingConfigs.length).toBeGreaterThan(0);
  });

  it("V1 answers without strategy or reranking notes; V3 mentions reranking", async () => {
    const config = cloneDefaultConfig();
    const v1 = await run(() => sendChat("v1", { question: "nuclear energy costs", config }));
    expect(v1.citations.length).toBeGreaterThan(0);
    expect(v1.answer).not.toMatch(/Retrieval strategy/);
    const v3 = await run(() => sendChat("v3", { question: "nuclear energy costs", config }));
    expect(v3.answer).toMatch(/Reranked 30 candidates/);
  });

  it("V4 applies metadata filters", async () => {
    const config = cloneDefaultConfig();
    config.filters = { yearMin: 2024, documentTypes: [], tags: [] };
    const res = await run(() => sendChat("v4", { question: "nuclear", workspaceId: "demo-energy", config }));
    expect(res.citations.length).toBeGreaterThan(0);
    // only demo-doc-1 (2024) and demo-doc-3 (2025) are published in or after 2024 in this workspace
    for (const c of res.citations) expect(["demo-doc-1", "demo-doc-3"]).toContain(c.documentId);

    config.filters = { yearMin: 2100, documentTypes: [], tags: [] };
    const none = await run(() => sendChat("v4", { question: "nuclear", workspaceId: "demo-energy", config }));
    expect(none.citations).toEqual([]);
  });

  it("V5 returns diagnostics only when requested, and omits metrics it does not have", async () => {
    const config = cloneDefaultConfig();
    const without = await run(() => sendChat("v5", { question: "nuclear", workspaceId: "demo-energy", config }));
    expect(without.diagnostics).toBeUndefined();
    config.optimization.diagnostics = true;
    const withDiag = await run(() => sendChat("v5", { question: "nuclear", workspaceId: "demo-energy", config }));
    expect(withDiag.diagnostics?.totalLatencyMs).toBeDefined();
    expect(withDiag.diagnostics?.mrr).toBeUndefined(); // needs relevance labels: never reported for a chat answer
    expect(withDiag.diagnostics?.rerankingLatencyMs).toBeUndefined(); // not separately measurable
  });

  it("does not leak conversations across versions", async () => {
    await run(() => sendChat("v1", { question: "hello world", config: cloneDefaultConfig() }));
    const { listConversations } = await import("../api/conversations");
    expect(await run(() => listConversations("v1", undefined))).toHaveLength(1);
    expect(await run(() => listConversations("v2", undefined))).toHaveLength(0);
  });
});

describe("without mock mode", () => {
  it("uses real HTTP and never falls back to mock data when the backend fails", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchSpy);
    const err = await listWorkspaces("v1").catch((e: unknown) => e);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("http://localhost:8080/api/v1/workspaces");
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).type).toBe("NETWORK_ERROR");
    vi.unstubAllGlobals();
  });
});
