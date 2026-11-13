package com.example.research.retrieval;

import com.example.research.dto.request.FiltersDto;
import com.example.research.model.RetrievalStrategy;
import java.util.List;

/**
 * A fully-resolved retrieval request. workspaceIds are already authorized and are applied inside the Atlas query.
 * candidateCount bounds how many passages the first stage (and $rerank) may return; finalCount is how many are kept.
 */
public record RetrievalQuery(
        String question,
        List<String> workspaceIds,
        RetrievalStrategy strategy,
        boolean rerank,
        FiltersDto filters,
        int candidateCount,
        int finalCount,
        String vectorIndex) {}
