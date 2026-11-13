package com.example.research.config;

import java.nio.file.Path;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Ingestion settings.
 * Token counts use the cl100k_base tokenizer (JTokkit) as an approximation: Voyage models use their own
 * tokenizer, so real Voyage token counts differ slightly. The chunk size is a target, not a hard model limit
 * (all supported Voyage models accept 32k tokens).
 */
@ConfigurationProperties("app.ingestion")
public record IngestionProperties(
        int chunkSize,
        int chunkOverlap,
        long maxFileSizeBytes,
        Path storageDir,
        Duration readinessPollInterval,
        Duration readinessTimeout) {

    public IngestionProperties {
        if (chunkSize < 50) throw new IllegalArgumentException("app.ingestion.chunk-size must be >= 50");
        if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
            throw new IllegalArgumentException("app.ingestion.chunk-overlap must be >= 0 and < chunk-size");
        }
    }
}
