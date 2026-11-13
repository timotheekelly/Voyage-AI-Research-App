import { useCallback, useEffect, useRef, useState } from "react";
import { sendChat } from "../api/chat";
import { getConversation } from "../api/conversations";
import { describeError, isCancellation, toApiError, type ApiError } from "../api/errors";
import type { ChatMessage } from "../types/chat";
import type { RetrievalConfig } from "../types/retrieval";
import { useApiVersion } from "./useApiVersion";

export interface UseChatOptions {
  conversationId?: string;
  workspaceId?: string;
  onConversationCreated?: (id: string) => void;
}

let counter = 0;
const localId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

export function useChat({ conversationId, workspaceId, onConversationCreated }: UseChatOptions) {
  const { version } = useApiVersion();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | undefined>(undefined);
  const requestRef = useRef(0); // invalidates in-flight results
  const createdCallback = useRef(onConversationCreated);
  createdCallback.current = onConversationCreated;

  const abortInFlight = useCallback(() => {
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPending(false);
  }, []);

  // Route or version change: cancel anything outstanding, then reload or reset.
  useEffect(() => {
    abortInFlight();
    setLoadError(null);

    if (!conversationId) {
      activeIdRef.current = undefined;
      setMessages([]);
      setLoadingConversation(false);
      return;
    }
    // The conversation we just created is already on screen.
    if (activeIdRef.current === conversationId) return;

    setMessages([]);
    setLoadingConversation(true);
    const controller = new AbortController();
    getConversation(version, conversationId, controller.signal).then(
      (conv) => {
        if (controller.signal.aborted) return;
        activeIdRef.current = conv.id;
        setMessages(
          conv.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            status: "complete",
            citations: m.citations,
            diagnostics: m.diagnostics,
            diagnosticsRequested: m.diagnostics !== undefined,
          })),
        );
        setLoadingConversation(false);
      },
      (err: unknown) => {
        if (controller.signal.aborted || isCancellation(err)) return;
        setLoadError(toApiError(err));
        setLoadingConversation(false);
      },
    );
    return () => controller.abort();
  }, [conversationId, version, abortInFlight]);

  useEffect(() => abortInFlight, [abortInFlight]);

  const send = useCallback(
    async (question: string, config: RetrievalConfig) => {
      const text = question.trim();
      if (!text || controllerRef.current) return; // block duplicate submissions

      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = ++requestRef.current;
      const pendingId = localId("a");
      const diagnosticsRequested = config.optimization.diagnostics;

      setPending(true);
      setMessages((prev) => [
        ...prev,
        { id: localId("u"), role: "user", content: text, status: "complete" },
        { id: pendingId, role: "assistant", content: "", status: "pending", question: text },
      ]);

      const replacePending = (patch: Partial<ChatMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, ...patch } : m)));

      try {
        const res = await sendChat(
          version,
          { question: text, workspaceId, conversationId: activeIdRef.current, config },
          controller.signal,
        );
        if (requestId !== requestRef.current) return; // stale (version switched or reset)
        replacePending({
          id: res.messageId,
          content: res.answer,
          status: "complete",
          citations: res.citations,
          diagnostics: res.diagnostics,
          diagnosticsRequested,
        });
        const isNew = activeIdRef.current !== res.conversationId;
        activeIdRef.current = res.conversationId;
        if (isNew) createdCallback.current?.(res.conversationId);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        if (isCancellation(err)) {
          replacePending({ status: "cancelled", content: "" });
        } else {
          replacePending({ status: "error", content: "", error: describeError(err) });
        }
      } finally {
        if (requestId === requestRef.current) {
          controllerRef.current = null;
          setPending(false);
        }
      }
    },
    [version, workspaceId],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  /** Retry a failed or cancelled question: drops the failed pair and re-sends. */
  const retry = useCallback(
    (messageId: string, config: RetrievalConfig) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      const failed = messages[idx];
      if (!failed?.question || controllerRef.current) return;
      setMessages((prev) => prev.slice(0, Math.max(0, idx - 1)));
      void send(failed.question, config);
    },
    [messages, send],
  );

  /** Start a fresh, unsaved conversation in place. */
  const reset = useCallback(() => {
    abortInFlight();
    activeIdRef.current = undefined;
    setMessages([]);
    setLoadError(null);
  }, [abortInFlight]);

  return { messages, pending, loadError, loadingConversation, send, cancel, retry, reset };
}
