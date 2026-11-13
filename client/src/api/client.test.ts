import { describe, expect, it, vi } from "vitest";
import { API_VERSIONS } from "../config/capabilities";
import { apiClient, checkHealth, invalidateOutstandingRequests, request, setTransport, subscribeToActivity } from "./client";
import { ApiError, ERROR_MESSAGES, isCancellation } from "./errors";
import { isServerChatResponse, isServerWorkspaceList, isVoid } from "./guards";
import { sendChat } from "./chat";
import { cloneDefaultConfig } from "../config/retrievalConfig";

const okChat = {
  conversationId: "c1",
  answer: "Hello [1]",
  citations: [{ documentId: "d1", title: "T", chunkId: "k1", passage: "p", pageNumber: 2 }],
};

async function expectApiError(promise: Promise<unknown>, type: string, status?: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).type).toBe(type);
  if (status !== undefined) expect((err as ApiError).status).toBe(status);
  expect((err as ApiError).message).toBe(ERROR_MESSAGES[type as keyof typeof ERROR_MESSAGES]);
}

describe("endpoint routing", () => {
  it.each(API_VERSIONS)("routes chat to /api/%s/chat", async (version) => {
    const urls: string[] = [];
    setTransport(async (req) => {
      urls.push(req.url);
      return { status: 200, body: okChat };
    });
    await sendChat(version, { question: "q", config: cloneDefaultConfig() });
    expect(urls).toEqual([`http://localhost:8080/api/${version}/chat`]);
  });

  it("serializes query params and skips undefined ones", async () => {
    let url = "";
    setTransport(async (req) => {
      url = req.url;
      return { status: 200, body: [] };
    });
    await apiClient.get("v4", "/workspaces", isServerWorkspaceList, { query: { a: "1", b: undefined } });
    expect(url).toBe("http://localhost:8080/api/v4/workspaces?a=1");
  });
});

describe("error mapping", () => {
  it("maps a failed fetch to NETWORK_ERROR when using the real fetch transport", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expectApiError(apiClient.get("v1", "/workspaces", isServerWorkspaceList), "NETWORK_ERROR");
    vi.unstubAllGlobals();
  });

  it.each([
    [404, "NOT_FOUND"],
    [405, "METHOD_NOT_ALLOWED"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [500, "SERVER_ERROR"],
    [503, "SERVER_ERROR"],
    [418, "UNKNOWN"],
  ])("maps HTTP %i to %s", async (status, type) => {
    setTransport(async () => ({ status, body: { detail: "internal stack trace" } }));
    await expectApiError(apiClient.get("v1", "/workspaces", isServerWorkspaceList), type, status);
  });

  it("does not leak server error details into the message", async () => {
    setTransport(async () => ({ status: 500, body: { detail: "NullPointerException at Foo.java:12" } }));
    const err = await apiClient.get("v1", "/workspaces", isServerWorkspaceList).catch((e: unknown) => e);
    expect((err as ApiError).message).not.toContain("NullPointer");
  });

  it("rejects responses that fail validation with INVALID_RESPONSE", async () => {
    setTransport(async () => ({ status: 200, body: { answer: 42 } }));
    await expectApiError(request({ path: "/chat", version: "v1", method: "POST", body: {} }, isServerChatResponse), "INVALID_RESPONSE");
  });

  it("rejects non-JSON 2xx bodies with INVALID_RESPONSE (real fetch path)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 200 })));
    await expectApiError(apiClient.get("v1", "/workspaces", isServerWorkspaceList), "INVALID_RESPONSE");
    vi.unstubAllGlobals();
  });

  it("rejects a citation list containing a malformed citation", async () => {
    setTransport(async () => ({ status: 200, body: { ...okChat, citations: [{ documentId: "d1" }] } }));
    await expectApiError(sendChat("v1", { question: "q", config: cloneDefaultConfig() }), "INVALID_RESPONSE");
  });

  it("treats an empty 204 as success for DELETE", async () => {
    setTransport(async () => ({ status: 204, body: undefined }));
    await expect(apiClient.delete("v1", "/documents/1")).resolves.toBeUndefined();
  });

  it("allows validators that accept anything", () => {
    expect(isVoid(1)).toBe(true);
  });
});

describe("cancellation and timeouts", () => {
  const hang = (req: { signal: AbortSignal }) =>
    new Promise<never>((_, reject) => {
      req.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });

  it("reports a timeout as TIMEOUT", async () => {
    setTransport(hang);
    await expectApiError(request({ path: "/x", version: "v1", timeoutMs: 20 }, isVoid), "TIMEOUT");
  });

  it("reports user cancellation as a cancellation, not a timeout", async () => {
    setTransport(hang);
    const controller = new AbortController();
    const p = request({ path: "/x", version: "v1", signal: controller.signal }, isVoid);
    controller.abort();
    const err = await p.catch((e: unknown) => e);
    expect(isCancellation(err)).toBe(true);
    expect(err).not.toBeInstanceOf(ApiError);
  });

  it("invalidateOutstandingRequests cancels in-flight requests", async () => {
    setTransport(hang);
    const p = request({ path: "/x", version: "v1" }, isVoid);
    invalidateOutstandingRequests();
    expect(isCancellation(await p.catch((e: unknown) => e))).toBe(true);
  });
});

describe("connection activity", () => {
  it("treats a 404 as reachable and a network failure as unreachable", async () => {
    const seen: string[] = [];
    const unsub = subscribeToActivity((o) => seen.push(o));
    setTransport(async () => ({ status: 404, body: undefined }));
    await apiClient.get("v1", "/workspaces", isServerWorkspaceList).catch(() => undefined);
    setTransport(async () => {
      throw new TypeError("down");
    });
    await apiClient.get("v1", "/workspaces", isServerWorkspaceList).catch(() => undefined);
    unsub();
    expect(seen).toEqual(["reachable", "unreachable"]);
  });

  it("health check: 2xx healthy, 404 still reachable, network failure unhealthy", async () => {
    setTransport(async () => ({ status: 200, body: undefined }));
    expect(await checkHealth("/health")).toBe(true);
    setTransport(async () => ({ status: 404, body: undefined }));
    expect(await checkHealth("/health")).toBe(true);
    setTransport(async () => ({ status: 503, body: undefined }));
    expect(await checkHealth("/health")).toBe(false);
    setTransport(async () => {
      throw new TypeError("down");
    });
    expect(await checkHealth("/health")).toBe(false);
  });
});
