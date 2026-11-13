package com.example.research.evaluation;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Offline retrieval metrics. These need relevance labels, so they exist only for evaluation runs, never for a single
 * chat question.
 *
 * <p>Labels may name documents and/or chunks. Each distinct labelled item is one "expected item". A retrieved chunk
 * satisfies its own chunk label and its parent document's label.
 */
public final class RetrievalMetrics {

    private RetrievalMetrics() {}

    /** Fraction of expected items found within the first k retrieved chunks. */
    public static double recallAtK(Collection<String> expectedDocumentIds, Collection<String> expectedChunkIds,
                                   List<String> retrievedChunkIds, List<String> retrievedDocumentIds, int k) {
        Set<String> docs = new HashSet<>(expectedDocumentIds);
        Set<String> chunks = new HashSet<>(expectedChunkIds);
        int expected = docs.size() + chunks.size();
        if (expected == 0) throw new IllegalArgumentException("At least one expected document or chunk id is required");
        int limit = Math.min(k, retrievedChunkIds.size());
        Set<String> foundDocs = new HashSet<>();
        Set<String> foundChunks = new HashSet<>();
        for (int i = 0; i < limit; i++) {
            if (chunks.contains(retrievedChunkIds.get(i))) foundChunks.add(retrievedChunkIds.get(i));
            if (docs.contains(retrievedDocumentIds.get(i))) foundDocs.add(retrievedDocumentIds.get(i));
        }
        return (double) (foundDocs.size() + foundChunks.size()) / expected;
    }

    /** 1 / rank of the first relevant retrieved chunk (1-based), or 0 if none is relevant. */
    public static double reciprocalRank(Collection<String> expectedDocumentIds, Collection<String> expectedChunkIds,
                                        List<String> retrievedChunkIds, List<String> retrievedDocumentIds) {
        Set<String> docs = new HashSet<>(expectedDocumentIds);
        Set<String> chunks = new HashSet<>(expectedChunkIds);
        for (int i = 0; i < retrievedChunkIds.size(); i++) {
            if (chunks.contains(retrievedChunkIds.get(i)) || docs.contains(retrievedDocumentIds.get(i))) {
                return 1.0 / (i + 1);
            }
        }
        return 0.0;
    }

    public static double mean(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(Double.NaN);
    }

    /** Nearest-rank percentile (p in (0, 100]). */
    public static double percentile(List<Double> values, double p) {
        if (values.isEmpty()) return Double.NaN;
        List<Double> sorted = new ArrayList<>(values);
        sorted.sort(Double::compare);
        int rank = (int) Math.ceil(p / 100.0 * sorted.size());
        return sorted.get(Math.max(1, rank) - 1);
    }
}
