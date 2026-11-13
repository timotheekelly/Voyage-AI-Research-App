package com.example.research.retrieval;

import com.example.research.config.RetrievalProperties;
import com.example.research.dto.request.RerankingDto;
import com.example.research.model.RetrievalStrategy;
import java.util.List;
import org.springframework.stereotype.Service;

/** V3: first-stage retrieval, then Atlas-native $rerank (Voyage reranker) when enabled. */
@Service
public class RerankingRetrievalService {

    private final AtlasChunkSearch search;
    private final RetrievalRequestResolver resolver;
    private final RetrievalProperties props;

    public RerankingRetrievalService(AtlasChunkSearch search, RetrievalRequestResolver resolver, RetrievalProperties props) {
        this.search = search;
        this.resolver = resolver;
        this.props = props;
    }

    public RetrievalOutcome retrieve(String question, List<String> workspaceIds, RetrievalStrategy requested, RerankingDto reranking) {
        var rr = resolver.reranking(reranking);
        return search.search(new RetrievalQuery(question, workspaceIds, resolver.strategy(requested), rr.enabled(), null,
                rr.candidateCount(), rr.finalResultCount(), props.defaultConfiguration().indexName()));
    }
}
