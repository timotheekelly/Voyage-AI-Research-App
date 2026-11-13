package com.example.research.dto.request;

import com.example.research.model.RetrievalStrategy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** workspaceId is optional in V4: when omitted, retrieval spans every workspace the caller belongs to. */
public record ChatV4Request(
        @NotBlank @Size(max = 4000) String question,
        String workspaceId,
        String conversationId,
        RetrievalStrategy retrievalStrategy,
        @Valid RerankingDto reranking,
        @Valid FiltersDto filters) {}
