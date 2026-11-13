import type { ApiVersion } from "../config/capabilities";
import type { Conversation, ConversationSummary } from "../types/chat";
import { apiClient } from "./client";
import { isServerConversation, isServerConversationList, toConversation, toConversationSummary } from "./guards";

export async function listConversations(
  version: ApiVersion,
  workspaceId: string | undefined,
  signal?: AbortSignal,
): Promise<ConversationSummary[]> {
  const res = await apiClient.get(version, "/conversations", isServerConversationList, { signal, query: { workspaceId } });
  return res.map(toConversationSummary);
}

export async function getConversation(version: ApiVersion, id: string, signal?: AbortSignal): Promise<Conversation> {
  return toConversation(await apiClient.get(version, `/conversations/${encodeURIComponent(id)}`, isServerConversation, { signal }));
}

export function deleteConversation(version: ApiVersion, id: string, signal?: AbortSignal): Promise<void> {
  return apiClient.delete(version, `/conversations/${encodeURIComponent(id)}`, { signal });
}
