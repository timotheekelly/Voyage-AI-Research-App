import { createContext, useContext, useMemo, type ReactNode } from "react";
import { listConversations } from "../api/conversations";
import type { ApiError } from "../api/errors";
import { useApiResource } from "../hooks/useApiResource";
import type { ConversationSummary } from "../types/chat";
import { useWorkspace } from "./WorkspaceContext";

export interface ConversationsContextValue {
  conversations: ConversationSummary[];
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  // Wait for workspace resolution so the list is fetched once with the right scope.
  const resource = useApiResource(
    workspaceLoading ? null : ({ version, signal }) => listConversations(version, workspaceId, signal),
    [workspaceId, workspaceLoading],
  );
  const value = useMemo<ConversationsContextValue>(
    () => ({
      conversations: resource.data ?? [],
      loading: resource.loading || workspaceLoading,
      error: resource.error,
      reload: resource.reload,
    }),
    [resource.data, resource.loading, resource.error, resource.reload, workspaceLoading],
  );
  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConversations(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used inside ConversationsProvider");
  return ctx;
}
