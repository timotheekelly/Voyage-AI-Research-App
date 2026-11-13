package com.example.research.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Reranking request (V3+). Counts fall back to configured defaults when omitted. */
public record RerankingDto(
        boolean enabled,
        @Min(1) @Max(1000) Integer candidateCount,
        @Min(1) @Max(1000) Integer finalResultCount) {}
