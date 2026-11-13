package com.example.research.retrieval;

import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.FiltersDto;
import com.example.research.dto.request.RerankingDto;
import com.example.research.model.RetrievalStrategy;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * V4: V3 plus metadata filters. workspaceIds (already authorized) and the metadata filters are both applied inside the
 * Atlas query, never after retrieval.
 */
@Service
public class FilteredRetrievalService {

    private final AtlasChunkSearch search;
    private final RetrievalRequestResolver resolver;
    private final RetrievalProperties props;

    public FilteredRetrievalService(AtlasChunkSearch search, RetrievalRequestResolver resolver, RetrievalProperties props) {
        this.search = search;
        this.resolver = resolver;
        this.props = props;
    }

    public RetrievalOutcome retrieve(String question, List<String> workspaceIds, RetrievalStrategy requested,
                                     RerankingDto reranking, FiltersDto filters) {
        var rr = resolver.reranking(reranking);
        return search.search(new RetrievalQuery(question, workspaceIds, resolver.strategy(requested), rr.enabled(),
                resolver.filters(filters), rr.candidateCount(), rr.finalResultCount(),
                props.defaultConfiguration().indexName()));
    }
}
