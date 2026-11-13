package com.example.research.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * V5 diagnostics. Every value is measured, never estimated; unmeasured values are omitted.
 * Latencies are application-observed wall-clock times (System.nanoTime), not isolated Atlas execution times:
 * retrievalLatencyMs covers the whole aggregation round trip including any $rerank stage, which Atlas runs
 * inside the same command, so rerankingLatencyMs is not separately measurable and is omitted.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DiagnosticsInfo(
        Long retrievalLatencyMs,
        Long rerankingLatencyMs,
        Long generationLatencyMs,
        Long totalLatencyMs,
        Integer candidateCount,
        Integer finalPassageCount,
        String strategy) {}
