package com.example.research.retrieval;

import com.example.research.model.RetrievalStrategy;
import java.util.List;

/**
 * @param passages          the final passages, best first
 * @param candidateCount    how many passages Atlas actually returned before the final cut (not the requested count)
 * @param retrievalMillis   wall-clock time of the aggregation round trip, including $rerank when used
 */
public record RetrievalOutcome(
        List<RetrievedChunk> passages,
        int candidateCount,
        RetrievalStrategy strategy,
        boolean rerankingEnabled,
        long retrievalMillis) {}
