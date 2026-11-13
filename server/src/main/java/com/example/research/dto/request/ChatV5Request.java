package com.example.research.dto.request;

import com.example.research.model.RetrievalStrategy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatV5Request(
        @NotBlank @Size(max = 4000) String question,
        String workspaceId,
        String conversationId,
        RetrievalStrategy retrievalStrategy,
        @Valid RerankingDto reranking,
        @Valid FiltersDto filters,
        @Valid OptimizationDto optimization) {}
