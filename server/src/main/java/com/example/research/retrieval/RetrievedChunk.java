package com.example.research.retrieval;

/** One passage returned by Atlas, with the score from the last ranking stage that ran (RRF or rerank score if applicable). */
public record RetrievedChunk(
        String chunkId,
        String documentId,
        String workspaceId,
        String content,
        Integer pageNumber,
        String sectionTitle,
        Double score) {}
