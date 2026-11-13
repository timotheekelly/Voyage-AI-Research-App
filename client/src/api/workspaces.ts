import type { ApiVersion } from "../config/capabilities";
import type { Workspace } from "../types/workspace";
import { apiClient } from "./client";
import { isServerWorkspaceList, toWorkspace } from "./guards";

export async function listWorkspaces(version: ApiVersion, signal?: AbortSignal): Promise<Workspace[]> {
  return (await apiClient.get(version, "/workspaces", isServerWorkspaceList, { signal })).map(toWorkspace);
}
