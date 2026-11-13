package com.example.research.retrieval;

import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.FiltersDto;
import com.example.research.dto.request.OptimizationDto;
import com.example.research.dto.request.RerankingDto;
import com.example.research.dto.response.RetrievalConfigurationResponse;
import com.example.research.exception.ApiException;
import com.example.research.model.RetrievalStrategy;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * V5: V4 plus a selectable retrieval configuration. Clients choose from the server-defined registry
 * (app.retrieval.configurations); arbitrary model names or quantization values are rejected. Each configuration is
 * served by its own Atlas vector index, because changing the embedding model or quantization rebuilds an index.
 */
@Service
public class OptimizedRetrievalService {

    private final AtlasChunkSearch search;
    private final AtlasIndexService indexes;
    private final RetrievalRequestResolver resolver;
    private final RetrievalProperties props;

    public OptimizedRetrievalService(AtlasChunkSearch search, AtlasIndexService indexes, RetrievalRequestResolver resolver,
                                     RetrievalProperties props) {
        this.search = search;
        this.indexes = indexes;
        this.resolver = resolver;
        this.props = props;
    }

    public RetrievalOutcome retrieve(String question, List<String> workspaceIds, RetrievalStrategy requested,
                                     RerankingDto reranking, FiltersDto filters, OptimizationDto optimization) {
        var configuration = resolveConfiguration(optimization == null ? null : optimization.embeddingConfiguration(),
                optimization == null ? null : optimization.quantization());
        var rr = resolver.reranking(reranking);
        return search.search(new RetrievalQuery(question, workspaceIds, resolver.strategy(requested), rr.enabled(),
                resolver.filters(filters), rr.candidateCount(), rr.finalResultCount(), configuration.indexName()));
    }

    public RetrievalProperties.Configuration resolveConfiguration(String id, String quantization) {
        String configId = id == null || id.isBlank() ? RetrievalProperties.DEFAULT_CONFIGURATION_ID : id;
        var configuration = props.configuration(configId);
        if (configuration == null) {
            throw ApiException.badRequest("Unsupported optimization.embeddingConfiguration '" + configId
                    + "'. See GET /api/v5/retrieval/configurations.");
        }
        if (quantization != null && !quantization.isBlank() && !quantization.equals(configuration.quantization())) {
            throw ApiException.badRequest("Unsupported optimization.quantization '" + quantization + "' for configuration '"
                    + configId + "' (supported: " + configuration.quantization() + ").");
        }
        return configuration;
    }

    public List<RetrievalConfigurationResponse> configurations() {
        return props.configurations().stream().map(c -> {
            String reason = indexes.unavailableReason(c.indexName());
            return new RetrievalConfigurationResponse(c.id(), c.label(), c.embeddingModel(), c.quantization(),
                    c.requiresReindex(), c.requiresReembedding(), reason == null, reason, c.description());
        }).toList();
    }
}
