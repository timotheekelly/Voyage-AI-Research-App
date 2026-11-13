package com.example.research.dto.response;

import com.example.research.model.RetrievalStrategy;

/** What retrieval actually did. Counts are the numbers really returned, not the numbers requested. */
public record RetrievalInfo(RetrievalStrategy strategy, boolean rerankingEnabled, int candidateCount, int finalResultCount) {}
