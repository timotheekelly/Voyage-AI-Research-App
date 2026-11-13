export type DocumentStatus = "uploading" | "processing" | "ready" | "failed";

export interface DocumentMetadata {
  author?: string;
  publicationDate?: string;
  publicationYear?: number;
  documentType?: string;
  tags?: string[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  status: DocumentStatus;
  workspaceId?: string;
  fileName?: string;
  sizeBytes?: number;
  pageCount?: number;
  uploadedAt?: string;
  failureReason?: string;
  metadata?: DocumentMetadata;
}

/** A client-side upload that the backend has not yet confirmed. Never shown as a library document. */
export interface PendingUpload {
  id: string;
  fileName: string;
  status: "uploading" | "failed";
  error?: string;
  file: File;
}
