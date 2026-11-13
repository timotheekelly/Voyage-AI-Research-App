import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setTransport, type TransportRequest } from "../api/client";
import { cloneDefaultConfig } from "../config/retrievalConfig";
import { Providers, ok } from "../test/utils";
import { useApiVersion } from "./useApiVersion";
import { useChat } from "./useChat";

const chatBody = {
  conversationId: "c1",
  answer: "Answer [1]",
  citations: [{ documentId: "d1", title: "Doc", chunkId: "k1", passage: "p" }],
};

function setup() {
  return renderHook(() => ({ chat: useChat({}), v: useApiVersion() }), { wrapper: Providers });
}

describe("useChat", () => {
  it("shows an error message (and no fake answer) when the backend is offline", async () => {
    setTransport(async () => {
      throw new TypeError("offline");
    });
    const { result } = setup();
    await act(() => result.current.chat.send("hello", cloneDefaultConfig()));
    const assistant = result.current.chat.messages.find((m) => m.role === "assistant");
    expect(assistant?.status).toBe("error");
    expect(assistant?.content).toBe("");
    expect(assistant?.error).toBe("Unable to connect to the research API. Check that the backend is running.");
  });

  it("shows the 404 message for a missing endpoint", async () => {
    setTransport(async () => ({ status: 404, body: undefined }));
    const { result } = setup();
    await act(() => result.current.chat.send("hello", cloneDefaultConfig()));
    expect(result.current.chat.messages[1]?.error).toBe("This feature is not available in the selected API version yet.");
  });

  it("shows the invalid response message for malformed data", async () => {
    setTransport(async (req) => (req.method === "POST" ? ok({ nope: true }) : { status: 404, body: undefined }));
    const { result } = setup();
    await act(() => result.current.chat.send("hello", cloneDefaultConfig()));
    expect(result.current.chat.messages[1]?.error).toBe("The API returned an unexpected response.");
  });

  it("blocks duplicate submissions while a request is pending", async () => {
    let posts = 0;
    let release: () => void = () => undefined;
    setTransport(async (req) => {
      if (req.method !== "POST") return { status: 404, body: undefined };
      posts++;
      await new Promise<void>((r) => (release = r));
      return ok(chatBody);
    });
    const { result } = setup();
    act(() => void result.current.chat.send("one", cloneDefaultConfig()));
    act(() => void result.current.chat.send("two", cloneDefaultConfig()));
    expect(posts).toBe(1);
    await act(async () => release());
    await waitFor(() => expect(result.current.chat.pending).toBe(false));
  });

  it("marks a user-cancelled request as cancelled", async () => {
    setTransport(
      (req) =>
        new Promise((_, reject) => {
          if (req.method !== "POST") return reject(new TypeError("x"));
          req.signal.addEventListener("abort", () => reject(new DOMException("a", "AbortError")));
        }),
    );
    const { result } = setup();
    act(() => void result.current.chat.send("hello", cloneDefaultConfig()));
    act(() => result.current.chat.cancel());
    await waitFor(() => expect(result.current.chat.messages[1]?.status).toBe("cancelled"));
  });

  it("cancels an in-flight request and ignores its late response when the API version changes", async () => {
    let chatReq: TransportRequest | undefined;
    let resolveChat: () => void = () => undefined;
    setTransport(async (req) => {
      if (req.method !== "POST") return { status: 404, body: undefined };
      chatReq = req;
      await new Promise<void>((r) => (resolveChat = r)); // deliberately ignores abort
      return ok(chatBody);
    });
    const { result } = setup();
    act(() => void result.current.chat.send("hello", cloneDefaultConfig()));
    await waitFor(() => expect(chatReq).toBeDefined());
    expect(chatReq?.path).toBe("/api/v1/chat");

    act(() => result.current.v.setVersion("v2"));
    expect(chatReq?.signal.aborted).toBe(true);
    expect(result.current.chat.pending).toBe(false);
    expect(result.current.chat.messages).toEqual([]);

    await act(async () => resolveChat()); // late v1 response arrives
    expect(result.current.chat.messages).toEqual([]); // not shown under v2
  });

  it("uses the new version's route for requests after a switch", async () => {
    const paths: string[] = [];
    setTransport(async (req) => {
      paths.push(`${req.method} ${req.path}`);
      return req.method === "POST" ? ok(chatBody) : { status: 404, body: undefined };
    });
    const { result } = setup();
    act(() => result.current.v.setVersion("v5"));
    await act(() => result.current.chat.send("hello", cloneDefaultConfig()));
    expect(paths).toContain("POST /api/v5/chat");
    expect(paths).not.toContain("POST /api/v1/chat");
  });
});
