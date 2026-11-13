package com.example.research.dto.request;

/** V5 optimization settings. Values must match an entry from GET /api/v5/retrieval/configurations. */
public record OptimizationDto(String embeddingConfiguration, String quantization, Boolean diagnosticsEnabled) {}
