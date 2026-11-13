import type { ChatResponse, Citation, Conversation, ConversationSummary, StoredMessage } from "../types/chat";
import type { DocumentMetadata, DocumentRecord, DocumentStatus } from "../types/document";
import type { RetrievalDiagnostics, RetrievalOptions } from "../types/retrieval";
import type { Workspace } from "../types/workspace";

/**
 * Wire-format ("server") types, their type guards, and mappers to the UI models.
 * The backend contract lives here; the rest of the app only sees the UI models.
 */

export type Guard<T> = (value: unknown) => value is T;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const optional = (v: unknown, check: (x: unknown) => boolean): boolean => v === undefined || check(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
const arrayOf =
  <T>(guard: Guard<T>) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

export const isVoid = (_v: unknown): _v is undefined => true;

// ---- wire types ----

export interface ServerCitation {
  documentId: string;
  chunkId: string;
  title: string;
  pageNumber?: number;
  passage: string;
  score?: number;
}

export interface ServerChatResponse {
  conversationId: string;
  answer: string;
  citations: ServerCitation[];
  retrieval?: Record<string, unknown>;
  diagnostics?: RetrievalDiagnostics;
}

export interface ServerWorkspace {
  id: string;
  name: string;
  description?: string;
}

export interface ServerDocument {
  id: string;
  workspaceId?: string;
  title: string;
  filename?: string;
  author?: string;
  publicationYear?: number;
  documentType?: string;
  tags?: string[];
  processingStatus: string;
  failureReason?: string;
  sizeBytes?: number;
  pageCount?: number;
  uploadedAt?: string;
}

export interface ServerConversationSummary {
  id: string;
  workspaceId?: string;
  title: string;
  createdAt?: string;
  updatedAt: string;
}

export interface ServerMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations?: ServerCitation[];
  createdAt?: string;
}

export interface ServerConversation extends ServerConversationSummary {
  messages: ServerMessage[];
}

export interface ServerConfiguration {
  id: string;
  label: string;
  embeddingModel?: string;
  quantization?: string;
  requiresReindex?: boolean;
  requiresReembedding?: boolean;
  available?: boolean;
  unavailableReason?: string;
}

export interface ServerRetrievalOptions {
  documentTypes?: string[];
  tags?: string[];
}

// ---- guards ----

const DIAGNOSTIC_KEYS = [
  "retrievalLatencyMs",
  "rerankingLatencyMs",
  "generationLatencyMs",
  "totalLatencyMs",
  "candidateCount",
  "finalPassageCount",
  "recallAtK",
  "recallK",
  "mrr",
  "estimatedCostUsd",
] as const;

const isDiagnostics: Guard<RetrievalDiagnostics> = (v): v is RetrievalDiagnostics =>
  isRecord(v) && DIAGNOSTIC_KEYS.every((k) => optional(v[k], isNumber));

const isServerCitation: Guard<ServerCitation> = (v): v is ServerCitation =>
  isRecord(v) &&
  isString(v.documentId) &&
  isString(v.chunkId) &&
  isString(v.title) &&
  isString(v.passage) &&
  optional(v.pageNumber, isNumber) &&
  optional(v.score, isNumber);

export const isServerChatResponse: Guard<ServerChatResponse> = (v): v is ServerChatResponse =>
  isRecord(v) &&
  isString(v.conversationId) &&
  isString(v.answer) &&
  arrayOf(isServerCitation)(v.citations ?? []) &&
  optional(v.retrieval, isRecord) &&
  optional(v.diagnostics, isDiagnostics);

const isServerWorkspace: Guard<ServerWorkspace> = (v): v is ServerWorkspace =>
  isRecord(v) && isString(v.id) && isString(v.name) && optional(v.description, isString);
export const isServerWorkspaceList: Guard<ServerWorkspace[]> = arrayOf(isServerWorkspace);

const STATUSES = ["UPLOADING", "PROCESSING", "READY", "FAILED"];
export const isServerDocument: Guard<ServerDocument> = (v): v is ServerDocument =>
  isRecord(v) &&
  isString(v.id) &&
  isString(v.title) &&
  isString(v.processingStatus) &&
  STATUSES.includes(v.processingStatus) &&
  optional(v.workspaceId, isString) &&
  optional(v.filename, isString) &&
  optional(v.author, isString) &&
  optional(v.publicationYear, isNumber) &&
  optional(v.documentType, isString) &&
  optional(v.tags, isStringArray) &&
  optional(v.failureReason, isString) &&
  optional(v.sizeBytes, isNumber) &&
  optional(v.pageCount, isNumber) &&
  optional(v.uploadedAt, isString);
export const isServerDocumentList: Guard<ServerDocument[]> = arrayOf(isServerDocument);

const isServerConversationSummary: Guard<ServerConversationSummary> = (v): v is ServerConversationSummary =>
  isRecord(v) && isString(v.id) && isString(v.title) && isString(v.updatedAt) && optional(v.workspaceId, isString);
export const isServerConversationList: Guard<ServerConversationSummary[]> = arrayOf(isServerConversationSummary);

const isServerMessage: Guard<ServerMessage> = (v): v is ServerMessage =>
  isRecord(v) &&
  isString(v.id) &&
  (v.role === "USER" || v.role === "ASSISTANT") &&
  isString(v.content) &&
  optional(v.citations, arrayOf(isServerCitation));
export const isServerConversation: Guard<ServerConversation> = (v): v is ServerConversation =>
  isServerConversationSummary(v) && arrayOf(isServerMessage)((v as unknown as Record<string, unknown>).messages);

const isServerConfiguration: Guard<ServerConfiguration> = (v): v is ServerConfiguration =>
  isRecord(v) &&
  isString(v.id) &&
  isString(v.label) &&
  optional(v.embeddingModel, isString) &&
  optional(v.quantization, isString) &&
  optional(v.available, (x) => typeof x === "boolean") &&
  optional(v.unavailableReason, isString);
export const isServerConfigurationList: Guard<ServerConfiguration[]> = arrayOf(isServerConfiguration);

export const isServerRetrievalOptions: Guard<ServerRetrievalOptions> = (v): v is ServerRetrievalOptions =>
  isRecord(v) && optional(v.documentTypes, isStringArray) && optional(v.tags, isStringArray);

// ---- mappers (wire → UI models) ----

let messageCounter = 0;

export function toCitation(c: ServerCitation): Citation {
  return {
    documentId: c.documentId,
    documentTitle: c.title,
    chunkId: c.chunkId,
    pageNumber: c.pageNumber,
    passage: c.passage,
  };
}

export function toChatResponse(r: ServerChatResponse): ChatResponse {
  return {
    conversationId: r.conversationId,
    messageId: `answer-${Date.now()}-${++messageCounter}`, // the API does not return a message id for fresh answers
    answer: r.answer,
    citations: r.citations.map(toCitation),
    diagnostics: r.diagnostics,
  };
}

export function toWorkspace(w: ServerWorkspace): Workspace {
  return { id: w.id, name: w.name, description: w.description };
}

export function toDocument(d: ServerDocument): DocumentRecord {
  const metadata: DocumentMetadata = {
    author: d.author,
    publicationYear: d.publicationYear,
    documentType: d.documentType,
    tags: d.tags,
  };
  return {
    id: d.id,
    title: d.title,
    status: d.processingStatus.toLowerCase() as DocumentStatus,
    workspaceId: d.workspaceId,
    fileName: d.filename,
    sizeBytes: d.sizeBytes,
    pageCount: d.pageCount,
    uploadedAt: d.uploadedAt,
    failureReason: d.failureReason,
    metadata,
  };
}

export function toConversationSummary(c: ServerConversationSummary): ConversationSummary {
  return { id: c.id, title: c.title, updatedAt: c.updatedAt, workspaceId: c.workspaceId };
}

export function toConversation(c: ServerConversation): Conversation {
  const messages: StoredMessage[] = c.messages.map((m) => ({
    id: m.id,
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
    citations: m.citations?.map(toCitation),
  }));
  return { ...toConversationSummary(c), messages };
}

/** Combines filter values (V4+) with the configuration registry (V5). */
export function toRetrievalOptions(options: ServerRetrievalOptions, configs: ServerConfiguration[] | null): RetrievalOptions {
  const embeddingConfigs = (configs ?? []).map((c) => ({
    id: c.id,
    label: c.available === false ? `${c.label} (unavailable)` : c.label,
    model: c.embeddingModel,
    quantization: c.quantization,
    available: c.available !== false,
    unavailableReason: c.unavailableReason,
    requiresReembedding: c.requiresReembedding === true,
    requiresReindex: c.requiresReindex === true,
  }));
  const quantizations = [...new Set(embeddingConfigs.map((c) => c.quantization).filter((q): q is string => !!q))].map(
    (id) => ({ id, label: id }),
  );
  return {
    documentTypes: options.documentTypes ?? [],
    tags: options.tags ?? [],
    embeddingConfigs,
    quantizations,
  };
}
