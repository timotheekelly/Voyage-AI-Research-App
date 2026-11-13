package com.example.research.dto.request;

import com.example.research.model.RetrievalStrategy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatV2Request(
        @NotBlank @Size(max = 4000) String question,
        @NotBlank String workspaceId,
        String conversationId,
        RetrievalStrategy retrievalStrategy) {}
