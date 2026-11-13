package com.example.research.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Retrieval settings and the registry of supported retrieval configurations (V5). */
@ConfigurationProperties("app.retrieval")
public record RetrievalProperties(
        int defaultCandidateCount,
        int defaultFinalResultCount,
        int maxCandidateCount,
        String textIndex,
        String contentPath,
        int numCandidatesMultiplier,
        String rerankModel,
        double vectorWeight,
        double textWeight,
        Duration indexCheckTtl,
        List<Configuration> configurations) {

    public static final String DEFAULT_CONFIGURATION_ID = "default";

    /**
     * One supported combination of embedding model, quantization and the vector index that serves it.
     * Changing the model or quantization of an existing index re-embeds/rebuilds it, so each alternative
     * is a separate index that an operator creates in Atlas; clients can only pick from this list.
     */
    public record Configuration(
            String id,
            String label,
            String indexName,
            String embeddingModel,
            String quantization,
            boolean requiresReindex,
            boolean requiresReembedding,
            String description) {}

    public RetrievalProperties {
        if (configurations == null || configurations.stream().noneMatch(c -> DEFAULT_CONFIGURATION_ID.equals(c.id()))) {
            throw new IllegalArgumentException(
                    "app.retrieval.configurations must contain an entry with id '" + DEFAULT_CONFIGURATION_ID + "'");
        }
        if (defaultFinalResultCount > defaultCandidateCount) {
            throw new IllegalArgumentException("default-final-result-count cannot exceed default-candidate-count");
        }
    }

    public Configuration defaultConfiguration() {
        return configurations.stream().filter(c -> DEFAULT_CONFIGURATION_ID.equals(c.id())).findFirst().orElseThrow();
    }

    public Configuration configuration(String id) {
        return configurations.stream().filter(c -> c.id().equals(id)).findFirst().orElse(null);
    }
}
