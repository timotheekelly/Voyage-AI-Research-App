package com.example.research.dto.response;

public record RetrievalConfigurationResponse(
        String id,
        String label,
        String embeddingModel,
        String quantization,
        boolean requiresReindex,
        boolean requiresReembedding,
        boolean available,
        String unavailableReason,
        String description) {}
