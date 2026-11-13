import type { ApiVersion } from "../config/capabilities";
import type { ChatResponse } from "../types/chat";
import { apiClient } from "./client";
import { isServerChatResponse, toChatResponse } from "./guards";
import { buildChatPayload, type ChatInputParams } from "./requestBuilder";

export async function sendChat(version: ApiVersion, params: ChatInputParams, signal?: AbortSignal): Promise<ChatResponse> {
  const payload = buildChatPayload(version, params);
  const res = await apiClient.post(version, "/chat", payload, isServerChatResponse, { signal, timeoutMs: 90_000 });
  return toChatResponse({ ...res, citations: res.citations ?? [] });
}
