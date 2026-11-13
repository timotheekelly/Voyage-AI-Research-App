package com.example.research.retrieval;

import com.example.research.config.RetrievalProperties;
import com.example.research.model.RetrievalStrategy;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * V2: VECTOR, TEXT or HYBRID retrieval.
 * Exact-term queries ("AP1000") are where TEXT/HYBRID shine: lexical search matches the literal token, while a
 * vector search only finds passages that are semantically close and may rank a rarely-seen identifier poorly.
 */
@Service
public class HybridRetrievalService {

    private final AtlasChunkSearch search;
    private final RetrievalRequestResolver resolver;
    private final RetrievalProperties props;

    public HybridRetrievalService(AtlasChunkSearch search, RetrievalRequestResolver resolver, RetrievalProperties props) {
        this.search = search;
        this.resolver = resolver;
        this.props = props;
    }

    public RetrievalOutcome retrieve(String question, List<String> workspaceIds, RetrievalStrategy requested) {
        return search.search(new RetrievalQuery(question, workspaceIds, resolver.strategy(requested), false, null,
                props.defaultCandidateCount(), props.defaultFinalResultCount(), props.defaultConfiguration().indexName()));
    }
}
