import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listWorkspaces } from "../api/workspaces";
import type { ApiError } from "../api/errors";
import { useApiResource } from "../hooks/useApiResource";
import type { Workspace } from "../types/workspace";

export interface WorkspaceContextValue {
  workspaces: Workspace[];
  loading: boolean;
  error: ApiError | null;
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  reload: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const resource = useApiResource(({ version, signal }) => listWorkspaces(version, signal));
  const [activeId, setActiveId] = useState<string | null>(null);
  const workspaces = useMemo(() => resource.data ?? [], [resource.data]);

  // Workspaces from one API version are not assumed valid in another: re-resolve after every load.
  useEffect(() => {
    if (workspaces.length === 0) {
      setActiveId(null);
    } else if (!workspaces.some((w) => w.id === activeId)) {
      setActiveId(workspaces[0]?.id ?? null);
    }
  }, [workspaces, activeId]);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null;
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      loading: resource.loading,
      error: resource.error,
      activeWorkspace,
      setActiveWorkspaceId: setActiveId,
      reload: resource.reload,
    }),
    [workspaces, resource.loading, resource.error, activeWorkspace, resource.reload],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
