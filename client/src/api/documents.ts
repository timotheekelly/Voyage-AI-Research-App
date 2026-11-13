import type { ApiVersion } from "../config/capabilities";
import type { DocumentRecord } from "../types/document";
import { apiClient } from "./client";
import { isServerDocument, isServerDocumentList, toDocument } from "./guards";

export async function listDocuments(
  version: ApiVersion,
  workspaceId: string | undefined,
  signal?: AbortSignal,
): Promise<DocumentRecord[]> {
  const res = await apiClient.get(version, "/documents", isServerDocumentList, { signal, query: { workspaceId } });
  return res.map(toDocument);
}

export async function getDocument(version: ApiVersion, id: string, signal?: AbortSignal): Promise<DocumentRecord> {
  return toDocument(await apiClient.get(version, `/documents/${encodeURIComponent(id)}`, isServerDocument, { signal }));
}

export async function uploadDocument(
  version: ApiVersion,
  file: File,
  workspaceId: string | undefined,
  signal?: AbortSignal,
): Promise<DocumentRecord> {
  const form = new FormData();
  form.append("file", file);
  if (workspaceId) form.append("workspaceId", workspaceId);
  return toDocument(await apiClient.upload(version, "/documents", form, isServerDocument, { signal }));
}

export function deleteDocument(version: ApiVersion, id: string, signal?: AbortSignal): Promise<void> {
  return apiClient.delete(version, `/documents/${encodeURIComponent(id)}`, { signal });
}
