package com.example.research.retrieval;

import com.example.research.config.RetrievalProperties;
import com.example.research.model.RetrievalStrategy;
import java.util.List;
import org.springframework.stereotype.Service;

/** V1: semantic retrieval only, via Atlas Vector Search on the automated-embedding index. */
@Service
public class VectorRetrievalService {

    private final AtlasChunkSearch search;
    private final RetrievalProperties props;

    public VectorRetrievalService(AtlasChunkSearch search, RetrievalProperties props) {
        this.search = search;
        this.props = props;
    }

    public RetrievalOutcome retrieve(String question, List<String> workspaceIds) {
        int n = props.defaultFinalResultCount();
        return search.search(new RetrievalQuery(question, workspaceIds, RetrievalStrategy.VECTOR, false, null, n, n,
                props.defaultConfiguration().indexName()));
    }
}
