import { VERSION_CAPABILITIES, type ApiVersion } from "../config/capabilities";
import type { ChatRequestPayload } from "../types/chat";
import type { RetrievalConfig } from "../types/retrieval";

export interface ChatInputParams {
  question: string;
  workspaceId?: string;
  conversationId?: string;
  config: RetrievalConfig;
}

/**
 * Builds the chat payload for a version. Only fields the version supports are included,
 * so switching versions can never leak stale controls into a request.
 */
export function buildChatPayload(version: ApiVersion, params: ChatInputParams): ChatRequestPayload {
  const caps = VERSION_CAPABILITIES[version];
  const { config } = params;
  const payload: ChatRequestPayload = { question: params.question };

  if (params.workspaceId) payload.workspaceId = params.workspaceId;
  if (params.conversationId) payload.conversationId = params.conversationId;

  if (caps.hybridSearch) payload.retrievalStrategy = config.retrievalStrategy;

  if (caps.reranking) {
    payload.reranking = config.reranking.enabled
      ? {
          enabled: true,
          candidateCount: config.reranking.candidateCount,
          finalResultCount: config.reranking.finalResultCount,
        }
      : { enabled: false };
  }

  if (caps.metadataFiltering) {
    const { yearMin, yearMax, documentTypes, tags } = config.filters;
    const filters: NonNullable<ChatRequestPayload["filters"]> = {};
    if (yearMin !== undefined || yearMax !== undefined) {
      filters.publicationYear = {
        ...(yearMin !== undefined ? { min: yearMin } : {}),
        ...(yearMax !== undefined ? { max: yearMax } : {}),
      };
    }
    if (documentTypes.length > 0) filters.documentTypes = [...documentTypes];
    if (tags.length > 0) filters.tags = [...tags];
    if (Object.keys(filters).length > 0) payload.filters = filters;
  }

  if (caps.optimization) {
    const { embeddingConfigId, quantization, diagnostics } = config.optimization;
    payload.optimization = {
      ...(embeddingConfigId ? { embeddingConfiguration: embeddingConfigId } : {}),
      ...(quantization ? { quantization } : {}),
      diagnosticsEnabled: caps.diagnostics && diagnostics,
    };
  }

  return payload;
}
