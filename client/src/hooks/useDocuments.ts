import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, uploadDocument } from "../api/documents";
import { describeError, isCancellation } from "../api/errors";
import { useApiVersion } from "./useApiVersion";
import { useApiResource } from "./useApiResource";
import { useWorkspace } from "../context/WorkspaceContext";
import type { PendingUpload } from "../types/document";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx", ".html"] as const;

export function validateFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 50 MB.";
  if (file.size === 0) return "File is empty.";
  return null;
}

let uploadCounter = 0;

export function useDocuments() {
  const { version } = useApiVersion();
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const resource = useApiResource(
    workspaceLoading ? null : ({ version: v, signal }) => listDocuments(v, workspaceId, signal),
    [workspaceId, workspaceLoading],
  );
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());

  // Uploads belong to the version they were started under.
  useEffect(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setUploads([]);
    setDeleteError(null);
  }, [version]);

  useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const runUpload = useCallback(
    async (entry: PendingUpload) => {
      const controller = new AbortController();
      controllers.current.set(entry.id, controller);
      setUploads((prev) => prev.map((u) => (u.id === entry.id ? { ...u, status: "uploading", error: undefined } : u)));
      try {
        const doc = await uploadDocument(version, entry.file, workspaceId, controller.signal);
        // Only now, with backend confirmation, does the document join the library.
        resource.mutate((cur) => [doc, ...(cur ?? []).filter((d) => d.id !== doc.id)]);
        setUploads((prev) => prev.filter((u) => u.id !== entry.id));
      } catch (err) {
        if (controller.signal.aborted || isCancellation(err)) {
          setUploads((prev) => prev.filter((u) => u.id !== entry.id));
          return;
        }
        setUploads((prev) =>
          prev.map((u) => (u.id === entry.id ? { ...u, status: "failed", error: describeError(err) } : u)),
        );
      } finally {
        controllers.current.delete(entry.id);
      }
    },
    [version, workspaceId, resource],
  );

  const upload = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const entry: PendingUpload = { id: `up-${++uploadCounter}`, fileName: file.name, status: "uploading", file };
        const problem = validateFile(file);
        if (problem) {
          setUploads((prev) => [...prev, { ...entry, status: "failed", error: problem }]);
        } else {
          setUploads((prev) => [...prev, entry]);
          void runUpload(entry);
        }
      }
    },
    [runUpload],
  );

  const retryUpload = useCallback(
    (id: string) => {
      const entry = uploads.find((u) => u.id === id);
      if (entry && !validateFile(entry.file)) void runUpload(entry);
    },
    [uploads, runUpload],
  );

  const dismissUpload = useCallback((id: string) => setUploads((prev) => prev.filter((u) => u.id !== id)), []);

  /** Not optimistic: the row is removed only after the backend confirms deletion. */
  const remove = useCallback(
    async (id: string) => {
      setDeleteError(null);
      setDeletingId(id);
      try {
        await deleteDocument(version, id);
        resource.mutate((cur) => (cur ?? []).filter((d) => d.id !== id));
      } catch (err) {
        if (!isCancellation(err)) setDeleteError(describeError(err));
      } finally {
        setDeletingId(null);
      }
    },
    [version, resource],
  );

  return {
    documents: resource.data ?? [],
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
    uploads,
    upload,
    retryUpload,
    dismissUpload,
    remove,
    deletingId,
    deleteError,
  };
}
