package com.example.research.retrieval;

import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.FiltersDto;
import com.example.research.dto.request.RerankingDto;
import com.example.research.exception.ApiException;
import com.example.research.model.RetrievalStrategy;
import org.springframework.stereotype.Component;

/** Applies defaults and validates retrieval settings. Unsupported configurations are rejected with 400. */
@Component
public class RetrievalRequestResolver {

    public record Reranking(boolean enabled, int candidateCount, int finalResultCount) {}

    private final RetrievalProperties props;

    public RetrievalRequestResolver(RetrievalProperties props) {
        this.props = props;
    }

    public RetrievalStrategy strategy(RetrievalStrategy requested) {
        return requested == null ? RetrievalStrategy.HYBRID : requested;
    }

    /** Null means "not specified": reranking is off and the defaults apply to the result limit. */
    public Reranking reranking(RerankingDto dto) {
        if (dto == null) {
            return new Reranking(false, props.defaultCandidateCount(), props.defaultFinalResultCount());
        }
        int candidates = dto.candidateCount() != null ? dto.candidateCount() : props.defaultCandidateCount();
        int finalCount = dto.finalResultCount() != null ? dto.finalResultCount() : props.defaultFinalResultCount();
        if (candidates < 1) throw ApiException.badRequest("reranking.candidateCount must be positive.");
        if (finalCount < 1) throw ApiException.badRequest("reranking.finalResultCount must be positive.");
        if (candidates > props.maxCandidateCount()) {
            throw ApiException.badRequest("reranking.candidateCount cannot exceed " + props.maxCandidateCount() + ".");
        }
        if (finalCount > candidates) {
            throw ApiException.badRequest("reranking.finalResultCount cannot exceed reranking.candidateCount.");
        }
        return new Reranking(dto.enabled(), candidates, finalCount);
    }

    public FiltersDto filters(FiltersDto dto) {
        if (dto == null || dto.isEmpty()) return null;
        var years = dto.publicationYear();
        if (years != null && years.min() != null && years.max() != null && years.min() > years.max()) {
            throw ApiException.badRequest("filters.publicationYear.min cannot be greater than max.");
        }
        return dto;
    }
}
