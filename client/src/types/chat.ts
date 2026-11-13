import type { DocumentMetadata } from "./document";
import type { RetrievalDiagnostics, RetrievalStrategy } from "./retrieval";

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  pageNumber?: number;
  passage: string;
  metadata?: DocumentMetadata;
}

/** Request body for POST /api/{version}/chat. Which optional fields are present depends on the version. */
export interface ChatRequestPayload {
  question: string;
  workspaceId?: string;
  conversationId?: string;
  retrievalStrategy?: RetrievalStrategy;
  reranking?: { enabled: boolean; candidateCount?: number; finalResultCount?: number };
  filters?: {
    publicationYear?: { min?: number; max?: number };
    documentTypes?: string[];
    tags?: string[];
  };
  optimization?: { embeddingConfiguration?: string; quantization?: string; diagnosticsEnabled: boolean };
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  citations: Citation[];
  diagnostics?: RetrievalDiagnostics;
}

export type MessageStatus = "complete" | "pending" | "error" | "cancelled";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  citations?: Citation[];
  diagnostics?: RetrievalDiagnostics;
  diagnosticsRequested?: boolean;
  error?: string;
  /** The question that produced this assistant message; used for Retry. */
  question?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  workspaceId?: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  diagnostics?: RetrievalDiagnostics;
}

export interface Conversation extends ConversationSummary {
  messages: StoredMessage[];
}
